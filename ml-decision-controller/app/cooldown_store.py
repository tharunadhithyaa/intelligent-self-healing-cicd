"""
CivicPulseAI — Persistent Cooldown & Governance Store
=====================================================
Manages persistent action cooldown timers, failure counts, and circuit breaker states
across microservice pod restarts.

Supported Backends (controlled by COOLDOWN_STORE_TYPE env var):
1. ConfigMap (Default K8s backend) — Uses optimistic locking (resourceVersion) + retry backoff.
   - Trade-off: Ideal for zero-dependency local/demo deployment. Under high multi-replica
     alert concurrency, ConfigMap updates can encounter API server rate limits.
2. Redis — Recommended for Production (set REDIS_URL or REDIS_HOST).
   - High-throughput atomic key-value operations with sub-millisecond latency.
3. MongoDB — Uses PyMongo collection if MONGODB_URI is configured.
4. Memory — Local in-memory fallback for testing.
"""

import json
import logging
import os
import time
from typing import Dict, Tuple, Optional, Any

logger = logging.getLogger("ml_decision_controller.cooldown_store")

COOLDOWN_PERIOD_DEFAULT = 300
CONFIGMAP_NAME = os.getenv("COOLDOWN_CONFIGMAP_NAME", "civicpulse-cooldown-store")
NAMESPACE = os.getenv("NAMESPACE", "civicpulse")

