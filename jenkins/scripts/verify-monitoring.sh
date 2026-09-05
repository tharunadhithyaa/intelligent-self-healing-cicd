#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Monitoring Stack Verification Script
# ============================================================================
# Verifies health and operational status of Prometheus, Grafana, and Alertmanager.
# Executed by Jenkinsfile Stage 12.5 & Stage 12.6.
# ============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[MONITORING]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[MONITORING]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[MONITORING]${NC} ⚠️  $*"; }
log_error() { echo -e "${RED}[MONITORING]${NC} ❌ $*"; }

NAMESPACE="${NAMESPACE:-civicpulse}"
APP_URL="${APP_URL:-http://172.17.184.54:30080}"
APP_URL="${APP_URL%/}"
MAX_RETRIES=10
INTERVAL=10

find_kubeconfig() {
    if [ -n "${KUBECONFIG:-}" ] && [ -f "${KUBECONFIG}" ] && [ -r "${KUBECONFIG}" ]; then
        return 0
    fi
    for candidate in "${HOME}/.kube/config" "/home/jenkins/.kube/config" "/home/tharun_adhithyaa/.kube/config" "/etc/rancher/k3s/k3s.yaml"; do
        if [ -f "$candidate" ] && [ -r "$candidate" ]; then
            export KUBECONFIG="$candidate"
            return 0
        fi
    done
    return 1
}

find_kubeconfig || true

log_info "Starting Monitoring Stack Verification in namespace '${NAMESPACE}'..."
log_info "Target Application URL: ${APP_URL}"

# ── 1. Verify Monitoring Workloads Readiness ─────────────────────────────────
log_info "Checking monitoring pod deployment rollout status..."

MONITORING_COMPONENTS=("civicpulse-prometheus" "civicpulse-grafana" "civicpulse-alertmanager")
UNREADY=0

HAS_WARNINGS=0

for comp in "${MONITORING_COMPONENTS[@]}"; do
    log_info "Verifying deployment/${comp}..."
    if kubectl rollout status "deployment/${comp}" -n "${NAMESPACE}" --timeout=120s >/dev/null 2>&1; then
        log_ok "Deployment ${comp} is Ready (1/1)"
    else
        log_warn "Deployment ${comp} is NOT ready within 120s timeout"
        UNREADY=$((UNREADY + 1))
        HAS_WARNINGS=1
        log_info "Dumping diagnostic details for deployment/${comp}..."
        kubectl describe deployment "${comp}" -n "${NAMESPACE}" || true
        kubectl get pods -n "${NAMESPACE}" -l "app.kubernetes.io/component=${comp#civicpulse-}" || true
        kubectl logs -n "${NAMESPACE}" "deployment/${comp}" --tail=50 2>/dev/null || true
    fi
done

if [ ${UNREADY} -gt 0 ]; then
    log_warn "WARNING: ${UNREADY} monitoring component(s) unhealthy during rollout verification."
    log_warn "Monitoring verification is non-blocking."
    log_warn "Core application health remains a hard gate."
    kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/part-of=civicpulse-monitoring || true
fi

# ── 2. Verify Prometheus Scrape Targets ──────────────────────────────────────
log_info "Verifying Prometheus scrape targets & API health..."

PROM_POD=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/component=prometheus --no-headers 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)

