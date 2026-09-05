"""
CivicPulseAI — Decision Engine & Remediation Controller
=========================================================
Executes autonomous self-healing via a dual-path control model:

1. REACTIVE HEALING PATH:
   - Dynamic Alert Severity Scoring (LEVEL_SCORES + ALERT_SEVERITY_SCORES).
   - Target Workload Resolution across microservice deployments.
   - Multi-Tier Escalation State Machine (RESTART -> SCALE -> ROLLBACK) based on failure counts.
   - Circuit Breaker Protection (pauses actions after max consecutive failures).
   - Closed-Loop Runtime Verification (Kubernetes rollout status & endpoint HTTP health probes).

2. PREDICTIVE HEALING PATH:
   - Evaluated when no critical reactive alerts are firing.
   - Queries Prometheus metric time-series and applies Linear Regression forecasting (NumPy/SciPy).
   - Triggers proactive workload scaling BEFORE hard alert thresholds are breached.
"""

import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Any

from app.models import AlertManagerPayload, AlertItem, DecisionLog
from app.kubernetes.actions import KubernetesActionHandler
from app.cooldown_store import PersistentCooldownStore
from app.verifier import ClosedLoopVerifier
from app.predictor import ResourcePredictor

logger = logging.getLogger("ml_decision_controller.engine")

# Severity Scoring Map
ALERT_SEVERITY_SCORES = {
    # Critical Workload Alerts
    "PodCrashLooping": 10.0,
    "BackendHealthFailing": 10.0,
    "MongoDBDown": 12.0,
    "PrometheusCrashLooping": 10.0,
    "AlertmanagerDown": 10.0,
    "GrafanaUnhealthy": 8.0,
    "NginxUnhealthy": 8.0,

    # Broader Infrastructure Alerts
    "OOMKilled": 12.0,
    "ImagePullBackOff": 15.0,
    "ErrImagePull": 15.0,
    "NodeDiskPressure": 10.0,
    "ReadinessProbeFlapping": 8.0,
    "ConfigMapSecretFailure": 8.0,

    # Resource Warnings
    "HighCpuUsage": 6.0,
    "HighMemoryUsage": 6.0,
    "DiskPressureWarning": 4.0,
}

# Base Severity Level Scores
LEVEL_SCORES = {
    "critical": 10.0,
    "warning": 5.0,
    "info": 2.0,
}

CIRCUIT_BREAKER_MAX_FAILURES = int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", "3"))

