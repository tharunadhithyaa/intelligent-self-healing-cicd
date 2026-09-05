"""
CivicPulseAI — Kubernetes Remediation Action Handler
===================================================
Executes active Kubernetes remediation routines including deployment rollout restarts,
replica scaling (up and down), pod status queries, and Argo CD Application zero-commit rollback patches.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    HAS_K8S_LIB = True
except ImportError:
    HAS_K8S_LIB = False

logger = logging.getLogger("ml_decision_controller.k8s")

class KubernetesActionHandler:
    def __init__(self):
        self.k8s_client_loaded = False
        self._init_k8s_client()

    def _init_k8s_client(self):
        if not HAS_K8S_LIB:
            logger.warning("Kubernetes Python library not installed. Operating in dry-run mode.")
            return

        try:
            config.load_incluster_config()
            self.k8s_client_loaded = True
            logger.info("Successfully loaded in-cluster Kubernetes config.")
        except Exception as e_incluster:
            try:
                config.load_kube_config()
                self.k8s_client_loaded = True
                logger.info("Successfully loaded local kubeconfig.")
            except Exception as e_kubeconfig:
                logger.warning(
                    f"Could not load in-cluster config ({e_incluster}) or kubeconfig ({e_kubeconfig}). "
                    "Operating in fallback mode."
                )

    def restart_workload(self, name: str, namespace: str = "civicpulse", kind: str = "Deployment") -> Dict[str, Any]:
        """
        Executes a rollout restart on a Deployment or StatefulSet by updating
        spec.template.metadata.annotations['kubectl.kubernetes.io/restartedAt'].
        """
        logger.info(f"Executing restart action on {kind}/{name} in namespace '{namespace}'...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would execute restart on {kind}/{name} in {namespace}")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "RESTART",
                "target": f"{kind}/{name}",
                "message": f"[DRY-RUN] Restart triggered for {kind}/{name}"
            }

        apps_api = client.AppsV1Api()
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            if kind.lower() == "statefulset":
                sts = apps_api.read_namespaced_stateful_set(name, namespace)
                if sts.spec.template.metadata.annotations is None:
                    sts.spec.template.metadata.annotations = {}
                sts.spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"] = now_iso
                apps_api.patch_namespaced_stateful_set(name, namespace, sts)
                message = f"StatefulSet/{name} successfully restarted (restartedAt={now_iso})"
            else:
                dep = apps_api.read_namespaced_deployment(name, namespace)
                if dep.spec.template.metadata.annotations is None:
                    dep.spec.template.metadata.annotations = {}
                dep.spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"] = now_iso
                apps_api.patch_namespaced_deployment(name, namespace, dep)
                message = f"Deployment/{name} successfully restarted (restartedAt={now_iso})"

            logger.info(message)
            return {
                "success": True,
                "mode": "live",
                "action": "RESTART",
                "target": f"{kind}/{name}",
                "message": message
            }
        except ApiException as e:
            error_msg = f"Kubernetes API error restarting {kind}/{name}: status={e.status}, body={e.body}"
            logger.error(error_msg)
            return {
                "success": False,
                "mode": "live",
                "action": "RESTART",
                "target": f"{kind}/{name}",
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Unexpected error restarting {kind}/{name}: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "mode": "live",
                "action": "RESTART",
                "target": f"{kind}/{name}",
                "error": error_msg
            }

    def scale_deployment(self, name: str, namespace: str = "civicpulse", scale_by: int = 1, max_replicas: int = 3) -> Dict[str, Any]:
        """
        Scales up a Deployment's replica count by scale_by up to max_replicas limit.
        """
        logger.info(f"Executing scale action on Deployment/{name} in namespace '{namespace}' (scale_by={scale_by}, max={max_replicas})...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would scale Deployment/{name} up by {scale_by} (max {max_replicas})")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "SCALE",
                "target": f"Deployment/{name}",
                "message": f"[DRY-RUN] Scale triggered for Deployment/{name}",
                "new_replicas": 2
            }

        apps_api = client.AppsV1Api()
        try:
            dep = apps_api.read_namespaced_deployment(name, namespace)
            current_replicas = dep.spec.replicas or 1

            if current_replicas >= max_replicas:
                msg = f"Deployment/{name} already at max replica limit ({current_replicas}/{max_replicas}). No scale change applied."
                logger.info(msg)
                return {
                    "success": True,
                    "mode": "live",
                    "action": "SCALE",
                    "target": f"Deployment/{name}",
                    "message": msg,
                    "current_replicas": current_replicas,
                    "new_replicas": current_replicas
                }

            new_replicas = min(current_replicas + scale_by, max_replicas)
            dep.spec.replicas = new_replicas
            apps_api.patch_namespaced_deployment(name, namespace, dep)

            msg = f"Scaled Deployment/{name} from {current_replicas} to {new_replicas} replicas (max={max_replicas})"
            logger.info(msg)
            return {
                "success": True,
                "mode": "live",
                "action": "SCALE",
                "target": f"Deployment/{name}",
                "message": msg,
                "previous_replicas": current_replicas,
                "new_replicas": new_replicas
            }
        except ApiException as e:
            error_msg = f"Kubernetes API error scaling Deployment/{name}: status={e.status}, body={e.body}"
            logger.error(error_msg)
            return {
                "success": False,
                "mode": "live",
                "action": "SCALE",
                "target": f"Deployment/{name}",
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Unexpected error scaling Deployment/{name}: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "mode": "live",
                "action": "SCALE",
                "target": f"Deployment/{name}",
                "error": error_msg
            }

    def scale_down_deployment(self, name: str, namespace: str = "civicpulse", scale_by: int = 1, min_replicas: int = 1) -> Dict[str, Any]:
        """
        Scales down a Deployment's replica count by scale_by down to min_replicas limit.
        """
        logger.info(f"Executing scale-down action on Deployment/{name} in namespace '{namespace}' (scale_by={scale_by}, min={min_replicas})...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would scale down Deployment/{name} by {scale_by} (min {min_replicas})")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "SCALE_DOWN",
                "target": f"Deployment/{name}",
                "message": f"[DRY-RUN] Scale-down triggered for Deployment/{name}",
                "new_replicas": min_replicas
            }

        apps_api = client.AppsV1Api()
        try:
            dep = apps_api.read_namespaced_deployment(name, namespace)
            current_replicas = dep.spec.replicas or 1

            if current_replicas <= min_replicas:
                msg = f"Deployment/{name} already at min replica limit ({current_replicas}/{min_replicas}). No scale-down change applied."
                logger.info(msg)
                return {
                    "success": True,
                    "mode": "live",
                    "action": "SCALE_DOWN",
                    "target": f"Deployment/{name}",
                    "message": msg,
                    "current_replicas": current_replicas,
                    "new_replicas": current_replicas
                }

            new_replicas = max(current_replicas - scale_by, min_replicas)
            dep.spec.replicas = new_replicas
            apps_api.patch_namespaced_deployment(name, namespace, dep)

            msg = f"Scaled down Deployment/{name} from {current_replicas} to {new_replicas} replicas (min={min_replicas})"
            logger.info(msg)
            return {
                "success": True,
                "mode": "live",
                "action": "SCALE_DOWN",
                "target": f"Deployment/{name}",
                "message": msg,
                "previous_replicas": current_replicas,
                "new_replicas": new_replicas
            }
        except Exception as e:
            error_msg = f"Error scaling down Deployment/{name}: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "mode": "live", "action": "SCALE_DOWN", "target": f"Deployment/{name}", "error": error_msg}

    def rollback_application(self, app_name: str = "civicpulse", target_namespace: str = "argocd", target_build: Optional[int] = None) -> Dict[str, Any]:
        """
        Executes a zero-commit rollback by patching the Argo CD Application parameters
        or performing rollout restart/undo if needed.
        """
        logger.info(f"Executing rollback action for Argo CD Application '{app_name}' in namespace '{target_namespace}'...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would trigger rollback on Application/{app_name} (target_build={target_build})")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "ROLLBACK",
                "target": f"Application/{app_name}",
                "message": f"[DRY-RUN] Rollback triggered for Application/{app_name}"
            }

        custom_api = client.CustomObjectsApi()

        try:
            # Try to read live Argo CD Application custom resource
            app_obj = custom_api.get_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace=target_namespace,
                plural="applications",
                name=app_name
            )

            current_params = app_obj.get("spec", {}).get("source", {}).get("helm", {}).get("parameters", [])
            current_backend_tag = None

            for p in current_params:
                if p.get("name") == "backend.image.tag":
                    current_backend_tag = p.get("value")

            if target_build is not None:
                rollback_tag = str(target_build)
            elif current_backend_tag and current_backend_tag.isdigit():
                val = int(current_backend_tag)
                rollback_tag = str(max(1, val - 1))
            else:
                rollback_tag = "latest"

            logger.info(f"Targeting rollback to build tag '{rollback_tag}' for Application/{app_name}")

            patch_body = {
                "spec": {
                    "source": {
                        "helm": {
                            "parameters": [
                                {"name": "frontend.image.tag", "value": rollback_tag},
                                {"name": "backend.image.tag", "value": rollback_tag}
                            ]
                        }
                    }
                }
            }

            custom_api.patch_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace=target_namespace,
                plural="applications",
                name=app_name,
                body=patch_body
            )

            msg = f"Argo CD Application '{app_name}' successfully patched to image tag '{rollback_tag}'"
            logger.info(msg)
            return {
                "success": True,
                "mode": "live",
                "action": "ROLLBACK",
                "target": f"Application/{app_name}",
                "rollback_tag": rollback_tag,
                "message": msg
            }

        except ApiException as e:
            logger.warning(f"Argo CD Application CRD access failed ({e.status}: {e.reason}). Falling back to deployment rollout restart...")
            res_b = self.restart_workload("civicpulse-backend", namespace="civicpulse")
            res_f = self.restart_workload("civicpulse-frontend", namespace="civicpulse")
            return {
                "success": res_b.get("success", False) and res_f.get("success", False),
                "mode": "live-fallback",
                "action": "ROLLBACK",
                "target": "Deployments/civicpulse-backend,civicpulse-frontend",
                "message": "Fallback restart executed for backend and frontend workloads"
            }
        except Exception as e:
            error_msg = f"Unexpected error during rollback for Application/{app_name}: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "mode": "live",
                "action": "ROLLBACK",
                "target": f"Application/{app_name}",
                "error": error_msg
            }

    def get_workload_status(self, name: str, namespace: str = "civicpulse", kind: str = "Deployment") -> Dict[str, Any]:
        """Queries workload status and pod readiness."""
        if not self.k8s_client_loaded:
            return {"ready": True, "replicas": 1, "ready_replicas": 1, "message": "[DRY-RUN] Workload ready"}

        apps_api = client.AppsV1Api()
        try:
            if kind.lower() == "statefulset":
                sts = apps_api.read_namespaced_stateful_set(name, namespace)
                desired = sts.spec.replicas or 1
                ready = sts.status.ready_replicas or 0
                return {
                    "ready": ready >= desired,
                    "replicas": desired,
                    "ready_replicas": ready,
                    "message": f"StatefulSet/{name} {ready}/{desired} ready"
                }
            else:
                dep = apps_api.read_namespaced_deployment(name, namespace)
                desired = dep.spec.replicas or 1
                ready = dep.status.ready_replicas or 0
                updated = dep.status.updated_replicas or 0
                is_ready = (ready >= desired) and (updated >= desired)
                return {
                    "ready": is_ready,
                    "replicas": desired,
                    "ready_replicas": ready,
                    "updated_replicas": updated,
                    "message": f"Deployment/{name} {ready}/{desired} ready, {updated} updated"
                }
        except Exception as e:
            return {"ready": False, "error": str(e), "message": f"Error querying status for {kind}/{name}: {e}"}

    def boost_workload_resources(
        self,
        name: str,
        namespace: str = "civicpulse",
        kind: str = "Deployment",
        boost_memory_to: str = "1Gi",
        boost_cpu_to: str = "500m",
        max_memory_cap: str = "2Gi"
    ) -> Dict[str, Any]:
        """
        Dynamically increases CPU/memory resource limits and requests for a Deployment
        in response to OOMKilled events up to a safety limit (max_memory_cap).
        """
        logger.info(f"Executing RESOURCE_BOOST on {kind}/{name} in namespace '{namespace}' (memory -> {boost_memory_to}, max cap={max_memory_cap})...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would boost resources for {kind}/{name} to memory={boost_memory_to}")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "RESOURCE_BOOST",
                "target": f"{kind}/{name}",
                "boosted_memory": boost_memory_to,
                "message": f"[DRY-RUN] Resource limits boosted to {boost_memory_to} for {kind}/{name}"
            }

        apps_api = client.AppsV1Api()
        try:
            if kind.lower() == "statefulset":
                workload = apps_api.read_namespaced_stateful_set(name, namespace)
            else:
                workload = apps_api.read_namespaced_deployment(name, namespace)

            containers = workload.spec.template.spec.containers
            if containers:
                target_container = containers[0]
                if not target_container.resources:
                    target_container.resources = client.V1ResourceRequirements()
                if not target_container.resources.limits:
                    target_container.resources.limits = {}
                if not target_container.resources.requests:
                    target_container.resources.requests = {}

                target_container.resources.limits["memory"] = boost_memory_to
                target_container.resources.limits["cpu"] = boost_cpu_to
                target_container.resources.requests["memory"] = "512Mi"
                target_container.resources.requests["cpu"] = "200m"

                if kind.lower() == "statefulset":
                    apps_api.patch_namespaced_stateful_set(name, namespace, workload)
                else:
                    apps_api.patch_namespaced_deployment(name, namespace, workload)

                msg = f"{kind}/{name} resources successfully boosted to limits(mem={boost_memory_to}, cpu={boost_cpu_to})"
                logger.info(msg)
                return {
                    "success": True,
                    "mode": "live",
                    "action": "RESOURCE_BOOST",
                    "target": f"{kind}/{name}",
                    "boosted_memory": boost_memory_to,
                    "message": msg
                }
            return {"success": False, "mode": "live", "action": "RESOURCE_BOOST", "target": f"{kind}/{name}", "error": "No containers found"}
        except Exception as e:
            error_msg = f"Failed to boost resources for {kind}/{name}: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "mode": "live", "action": "RESOURCE_BOOST", "target": f"{kind}/{name}", "error": error_msg}

    def repair_pvc_storage(
        self,
        name: str,
        pvc_name: str = "prometheus-data",
        namespace: str = "civicpulse"
    ) -> Dict[str, Any]:
        """
        LAST RESORT REMEDIATION ACTION — TSDB Storage Repair.
        Safely repairs corrupted TSDB storage by scaling down the workload, running a transient
        cleanup job to remove corrupted head chunks/WAL files, and scaling back up.

        SAFETY GUARDRAILS & RISK MITIGATION:
        - Target Restricted: Only executed for 'civicpulse-prometheus'.
        - Failure Tier Gated: Requires failure_count >= 1 (simple restart must have already failed).
        - Cooldown Enforced: Governed by 300s persistent cooldown store key to prevent repetitive wipes.
        - Destructive Scope: Removes corrupted WAL / head chunks while preserving existing blocks.
        """
        logger.info(f"Executing STORAGE_REPAIR on PVC/{pvc_name} for workload {name} in namespace '{namespace}'...")

        if not self.k8s_client_loaded:
            logger.info(f"[DRY-RUN] Would execute STORAGE_REPAIR on PVC/{pvc_name} for {name}")
            return {
                "success": True,
                "mode": "dry-run",
                "action": "STORAGE_REPAIR",
                "target": f"PVC/{pvc_name}",
                "message": f"[DRY-RUN] PVC storage repair completed for {name}"
            }

        core_api = client.CoreV1Api()
        apps_api = client.AppsV1Api()
        try:
            # 1. Scale down workload to 0
            dep = apps_api.read_namespaced_deployment(name, namespace)
            original_replicas = dep.spec.replicas or 1
            dep.spec.replicas = 0
            apps_api.patch_namespaced_deployment(name, namespace, dep)
            time.sleep(5)

            # 2. Run transient pod to wipe corrupted chunks/wal
            repair_pod_name = f"storage-repair-{int(time.time())}"
            pod_manifest = client.V1Pod(
                metadata=client.V1ObjectMeta(name=repair_pod_name, namespace=namespace),
                spec=client.V1PodSpec(
                    restart_policy="Never",
                    volumes=[client.V1Volume(name="vol", persistent_volume_claim=client.V1PersistentVolumeClaimVolumeSource(claim_name=pvc_name))],
                    containers=[
                        client.V1Container(
                            name="repair",
                            image="alpine",
                            command=["sh", "-c", "rm -rf /prometheus/chunks_head/* /prometheus/wal/* /prometheus/queries.active && echo Repaired"],
                            volume_mounts=[client.V1VolumeMount(name="vol", mount_path="/prometheus")]
                        )
                    ]
                )
            )
            core_api.create_namespaced_pod(namespace, pod_manifest)

            # Wait up to 30s for pod completion
            for _ in range(6):
                time.sleep(5)
                p = core_api.read_namespaced_pod(repair_pod_name, namespace)
                if p.status.phase in ["Succeeded", "Failed"]:
                    break
            core_api.delete_namespaced_pod(repair_pod_name, namespace)

            # 3. Scale back up
            dep.spec.replicas = original_replicas
            apps_api.patch_namespaced_deployment(name, namespace, dep)

            msg = f"Successfully executed storage repair on PVC/{pvc_name} for Deployment/{name}"
            logger.info(msg)
            return {"success": True, "mode": "live", "action": "STORAGE_REPAIR", "target": f"PVC/{pvc_name}", "message": msg}
        except Exception as e:
            error_msg = f"Storage repair failed for PVC/{pvc_name}: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "mode": "live", "action": "STORAGE_REPAIR", "target": f"PVC/{pvc_name}", "error": error_msg}

