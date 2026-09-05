"""
CivicPulseAI — ML Decision Controller Main API Server
=====================================================
FastAPI application handling Alertmanager webhooks, health probes, Prometheus metrics,
closed-loop verification, predictive scaling evaluations, and audit logging.
"""

import logging
import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Response, status, Request
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

from app.models import AlertManagerPayload, DecisionResponse, DecisionLog
from app.decision_engine import MLDecisionEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("ml_decision_controller.main")

app = FastAPI(
    title="CivicPulseAI ML Decision Controller",
    description="Intelligent Self-Healing Decision Controller microservice with predictive monitoring, persistent cooldowns, and closed-loop verification.",
    version="2.0.0"
)

# Prometheus Metrics
ALERT_WEBHOOK_REQUESTS = Counter(
    "civicpulse_ml_alert_webhooks_total",
    "Total Alertmanager webhook calls received"
)
DECISION_ACTIONS_TOTAL = Counter(
    "civicpulse_ml_remediation_actions_total",
    "Total remediation actions executed by type",
    ["action", "target_workload", "status", "result"]
)
DECISION_LATENCY_HISTOGRAM = Histogram(
    "civicpulse_ml_decision_processing_seconds",
    "Time spent processing Alertmanager webhook payload"
)
HEALING_DURATION_HISTOGRAM = Histogram(
    "civicpulse_ml_healing_duration_seconds",
    "End-to-end healing latency including remediation and closed-loop verification"
)
CIRCUIT_BREAKER_STATUS_GAUGE = Gauge(
    "civicpulse_ml_circuit_breaker_status",
    "Circuit breaker state per target workload (0=CLOSED, 1=OPEN)",
    ["target_workload"]
)

# Pre-initialize metric gauges and counters for default workloads so /metrics serves complete telemetry from startup
for target in ["civicpulse-backend", "civicpulse-frontend", "civicpulse-nginx", "civicpulse-mongodb"]:
    CIRCUIT_BREAKER_STATUS_GAUGE.labels(target_workload=target).set(0.0)

for action_type in ["RESTART", "SCALE", "ROLLBACK"]:
    DECISION_ACTIONS_TOTAL.labels(action=action_type, target_workload="civicpulse-backend", status="success", result="success").inc(0)

engine = MLDecisionEngine()

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Service health check probe."""
    cooldown_states = engine.cooldown_store.get_all_states()
    return {
        "status": "healthy",
        "service": "civicpulse-ml-decision-controller",
        "version": "2.0.0",
        "k8s_connected": engine.k8s_handler.k8s_client_loaded,
        "dry_run": engine.dry_run,
        "cooldown_store_backend": cooldown_states.get("store_type", "unknown")
    }

@app.get("/metrics")
def get_metrics():
    """Exposes Prometheus format metrics for scrape targets."""
    # Update gauges dynamically before scrape
    all_states = engine.cooldown_store.get_all_states()
    circuits = all_states.get("circuit_states", {})
    for target, state in circuits.items():
        val = 1.0 if state == "OPEN" else 0.0
        CIRCUIT_BREAKER_STATUS_GAUGE.labels(target_workload=target).set(val)

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/api/v1/alerts", response_model=DecisionResponse, status_code=status.HTTP_200_OK)
@app.post("/api/v1/webhook", response_model=DecisionResponse, status_code=status.HTTP_200_OK)
@DECISION_LATENCY_HISTOGRAM.time()
async def receive_alerts(payload: AlertManagerPayload, request: Request):
    """
    Alertmanager Webhook Receiver Endpoint.
    Evaluates alerts, executes remediations with closed-loop verification, and logs audit trail.
    """
    ALERT_WEBHOOK_REQUESTS.inc()
    logger.info(f"Received Alertmanager webhook payload (Status: {payload.status}, Alerts count: {len(payload.alerts)})")

    decisions = engine.process_alerts(payload)

    for d in decisions:
        result_str = "success" if d.execution_success else ("cooldown_blocked" if d.details.get("cooldown_active") else "failed")
        DECISION_ACTIONS_TOTAL.labels(
            action=d.remediation_action,
            target_workload=d.target_workload,
            status="success" if d.execution_success else "failed",
            result=result_str
        ).inc()

        if d.duration_seconds and d.duration_seconds > 0:
            HEALING_DURATION_HISTOGRAM.observe(d.duration_seconds)

    firing_count = sum(1 for a in payload.alerts if a.status.lower() == "firing")

    return DecisionResponse(
        status="processed",
        total_alerts=len(payload.alerts),
        firing_alerts=firing_count,
        decisions_taken=decisions
    )

@app.post("/api/v1/predict")
def run_predictive_evaluation(target_workload: str = "civicpulse-backend"):
    """Manually triggers predictive resource scaling evaluation."""
    res = engine.predictor.evaluate_predictive_scaling(target_workload=target_workload)
    if res:
        log_entry = engine._execute_predictive_action(res)
        return {"status": "action_triggered", "decision": log_entry}
    return {"status": "no_action", "message": "Predictive forecast within normal bounds."}

@app.get("/api/v1/decisions", response_model=List[DecisionLog])
def list_recent_decisions(limit: int = 20):
    """Returns recent remediation decision audit logs."""
    return engine.get_recent_decisions(limit=limit)

@app.get("/api/v1/cooldown/state")
def get_cooldown_state():
    """Returns current persistent cooldown & circuit breaker store state."""
    return engine.cooldown_store.get_all_states()

@app.post("/api/v1/reset-cooldown")
async def reset_cooldown(request: Request, target_key: Optional[str] = None):
    """Resets active action cooldown timers for test verification suites."""
    key_to_reset = target_key
    if not key_to_reset:
        try:
            body = await request.json()
            if isinstance(body, dict):
                key_to_reset = body.get("target_key")
        except Exception:
            pass

    engine.cooldown_store.reset_cooldown(key_to_reset)
    msg = f"Cooldown timer for '{key_to_reset}' cleared." if key_to_reset else "All action cooldown timers cleared."
    return {"status": "cooldown_reset", "message": msg}

@app.post("/api/v1/circuit-breaker/reset")
def reset_circuit_breaker(target_workload: str = "civicpulse-backend"):
    """Resets circuit breaker state to CLOSED for specified target workload."""
    engine.cooldown_store.set_circuit_breaker_state(target_workload, "CLOSED")
    engine.cooldown_store.reset_failure_count(target_workload)
    return {"status": "circuit_breaker_reset", "target": target_workload, "state": "CLOSED"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
