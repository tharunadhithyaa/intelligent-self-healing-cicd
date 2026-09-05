# CivicPulseAI — ML Decision Controller Microservice

The **ML Decision Controller** is an intelligent self-healing component of CivicPulseAI that receives real-time JSON alert notifications from **Prometheus Alertmanager**, computes dynamic severity scores, enforces action cooldowns, and executes automated Kubernetes remediation strategies.

---

## 🚀 Key Features

1. **Alertmanager Webhook Integration**: Receives structured JSON payloads from Alertmanager at `/api/v1/alerts`.
2. **Deterministic + Lightweight ML Scoring**: Evaluates alert types and severity levels (`critical`, `warning`, `info`) to compute target scores.
3. **Automated Kubernetes Remediations**:
   - 🔄 **Restart Pods**: Performs rollout restarts on Deployment/StatefulSet workloads when crash loops or probe failures occur (`PodCrashLooping`, `BackendHealthFailing`, `MongoDBDown`).
   - 📈 **Scale Pods**: Dynamically scales up deployment replicas (+1 up to max limit of 3) during CPU/Memory pressure (`HighCpuUsage`, `HighMemoryUsage`).
   - ⏪ **Zero-Commit Rollback**: Automatically patches the Argo CD Application parameters back to the previous stable build tag when critical multi-failure conditions trigger (`ROLLBACK`).
4. **Thrashing Prevention (5-min Cooldown)**: Enforces rate-limiting per target workload so rapid duplicate alerts do not cause cascading restarts or scaling storms.
5. **Observability & Auditability**:
   - `/health`: Health check endpoint for readiness/liveness probes.
   - `/metrics`: Exposes Prometheus metrics (`civicpulse_ml_alert_webhooks_total`, `civicpulse_ml_remediation_actions_total`).
   - `/api/v1/decisions`: Audit trail endpoint returning recent remediation decision logs.

---

## 🛠️ Environment & Deployment

- **Port**: `5000`
- **Framework**: FastAPI + Uvicorn
- **Kubernetes Client**: Official `kubernetes` Python library (in-cluster SA / kubeconfig fallback)
- **Container Registry**: `ghcr.io/tharunadhithyaa/civicpulse-ml-decision-controller:${BUILD_NUMBER}`

---

## 🧪 Local Testing

```bash
cd ml-decision-controller
pip install -r requirements.txt
pytest tests/
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000
```