class MLDecisionEngine:
    def __init__(
        self,
        k8s_handler: Optional[KubernetesActionHandler] = None,
        cooldown_store: Optional[PersistentCooldownStore] = None,
        verifier: Optional[ClosedLoopVerifier] = None,
        predictor: Optional[ResourcePredictor] = None
    ):
        self.k8s_handler = k8s_handler or KubernetesActionHandler()
        self.cooldown_store = cooldown_store or PersistentCooldownStore(k8s_loaded=self.k8s_handler.k8s_client_loaded)
        self.verifier = verifier or ClosedLoopVerifier(k8s_handler=self.k8s_handler)
        self.predictor = predictor or ResourcePredictor()
        self.decision_history: List[DecisionLog] = []

        # Global safety flags
        self.dry_run = os.getenv("HEALING_DRY_RUN", "false").lower() in ["true", "1", "yes"]
        self.allow_auto_rollback = os.getenv("HEALING_ALLOW_AUTO_ROLLBACK", "true").lower() in ["true", "1", "yes"]

    def compute_alert_score(self, alert: AlertItem) -> float:
        alert_name = alert.labels.get("alertname", "UnknownAlert")
        severity_label = alert.labels.get("severity", "warning").lower()

        base_score = LEVEL_SCORES.get(severity_label, 5.0)
        specific_score = ALERT_SEVERITY_SCORES.get(alert_name, base_score)

        return max(base_score, specific_score)

    def _resolve_target_workload(self, alert_names: List[str], firing_alerts: List[AlertItem]) -> Tuple[str, str]:
        """
        Maps firing alerts to specific target workload and Kubernetes resource kind.
        Supported target workloads:
        - civicpulse-backend (Deployment)
        - civicpulse-mongodb (StatefulSet)
        - civicpulse-prometheus (Deployment)
        - civicpulse-alertmanager (Deployment)
        - civicpulse-grafana (Deployment)
        - civicpulse-nginx (Deployment)
        """
        # Inspect alert labels for explicit service/component label
        for alert in firing_alerts:
            comp = (
                alert.labels.get("app.kubernetes.io/component") or
                alert.labels.get("job") or
                alert.labels.get("service") or
                alert.labels.get("pod") or
                alert.labels.get("container") or
                alert.labels.get("workload") or ""
            ).lower()

            if "prometheus" in comp: return "civicpulse-prometheus", "Deployment"
            if "alertmanager" in comp: return "civicpulse-alertmanager", "Deployment"
            if "grafana" in comp: return "civicpulse-grafana", "Deployment"
            if "nginx" in comp: return "civicpulse-nginx", "Deployment"
            if "mongodb" in comp: return "civicpulse-mongodb", "StatefulSet"
            if "frontend" in comp: return "civicpulse-frontend", "Deployment"
            if "ml-decision-controller" in comp or "decision" in comp: return "civicpulse-ml-decision-controller", "Deployment"
            if "backend" in comp: return "civicpulse-backend", "Deployment"

        # Match alert names
        if "MongoDBDown" in alert_names:
            return "civicpulse-mongodb", "StatefulSet"
        elif "PrometheusCrashLooping" in alert_names:
            return "civicpulse-prometheus", "Deployment"
        elif "AlertmanagerDown" in alert_names:
            return "civicpulse-alertmanager", "Deployment"
        elif "GrafanaUnhealthy" in alert_names:
            return "civicpulse-grafana", "Deployment"
        elif "NginxUnhealthy" in alert_names:
            return "civicpulse-nginx", "Deployment"
        elif "FrontendUnhealthy" in alert_names:
            return "civicpulse-frontend", "Deployment"
        elif "MLControllerUnhealthy" in alert_names:
            return "civicpulse-ml-decision-controller", "Deployment"
        else:
            return "civicpulse-backend", "Deployment"

    def process_alerts(self, payload: AlertManagerPayload) -> List[DecisionLog]:
        firing_alerts = [a for a in payload.alerts if a.status.lower() == "firing"]
        if not firing_alerts:
            logger.info("No active firing alerts in payload. Checking proactive predictor...")
            # Check predictive scaling if no active alert
            pred_res = self.predictor.evaluate_predictive_scaling(target_workload="civicpulse-backend")
            if pred_res:
                return [self._execute_predictive_action(pred_res)]
            return []

        alert_names = [a.labels.get("alertname", "UnknownAlert") for a in firing_alerts]
        total_score = sum(self.compute_alert_score(a) for a in firing_alerts)
        critical_count = sum(1 for a in firing_alerts if a.labels.get("severity", "").lower() == "critical")

        logger.info(
            f"Processing {len(firing_alerts)} firing alert(s): {alert_names} | "
            f"Total Severity Score: {total_score} | Critical Alerts Count: {critical_count}"
        )

        decisions: List[DecisionLog] = []

        target_workload, target_kind = self._resolve_target_workload(alert_names, firing_alerts)
        target_key = f"{target_workload}"

        # Check Circuit Breaker State & Failure Count
        failure_count = self.cooldown_store.get_failure_count(target_key)
        if failure_count >= CIRCUIT_BREAKER_MAX_FAILURES:
            self.cooldown_store.set_circuit_breaker_state(target_key, "OPEN")

        circuit_state = self.cooldown_store.get_circuit_breaker_state(target_key)

        if circuit_state == "OPEN":
            reason = f"Circuit Breaker OPEN for {target_workload} after {failure_count} consecutive failed healings. Pausing automatic actions."
            logger.warning(reason)
            log_entry = self._create_decision_log(
                alert_names=alert_names,
                namespace="civicpulse",
                target_workload=target_workload,
                target_kind=target_kind,
                remediation_action="NONE",
                severity_score=total_score,
                reason=reason,
                execution_success=False,
                escalation_tier=failure_count,
                circuit_breaker_state="OPEN",
                details={"circuit_breaker_active": True}
            )
            self._record_decision(log_entry)
            return [log_entry]


        # Determine Remediation Action based on Escalation Tier & Alert Types
        is_oom = "OOMKilled" in alert_names
        is_prom_storage_issue = ("PrometheusCrashLooping" in alert_names) and (failure_count >= 1)
        is_resource_pressure = any(n in ["HighCpuUsage", "HighMemoryUsage", "NodeDiskPressure"] for n in alert_names)
        is_invalid_image = any(n in ["ImagePullBackOff", "ErrImagePull"] for n in alert_names)
        is_rollback_level = (total_score >= 20.0 or critical_count > 1 or "RollbackRequired" in alert_names or is_invalid_image)

        # Non-remediable image pull error guard (if failure count >= 1 or rollback already failed)
        if is_invalid_image and failure_count >= 1:
            self.cooldown_store.set_circuit_breaker_state(target_key, "OPEN")
            reason = f"Image pull error (ImagePullBackOff / ErrImagePull) on {target_workload} cannot be resolved by automatic pod restarts. Opening circuit breaker."
            logger.error(reason)
            log_entry = self._create_decision_log(
                alert_names=alert_names,
                namespace="civicpulse",
                target_workload=target_workload,
                target_kind=target_kind,
                remediation_action="NONE",
                severity_score=total_score,
                reason=reason,
                execution_success=False,
                escalation_tier=failure_count,
                circuit_breaker_state="OPEN",
                details={"non_remediable_image_pull": True}
            )
            self._record_decision(log_entry)
            return [log_entry]

        # Multi-Tier Escalation Mapping
        if failure_count >= CIRCUIT_BREAKER_MAX_FAILURES:
            # Escalated past max failures -> Open circuit breaker
            self.cooldown_store.set_circuit_breaker_state(target_key, "OPEN")
            reason = f"Maximum failure limit ({CIRCUIT_BREAKER_MAX_FAILURES}) reached for {target_workload}. Opening circuit breaker."
            logger.error(reason)
            log_entry = self._create_decision_log(
                alert_names=alert_names,
                namespace="civicpulse",
                target_workload=target_workload,
                target_kind=target_kind,
                remediation_action="NONE",
                severity_score=total_score,
                reason=reason,
                execution_success=False,
                escalation_tier=failure_count,
                circuit_breaker_state="OPEN",
                details={"circuit_breaker_tripped": True}
            )
            self._record_decision(log_entry)
            return [log_entry]

        elif is_oom:
            # Automatic resource boost for OOMKilled events up to 1Gi/2Gi
            action = "RESOURCE_BOOST"
            target_key_action = f"{target_key}:RESOURCE_BOOST"
        elif is_prom_storage_issue and target_workload == "civicpulse-prometheus":
            # Automatic TSDB storage repair for persistent Prometheus CrashLooping
            action = "STORAGE_REPAIR"
            target_key_action = f"{target_key}:STORAGE_REPAIR"
        elif failure_count == 2 or (is_rollback_level and self.allow_auto_rollback):
            # Tier 3 / Rollback Condition
            action = "ROLLBACK"
            target_key_action = f"{target_key}:ROLLBACK"
        elif failure_count == 1 or (is_resource_pressure and target_kind == "Deployment"):
            # Tier 2 / Scale Condition
            action = "SCALE"
            target_key_action = f"{target_key}:SCALE"
        else:
            # Tier 1 / Default Restart Condition
            action = "RESTART"
            target_key_action = f"{target_key}:RESTART"

        # Check Persistent Cooldown
        in_cooldown, remaining = self.cooldown_store.is_in_cooldown(target_key_action)
        if in_cooldown:
            reason = f"Alert(s) {alert_names} require {action} of {target_kind}/{target_workload}, but action is in COOLDOWN ({remaining:.1f}s remaining)."
            logger.info(reason)
            log_entry = self._create_decision_log(
                alert_names=alert_names,
                namespace="civicpulse",
                target_workload=target_workload,
                target_kind=target_kind,
                remediation_action=action,
                severity_score=total_score,
                reason=reason,
                execution_success=False,
                escalation_tier=failure_count + 1,
                circuit_breaker_state="CLOSED",
                details={"cooldown_active": True, "remaining_seconds": remaining}
            )
            self._record_decision(log_entry)
            return [log_entry]

        # Execute Remediation Action
        logger.info(f"[HEALING] Executing {action} on {target_kind}/{target_workload} (Dry-Run: {self.dry_run}, Tier: {failure_count + 1})...")
        start_exec_time = time.time()

        if self.dry_run:
            exec_res = {
                "success": True,
                "mode": "dry-run",
                "action": action,
                "target": f"{target_kind}/{target_workload}",
                "message": f"[DRY-RUN] Simulated {action} on {target_workload}"
            }
        else:
            if action == "RESOURCE_BOOST":
                exec_res = self.k8s_handler.boost_workload_resources(target_workload, namespace="civicpulse", kind=target_kind, boost_memory_to="1Gi")
            elif action == "STORAGE_REPAIR":
                exec_res = self.k8s_handler.repair_pvc_storage(target_workload, pvc_name="prometheus-data", namespace="civicpulse")
            elif action == "ROLLBACK":
                exec_res = self.k8s_handler.rollback_application(app_name="civicpulse", target_namespace="argocd")
            elif action == "SCALE":
                exec_res = self.k8s_handler.scale_deployment(target_workload, namespace="civicpulse", scale_by=1, max_replicas=3)
            else: # RESTART
                exec_res = self.k8s_handler.restart_workload(target_workload, namespace="civicpulse", kind=target_kind)

        self.cooldown_store.record_action_time(target_key_action)

        # Closed-Loop Runtime Verification
        ver_success, ver_msg, ver_duration = self.verifier.verify_remediation(
            action=action,
            target_workload=target_workload,
            target_kind=target_kind,
            namespace="civicpulse"
        )
        total_duration = round(time.time() - start_exec_time, 2)

        if ver_success and exec_res.get("success", False):
            # Verification Passed -> Reset failure count
            self.cooldown_store.reset_failure_count(target_key)
            reason = f"Successfully executed {action} for {target_kind}/{target_workload}. Verification: {ver_msg}"
            exec_ok = True
        else:
            # Verification Failed -> Increment failure count for escalation
            new_failures = self.cooldown_store.increment_failure_count(target_key)
            if new_failures >= CIRCUIT_BREAKER_MAX_FAILURES:
                self.cooldown_store.set_circuit_breaker_state(target_key, "OPEN")
                circuit_state = "OPEN"
            reason = f"Executed {action} for {target_kind}/{target_workload}, but closed-loop verification failed ({ver_msg}). Escalating failure count to {new_failures}."
            exec_ok = False

        log_entry = self._create_decision_log(
            alert_names=alert_names,
            namespace="civicpulse",
            target_workload=target_workload,
            target_kind=target_kind,
            remediation_action=action,
            severity_score=total_score,
            reason=reason,
            execution_success=exec_ok,
            escalation_tier=failure_count + 1,
            circuit_breaker_state=circuit_state,
            verification_success=ver_success,
            verification_details={"message": ver_msg, "duration_seconds": ver_duration},
            duration_seconds=total_duration,
            details=exec_res
        )

        self._record_decision(log_entry)
        decisions.append(log_entry)
        return decisions

    def _execute_predictive_action(self, pred_res: Dict[str, Any]) -> DecisionLog:
        action = pred_res.get("action", "SCALE")
        target_workload = "civicpulse-backend"
        target_kind = "Deployment"
        target_key_action = f"{target_workload}:{action}"

        in_cooldown, remaining = self.cooldown_store.is_in_cooldown(target_key_action)
        if in_cooldown:
            return self._create_decision_log(
                alert_names=["PredictiveScalingTrigger"],
                namespace="civicpulse",
                target_workload=target_workload,
                target_kind=target_kind,
                remediation_action=action,
                severity_score=5.0,
                reason=f"Predictive trigger proposed {action}, but action is in COOLDOWN ({remaining:.1f}s remaining).",
                execution_success=False,
                predictive_flag=True,
                details={"cooldown_active": True}
            )

        start_time = time.time()
        if action == "SCALE_DOWN":
            exec_res = self.k8s_handler.scale_down_deployment(target_workload, namespace="civicpulse", scale_by=1, min_replicas=1)
        else:
            exec_res = self.k8s_handler.scale_deployment(target_workload, namespace="civicpulse", scale_by=1, max_replicas=3)

        self.cooldown_store.record_action_time(target_key_action)
        ver_success, ver_msg, ver_duration = self.verifier.verify_remediation(action, target_workload, target_kind)
        duration = round(time.time() - start_time, 2)

        log_entry = self._create_decision_log(
            alert_names=["PredictiveScalingTrigger"],
            namespace="civicpulse",
            target_workload=target_workload,
            target_kind=target_kind,
            remediation_action=action,
            severity_score=5.0,
            reason=f"Predictive Engine triggered proactive {action}. Details: {pred_res.get('reason')}",
            execution_success=exec_res.get("success", False) and ver_success,
            predictive_flag=True,
            verification_success=ver_success,
            duration_seconds=duration,
            details=exec_res
        )
        self._record_decision(log_entry)
        return log_entry

    def _record_decision(self, log_entry: DecisionLog):
        self.decision_history.append(log_entry)
        if len(self.decision_history) > 100:
            self.decision_history.pop(0)

    def _create_decision_log(
        self,
        alert_names: List[str],
        namespace: str,
        target_workload: str,
        target_kind: str,
        remediation_action: str,
        severity_score: float,
        reason: str,
        execution_success: bool,
        escalation_tier: int = 1,
        circuit_breaker_state: str = "CLOSED",
        verification_success: bool = True,
        verification_details: Optional[Dict[str, Any]] = None,
        predictive_flag: bool = False,
        duration_seconds: float = 0.0,
        details: Optional[Dict[str, Any]] = None
    ) -> DecisionLog:
        return DecisionLog(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            alert_names=alert_names,
            namespace=namespace,
            target_workload=target_workload,
            target_kind=target_kind,
            remediation_action=remediation_action,
            severity_score=severity_score,
            reason=reason,
            execution_success=execution_success,
            escalation_tier=escalation_tier,
            circuit_breaker_state=circuit_breaker_state,
            verification_success=verification_success,
            verification_details=verification_details or {},
            predictive_flag=predictive_flag,
            duration_seconds=duration_seconds,
            details=details or {}
        )

    def get_recent_decisions(self, limit: int = 20) -> List[DecisionLog]:
        return self.decision_history[-limit:]
