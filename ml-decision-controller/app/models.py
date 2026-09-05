"""
CivicPulseAI — ML Decision Controller Data Models
=================================================
Pydantic schemas for Prometheus Alertmanager payloads, remediation decision logs,
and API HTTP response models.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class AlertItem(BaseModel):
    status: str = Field(default="firing", description="Alert status: firing or resolved")
    labels: Dict[str, str] = Field(default_factory=dict, description="Label key-value pairs")
    annotations: Dict[str, str] = Field(default_factory=dict, description="Annotation key-value pairs")
    startsAt: Optional[str] = Field(default=None, description="ISO timestamp when alert started")
    endsAt: Optional[str] = Field(default=None, description="ISO timestamp when alert ended")
    generatorURL: Optional[str] = Field(default=None, description="URL pointing to Prometheus rule")
    fingerprint: Optional[str] = Field(default=None, description="Alert fingerprint")


class AlertManagerPayload(BaseModel):
    version: Optional[str] = "4"
    groupKey: Optional[str] = None
    status: str = Field(default="firing", description="Group status: firing or resolved")
    receiver: Optional[str] = "ml-decision-controller-webhook"
    groupLabels: Dict[str, str] = Field(default_factory=dict)
    commonLabels: Dict[str, str] = Field(default_factory=dict)
    commonAnnotations: Dict[str, str] = Field(default_factory=dict)
    externalURL: Optional[str] = None
    alerts: List[AlertItem] = Field(default_factory=list)


class DecisionLog(BaseModel):
    id: str
    timestamp: str
    alert_names: List[str]
    namespace: str
    target_workload: str
    target_kind: str
    remediation_action: str  # RESTART, SCALE, SCALE_DOWN, ROLLBACK, NONE
    severity_score: float
    reason: str
    execution_success: bool
    escalation_tier: Optional[int] = 1
    circuit_breaker_state: Optional[str] = "CLOSED"
    verification_success: Optional[bool] = True
    verification_details: Optional[Dict[str, Any]] = Field(default_factory=dict)
    predictive_flag: Optional[bool] = False
    duration_seconds: Optional[float] = 0.0
    details: Dict[str, Any] = Field(default_factory=dict)


class DecisionResponse(BaseModel):
    status: str
    total_alerts: int
    firing_alerts: int
    decisions_taken: List[DecisionLog]