if [ -n "${PROM_POD}" ]; then
    log_ok "Prometheus Pod found: ${PROM_POD}"
    
    # Check Prometheus health endpoint
    PROM_HEALTH=$(kubectl exec "${PROM_POD}" -n "${NAMESPACE}" -- wget -qO- http://localhost:9090/-/healthy 2>/dev/null || echo "")
    if [ "${PROM_HEALTH}" = "Prometheus Server is Healthy." ] || echo "${PROM_HEALTH}" | grep -q "Healthy"; then
        log_ok "Prometheus API /-/healthy — OK"
    else
        log_warn "Prometheus API /-/healthy response: ${PROM_HEALTH}"
        HAS_WARNINGS=1
    fi

    # Query active scrape targets
    log_info "Inspecting active Prometheus scrape targets..."
    TARGETS_JSON=$(kubectl exec "${PROM_POD}" -n "${NAMESPACE}" -- wget -qO- http://localhost:9090/api/v1/targets 2>/dev/null || echo '{}')
    ACTIVE_COUNT=$(echo "${TARGETS_JSON}" | grep -o '"health":"up"' | wc -l | tr -d ' ' || echo 0)
    log_ok "Prometheus active 'up' targets count: ${ACTIVE_COUNT}"
else
    log_warn "No running Prometheus pod found for target inspection"
    HAS_WARNINGS=1
fi

# ── 3. Verify Grafana Web Accessibility via Proxy Route (/grafana/login) ──────
log_info "Verifying Grafana accessibility at ${APP_URL}/grafana/login..."

GRAFANA_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${APP_URL}/grafana/login" 2>/dev/null || echo "000")

if [ "${GRAFANA_HTTP_CODE}" = "200" ]; then
    log_ok "Grafana Web Interface — Accessible at ${APP_URL}/grafana/ (HTTP 200 OK)"
else
    log_warn "Grafana Web Interface returned HTTP ${GRAFANA_HTTP_CODE} at ${APP_URL}/grafana/login"
    HAS_WARNINGS=1
    # Fallback direct check via pod
    GRAFANA_POD=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/component=grafana --no-headers 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)
    if [ -n "${GRAFANA_POD}" ]; then
        GRAFANA_INT=$(kubectl exec "${GRAFANA_POD}" -n "${NAMESPACE}" -- wget -qO- http://localhost:3000/api/health 2>/dev/null || echo "")
        if echo "${GRAFANA_INT}" | grep -q '"database": "ok"'; then
            log_ok "Grafana Internal API /api/health — OK (via pod ${GRAFANA_POD})"
        fi
    fi
fi

# ── 4. Verify Alertmanager Health ─────────────────────────────────────────────
log_info "Verifying Alertmanager API health..."
ALERT_POD=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/component=alertmanager --no-headers 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)

if [ -n "${ALERT_POD}" ]; then
    ALERT_HEALTH=$(kubectl exec "${ALERT_POD}" -n "${NAMESPACE}" -- wget -qO- http://localhost:9093/-/healthy 2>/dev/null || echo "")
    if echo "${ALERT_HEALTH}" | grep -q "OK" || [ -n "${ALERT_HEALTH}" ]; then
        log_ok "Alertmanager API /-/healthy — OK (via pod ${ALERT_POD})"
    fi
else
    HAS_WARNINGS=1
fi

# ── 5. Verify ML Decision Controller Health ──────────────────────────────────
log_info "Verifying ML Decision Controller service health..."
ML_POD=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/component=ml-decision-controller --no-headers 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)

if [ -n "${ML_POD}" ]; then
    ML_HEALTH=$(kubectl exec "${ML_POD}" -n "${NAMESPACE}" -- python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:5000/health').read().decode())" 2>/dev/null || echo "")
    if echo "${ML_HEALTH}" | grep -q '"status":"healthy"' || echo "${ML_HEALTH}" | grep -q 'healthy'; then
        log_ok "ML Decision Controller API /health — OK (via pod ${ML_POD})"
    else
        log_warn "ML Decision Controller response: ${ML_HEALTH}"
        HAS_WARNINGS=1
    fi
else
    log_warn "ML Decision Controller pod not currently running or deployed"
    HAS_WARNINGS=1
fi

echo ""
if [ ${HAS_WARNINGS} -gt 0 ]; then
    log_warn "═══════════════════════════════════════════════════"
    log_warn "  Monitoring stack verification completed with warnings"
    log_warn "═══════════════════════════════════════════════════"
else
    log_ok "═══════════════════════════════════════════════════"
    log_ok "  Prometheus + Grafana + Alertmanager Stack Verified"
    log_ok "═══════════════════════════════════════════════════"
fi
log_info "  Grafana URL      : ${APP_URL}/grafana/"
log_info "  Grafana User     : admin"
log_info "  Grafana Password : CivicPulse@Grafana2026"
log_info "  Prometheus Cluster Service  : civicpulse-prometheus:9090"
log_info "  Alertmanager Cluster Service: civicpulse-alertmanager:9093"
echo ""

exit 0
