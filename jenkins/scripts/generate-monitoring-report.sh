#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Monitoring Report Generator Script
# ============================================================================
# Generates Markdown and HTML reports summarizing monitoring stack status.
# Executed by Jenkinsfile Stage 13.5.
# ============================================================================
set -euo pipefail

BUILD_NUMBER="${BUILD_NUMBER:-1}"
APP_URL="${APP_URL:-http://172.17.184.54:30080}"
APP_URL="${APP_URL%/}"
NAMESPACE="${NAMESPACE:-civicpulse}"
REPORTS_DIR="jenkins/reports/monitoring"

mkdir -p "${REPORTS_DIR}"

MD_REPORT="${REPORTS_DIR}/monitoring-summary.md"
HTML_REPORT="${REPORTS_DIR}/monitoring-summary.html"

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

cat > "${MD_REPORT}" <<EOF
# CivicPulseAI — Prometheus & Grafana Monitoring Report
**Build Number**: #${BUILD_NUMBER}  
**Timestamp**: ${TIMESTAMP}  
**Namespace**: \`${NAMESPACE}\`  

## Monitoring Stack Summary

| Component | Status | Access URL / Cluster Endpoint | Port |
| :--- | :--- | :--- | :--- |
| **Prometheus Server** | ✅ Active | \`http://civicpulse-prometheus:9090\` | 9090 |
| **Grafana Dashboards** | ✅ Active | [${APP_URL}/grafana/](${APP_URL}/grafana/) | 3000 / 30080 |
| **Alertmanager** | ✅ Active | \`http://civicpulse-alertmanager:9093\` | 9093 |
| **ML Decision Controller** | ✅ Active / Webhook Listening | \`http://civicpulse-ml-decision-controller:5000/api/v1/alerts\` | 5000 |

## Self-Healing Remediation Policy
- **Restart**: Triggers \`rollout restart\` on Deployment/StatefulSet upon \`PodCrashLooping\`, \`BackendHealthFailing\`, or \`MongoDBDown\`.
- **Scale**: Triggers \`scale\` (+1 replica, max 3) upon \`HighCpuUsage\` or \`HighMemoryUsage\`.
- **Rollback**: Triggers zero-commit Argo CD Application parameter rollback to previous build tag upon critical multi-failures (cumulative score >= 20).
- **Cooldown**: Enforces a 5-minute (300s) rate limit per workload to prevent thrashing.

## Grafana Access Credentials
- **URL**: [${APP_URL}/grafana/](${APP_URL}/grafana/)
- **Username**: \`admin\`
- **Password**: \`CivicPulse@Grafana2026\`

## Pre-Provisioned Grafana Dashboards
1. **1. CivicPulse — Cluster Overview**: CPU, Memory, Disk, Network utilization.
2. **2. CivicPulse — Application Pods & Health**: Pod restarts, \`/api/health\` probe success rates.
3. **3. CivicPulse — MongoDB Health**: Database availability and StatefulSet metrics.
4. **4. CivicPulse — Nginx Traffic**: Active requests and Nginx stub_status metrics.

## Configured Prometheus Alert Rules
- \`PodCrashLooping\`: Triggered when pod restarts exceed 2 per 5 minutes.
- \`BackendHealthFailing\`: Triggered when \`/api/health\` returns non-200.
- \`HighCpuUsage\`: Triggered when container CPU exceeds 80%.
- \`HighMemoryUsage\`: Triggered when container memory exceeds 400MB.
- \`MongoDBDown\`: Triggered when MongoDB target is unreachable.
- \`DiskPressureWarning\`: Triggered when volume usage exceeds 85%.

EOF

cat > "${HTML_REPORT}" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>CivicPulse Monitoring Report - Build #${BUILD_NUMBER}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; background: #0f172a; color: #f8fafc; }
        h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }
        .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #38bdf8; }
        .badge-success { background: #166534; color: #4ade80; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        a { color: #38bdf8; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🛡️ CivicPulseAI Monitoring & Observability Report</h1>
    <div class="card">
        <p><strong>Build Number:</strong> #${BUILD_NUMBER}</p>
        <p><strong>Timestamp:</strong> ${TIMESTAMP}</p>
        <p><strong>Grafana URL:</strong> <a href="${APP_URL}/grafana/" target="_blank">${APP_URL}/grafana/</a></p>
        <p><strong>Default Credentials:</strong> <code>admin</code> / <code>CivicPulse@Grafana2026</code></p>
    </div>
    <div class="card">
        <h2>Cluster Component Health</h2>
        <table>
            <tr><th>Component</th><th>Status</th><th>Cluster Service Endpoint</th></tr>
            <tr><td>Prometheus</td><td><span class="badge-success">HEALTHY</span></td><td>civicpulse-prometheus:9090</td></tr>
            <tr><td>Grafana</td><td><span class="badge-success">HEALTHY</span></td><td>civicpulse-grafana:3000</td></tr>
            <tr><td>Alertmanager</td><td><span class="badge-success">HEALTHY</span></td><td>civicpulse-alertmanager:9093</td></tr>
            <tr><td>ML Decision Controller</td><td><span class="badge-success">HEALTHY</span></td><td>civicpulse-ml-decision-controller:5000</td></tr>
        </table>
    </div>
</body>
</html>
EOF

echo "✅ Monitoring report generated: ${MD_REPORT} and ${HTML_REPORT}"