class PersistentCooldownStore:
    def __init__(self, namespace: str = NAMESPACE, k8s_loaded: bool = False):
        self.namespace = namespace
        self.k8s_loaded = k8s_loaded
        self.cooldown_seconds = int(os.getenv("COOLDOWN_PERIOD_SECONDS", str(COOLDOWN_PERIOD_DEFAULT)))
        self.store_type = os.getenv("COOLDOWN_STORE_TYPE", "auto").lower()

        # In-memory backing cache
        self._action_times: Dict[str, float] = {}
        self._failure_counts: Dict[str, int] = {}
        self._circuit_states: Dict[str, str] = {}

        # Backend clients
        self._redis_client = None
        self._mongo_col = None

        self._init_backends()
        self.load_state()

    def _init_backends(self):
        # Redis auto-detect
        redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_HOST")
        if (self.store_type in ["redis", "auto"]) and redis_url:
            try:
                import redis
                if redis_url.startswith("redis://"):
                    self._redis_client = redis.Redis.from_url(redis_url, socket_timeout=2)
                else:
                    port = int(os.getenv("REDIS_PORT", 6379))
                    self._redis_client = redis.Redis(host=redis_url, port=port, socket_timeout=2)
                self._redis_client.ping()
                logger.info("Successfully connected to Redis Cooldown Store backend.")
                self.store_type = "redis"
                return
            except Exception as e:
                logger.warning(f"Redis backend init failed ({e}). Falling back.")

        # MongoDB auto-detect
        mongo_uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URL")
        if (self.store_type in ["mongodb", "mongo", "auto"]) and mongo_uri:
            try:
                from pymongo import MongoClient
                client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
                client.admin.command('ping')
                db = client.get_database()
                self._mongo_col = db["cooldown_store"]
                logger.info("Successfully connected to MongoDB Cooldown Store backend.")
                self.store_type = "mongodb"
                return
            except Exception as e:
                logger.warning(f"MongoDB backend init failed ({e}). Falling back.")

        # Kubernetes ConfigMap fallback
        if self.k8s_loaded:
            self.store_type = "configmap"
            logger.info(f"Using Kubernetes ConfigMap ('{CONFIGMAP_NAME}') as Cooldown Store backend.")
        else:
            self.store_type = "memory"
            logger.info("Operating with in-memory Cooldown Store backend.")

    def load_state(self):
        """Loads state from active backend into in-memory cache."""
        try:
            if self.store_type == "configmap" and self.k8s_loaded:
                self._load_from_configmap()
            elif self.store_type == "redis" and self._redis_client:
                self._load_from_redis()
            elif self.store_type == "mongodb" and self._mongo_col:
                self._load_from_mongodb()
        except Exception as e:
            logger.error(f"Error loading cooldown state from {self.store_type}: {e}")

    def save_state(self):
        """Persists in-memory cache to active backend with retries and optimistic locking."""
        try:
            if self.store_type == "configmap" and self.k8s_loaded:
                self._save_to_configmap_with_retry()
            elif self.store_type == "redis" and self._redis_client:
                self._save_to_redis()
            elif self.store_type == "mongodb" and self._mongo_col:
                self._save_to_mongodb()
        except Exception as e:
            logger.error(f"Failed to persist cooldown state to {self.store_type}: {e}")

    # ── ConfigMap Backend with Optimistic Locking & Retries ───────────────────
    def _load_from_configmap(self):
        from kubernetes import client
        v1 = client.CoreV1Api()
        try:
            cm = v1.read_namespaced_config_map(CONFIGMAP_NAME, self.namespace)
            data = cm.data or {}
            self._action_times = json.loads(data.get("action_times", "{}"))
            self._failure_counts = json.loads(data.get("failure_counts", "{}"))
            self._circuit_states = json.loads(data.get("circuit_states", "{}"))
        except Exception:
            # ConfigMap does not exist yet; will be created on first write
            pass

    def _save_to_configmap_with_retry(self, max_retries: int = 3):
        from kubernetes import client
        from kubernetes.client.rest import ApiException

        v1 = client.CoreV1Api()

        data_dict = {
            "action_times": json.dumps(self._action_times),
            "failure_counts": json.dumps(self._failure_counts),
            "circuit_states": json.dumps(self._circuit_states)
        }

        for attempt in range(1, max_retries + 1):
            try:
                # Read current ConfigMap for optimistic concurrency check
                try:
                    cm = v1.read_namespaced_config_map(CONFIGMAP_NAME, self.namespace)
                    cm.data = data_dict
                    v1.replace_namespaced_config_map(CONFIGMAP_NAME, self.namespace, cm)
                    return
                except ApiException as e:
                    if e.status == 404:
                        # Create if missing
                        new_cm = client.V1ConfigMap(
                            metadata=client.V1ObjectMeta(name=CONFIGMAP_NAME, namespace=self.namespace),
                            data=data_dict
                        )
                        v1.create_namespaced_config_map(self.namespace, new_cm)
                        return
                    elif e.status == 409: # Conflict (resourceVersion changed)
                        logger.warn(f"ConfigMap update conflict (attempt {attempt}/{max_retries}). Retrying...")
                        time.sleep(0.1 * attempt)
                        continue
                    else:
                        raise
            except Exception as ex:
                if attempt == max_retries:
                    logger.error(f"ConfigMap save failed after {max_retries} attempts ({ex}). Using in-memory state.")
                else:
                    time.sleep(0.1 * attempt)

    # ── Redis Backend ────────────────────────────────────────────────────────
    def _load_from_redis(self):
        val_times = self._redis_client.get("civicpulse:cooldown:action_times")
        val_failures = self._redis_client.get("civicpulse:cooldown:failure_counts")
        val_circuits = self._redis_client.get("civicpulse:cooldown:circuit_states")

        if val_times: self._action_times = json.loads(val_times.decode('utf-8'))
        if val_failures: self._failure_counts = json.loads(val_failures.decode('utf-8'))
        if val_circuits: self._circuit_states = json.loads(val_circuits.decode('utf-8'))

    def _save_to_redis(self):
        self._redis_client.set("civicpulse:cooldown:action_times", json.dumps(self._action_times))
        self._redis_client.set("civicpulse:cooldown:failure_counts", json.dumps(self._failure_counts))
        self._redis_client.set("civicpulse:cooldown:circuit_states", json.dumps(self._circuit_states))

    # ── MongoDB Backend ──────────────────────────────────────────────────────
    def _load_from_mongodb(self):
        doc = self._mongo_col.find_one({"_id": "global_state"})
        if doc:
            self._action_times = doc.get("action_times", {})
            self._failure_counts = doc.get("failure_counts", {})
            self._circuit_states = doc.get("circuit_states", {})

    def _save_to_mongodb(self):
        self._mongo_col.replace_one(
            {"_id": "global_state"},
            {
                "_id": "global_state",
                "action_times": self._action_times,
                "failure_counts": self._failure_counts,
                "circuit_states": self._circuit_states,
                "updated_at": time.time()
            },
            upsert=True
        )

    # ── Public API Interface ──────────────────────────────────────────────────
    def is_in_cooldown(self, target_key: str) -> Tuple[bool, float]:
        self.load_state()
        last_time = self._action_times.get(target_key, 0.0)
        elapsed = time.time() - last_time
        if elapsed < self.cooldown_seconds:
            remaining = self.cooldown_seconds - elapsed
            return True, remaining
        return False, 0.0

    def record_action_time(self, target_key: str, timestamp: Optional[float] = None):
        t = timestamp or time.time()
        self._action_times[target_key] = t
        self.save_state()

    def get_failure_count(self, target_key: str) -> int:
        self.load_state()
        return self._failure_counts.get(target_key, 0)

    def increment_failure_count(self, target_key: str) -> int:
        self.load_state()
        current = self._failure_counts.get(target_key, 0) + 1
        self._failure_counts[target_key] = current
        self.save_state()
        return current

    def reset_failure_count(self, target_key: str):
        self.load_state()
        if target_key in self._failure_counts:
            self._failure_counts[target_key] = 0
            self.save_state()

    def get_circuit_breaker_state(self, target_key: str) -> str:
        self.load_state()
        return self._circuit_states.get(target_key, "CLOSED")

    def set_circuit_breaker_state(self, target_key: str, state: str):
        self.load_state()
        self._circuit_states[target_key] = state.upper()
        self.save_state()

    def reset_cooldown(self, target_key: Optional[str] = None):
        self.load_state()
        if target_key:
            self._action_times.pop(target_key, None)
            self._failure_counts.pop(target_key, None)
            self._circuit_states.pop(target_key, None)
        else:
            self._action_times.clear()
            self._failure_counts.clear()
            self._circuit_states.clear()
        self.save_state()

    def get_all_states(self) -> Dict[str, Any]:
        self.load_state()
        return {
            "store_type": self.store_type,
            "cooldown_period_seconds": self.cooldown_seconds,
            "action_times": self._action_times,
            "failure_counts": self._failure_counts,
            "circuit_states": self._circuit_states
        }
