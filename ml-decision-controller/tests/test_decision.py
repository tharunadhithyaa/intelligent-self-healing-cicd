"""
CivicPulseAI — ML Decision Controller Extended Test Suite
=========================================================
Tests severity scoring computation, target workload mapping, persistent cooldown & circuit breaker state,
multi-tier escalation policies, linear regression predictor, and Alertmanager webhook processing.
"""

import pytest
import time
from app.models import AlertManagerPayload, AlertItem
from app.decision_engine import MLDecisionEngine
from app.kubernetes.actions import KubernetesActionHandler
from app.cooldown_store import PersistentCooldownStore
from app.predictor import ResourcePredictor

@pytest.fixture
def mock_k8s_handler():
    handler = KubernetesActionHandler()
    handler.k8s_client_loaded = False
    return handler

@pytest.fixture
def cooldown_store():
    store = PersistentCooldownStore(k8s_loaded=False)
    store.reset_cooldown()
    return store

@pytest.fixture
def engine(mock_k8s_handler, cooldown_store):
    return MLDecisionEngine(k8s_handler=mock_k8s_handler, cooldown_store=cooldown_store)

def test_alert_severity_scoring(engine):
    alert_crash = AlertItem(status="firing", labels={"alertname": "PodCrashLooping", "severity": "critical"})
    alert_cpu = AlertItem(status="firing", labels={"alertname": "HighCpuUsage", "severity": "warning"})
    alert_oom = AlertItem(status="firing", labels={"alertname": "OOMKilled", "severity": "critical"})

    assert engine.compute_alert_score(alert_crash) == 10.0
    assert engine.compute_alert_score(alert_cpu) == 6.0
    assert engine.compute_alert_score(alert_oom) == 12.0

def test_expanded_target_scope_mapping(engine):
    payload_prom = AlertManagerPayload(
        status="firing",
        alerts=[AlertItem(status="firing", labels={"alertname": "PrometheusCrashLooping", "severity": "critical"})]
    )
    dec_prom = engine.process_alerts(payload_prom)
    assert dec_prom[0].target_workload == "civicpulse-prometheus"
    assert dec_prom[0].remediation_action == "RESTART"

    engine.cooldown_store.reset_cooldown()

    payload_am = AlertManagerPayload(
        status="firing",
        alerts=[AlertItem(status="firing", labels={"alertname": "AlertmanagerDown", "severity": "critical"})]
    )
    dec_am = engine.process_alerts(payload_am)
    assert dec_am[0].target_workload == "civicpulse-alertmanager"
    assert dec_am[0].remediation_action == "RESTART"

def test_multi_tier_escalation_and_circuit_breaker(engine):
    target = "civicpulse-backend"
    engine.cooldown_store.reset_cooldown()

    payload_crash = AlertManagerPayload(
        status="firing",
        alerts=[AlertItem(status="firing", labels={"alertname": "PodCrashLooping", "severity": "critical"})]
    )

    # 1st execution -> Tier 1 (RESTART)
    d1 = engine.process_alerts(payload_crash)
    assert d1[0].remediation_action == "RESTART"
    assert d1[0].escalation_tier == 1

    # Simulate failure on tier 1
    engine.cooldown_store.reset_cooldown("civicpulse-backend:SCALE")
    engine.cooldown_store.reset_cooldown("civicpulse-backend:RESTART")
    engine.cooldown_store.increment_failure_count(target) # failures = 1

    # 2nd execution -> Tier 2 (SCALE)
    d2 = engine.process_alerts(payload_crash)
    assert d2[0].remediation_action == "SCALE"

    # Simulate 3 consecutive failures to reach circuit breaker threshold
    engine.cooldown_store.reset_cooldown("civicpulse-backend:RESTART")
    engine.cooldown_store.reset_cooldown("civicpulse-backend:SCALE")
    engine.cooldown_store.increment_failure_count(target) # 1
    engine.cooldown_store.increment_failure_count(target) # 2
    engine.cooldown_store.increment_failure_count(target) # 3

    # 4th execution -> Circuit Breaker Trips (OPEN)
    d4 = engine.process_alerts(payload_crash)
    assert d4[0].circuit_breaker_state == "OPEN"
    assert d4[0].remediation_action == "NONE"


def test_linear_predictor():
    predictor = ResourcePredictor()
    # Mock data points with clear rising trend
    points = [(100.0 + i*30, 0.5 + i*0.05) for i in range(10)]
    curr, pred, slope = predictor.fit_linear_trend(points, forecast_seconds=300)

    assert len(points) >= 5
    assert slope > 0
    assert pred > curr

def test_broader_alerts_imagepull_rollback(engine):
    engine.cooldown_store.reset_cooldown()
    payload = AlertManagerPayload(
        status="firing",
        alerts=[AlertItem(status="firing", labels={"alertname": "ImagePullBackOff", "severity": "critical"})]
    )

    decisions = engine.process_alerts(payload)
    assert decisions[0].remediation_action == "ROLLBACK"

def test_imagepull_non_remediable_after_failure(engine):
    target = "civicpulse-backend"
    engine.cooldown_store.reset_cooldown()
    engine.cooldown_store.increment_failure_count(target) # failure_count = 1

    payload = AlertManagerPayload(
        status="firing",
        alerts=[AlertItem(status="firing", labels={"alertname": "ImagePullBackOff", "severity": "critical"})]
    )

    decisions = engine.process_alerts(payload)
    assert decisions[0].remediation_action == "NONE"
    assert decisions[0].circuit_breaker_state == "OPEN"

def test_statefulset_resource_boost(mock_k8s_handler):
    res = mock_k8s_handler.boost_workload_resources(
        name="civicpulse-mongodb",
        namespace="civicpulse",
        kind="StatefulSet",
        boost_memory_to="1Gi"
    )
    assert res["success"] is True
    assert res["target"] == "StatefulSet/civicpulse-mongodb"

