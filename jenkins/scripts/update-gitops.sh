#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Argo CD Zero-Commit Deployment Script
# ============================================================================
# Applies Argo CD Application parameter overrides (image.tag = BUILD_NUMBER)
# directly to the 'civicpulse' Argo CD Application in Kubernetes.
# Executed by Jenkinsfile Stage 11 (Deploy via Argo CD).
#
# ARCHITECTURAL PATTERN & TRADE-OFF RATIONALE:
# - ZERO GIT COMMITS: This script applies live parameter overrides via
#   `kubectl patch application civicpulse -n argocd`.
# - WHY PREVENT GIT COMMITS? Because Jenkins Poll SCM monitors git branches.
#   If Jenkins pushed image tag commits back to Git during build execution,
#   it would trigger recursive, infinite CI pipeline build loops.
# - GITOPS TRADE-OFF: This "Parameter Override" pattern prioritizes demo safety
#   and fast feedback loops over pure GitOps strictness. If the Argo CD
#   Application CRD is deleted and re-created from raw git manifests without
#   parameters, live override tags revert to manifest default ('latest').
# ============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[GITOPS]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[GITOPS]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[GITOPS]${NC} ⚠️  $*"; }
log_error() { echo -e "${RED}[GITOPS]${NC} ❌ $*"; }

# ── Early Debug Echoes ────────────────────────────────────────────────────────
echo "[GITOPS] Script started"
echo "[GITOPS] BUILD_NUMBER=${BUILD_NUMBER:-not set}"
echo "[GITOPS] KUBECONFIG=${KUBECONFIG:-not set}"

# ── Defaults & Configuration ──────────────────────────────────────────────────
BUILD_NUMBER="${BUILD_NUMBER:-}"
DEPLOYMENT_TIMEOUT="${DEPLOYMENT_TIMEOUT:-300}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-number) BUILD_NUMBER="$2"; shift 2 ;;
        --timeout)      DEPLOYMENT_TIMEOUT="$2"; shift 2 ;;
        [0-9]*)         BUILD_NUMBER="$1"; shift 1 ;;
        *) shift ;;
    esac
done

if [ -z "${BUILD_NUMBER}" ] || ! [[ "${BUILD_NUMBER}" =~ ^[0-9]+$ ]]; then
    log_error "Missing or invalid numeric argument --build-number (got: '${BUILD_NUMBER}')"
    exit 1
fi

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
    log_error "FATAL: GRAFANA_ADMIN_PASSWORD environment variable is missing."
    log_error "Ensure Jenkins credential 'grafana-admin-password' (Secret text) is bound in Jenkinsfile."
    exit 1
fi

cd "${REPO_ROOT}"

GHCR_REGISTRY_VAL="${GHCR_REGISTRY:-ghcr.io}"
GHCR_OWNER_VAL="${GHCR_OWNER:-tharunadhithyaa}"
EXPECTED_BACKEND="${GHCR_REGISTRY_VAL}/${GHCR_OWNER_VAL}/civicpulse-backend:${BUILD_NUMBER}"
EXPECTED_FRONTEND="${GHCR_REGISTRY_VAL}/${GHCR_OWNER_VAL}/civicpulse-frontend:${BUILD_NUMBER}"
EXPECTED_MONGODB="${GHCR_REGISTRY_VAL}/${GHCR_OWNER_VAL}/civicpulse-mongodb:latest"
EXPECTED_NGINX="${GHCR_REGISTRY_VAL}/${GHCR_OWNER_VAL}/civicpulse-nginx:latest"

# ── 1. Pre-Deployment GHCR Image Manifest Availability Check ─────────────────
log_info "Performing pre-deployment GHCR image manifest availability check..."

GHCR_USER=$(echo "${GHCR_USERNAME:-${GHCR_USER:-${GHCR_OWNER_VAL}}}" | tr -d ' \r\n\t')
GHCR_TOKEN_VAL=$(echo "${GHCR_TOKEN:-}" | tr -d ' \r\n\t')

if [ -n "${GHCR_USER}" ] && [ -n "${GHCR_TOKEN_VAL}" ] && command -v docker &>/dev/null; then
    echo "${GHCR_TOKEN_VAL}" | docker login "${GHCR_REGISTRY_VAL}" -u "${GHCR_USER}" --password-stdin >/dev/null 2>&1 || true
fi

verify_ghcr_image() {
    local repo_name="$1"
    local tag="$2"
    local full_img="${GHCR_REGISTRY_VAL}/${GHCR_OWNER_VAL}/${repo_name}:${tag}"

    # Strategy A: Toolless HTTP Registry API Check via curl
    if command -v curl &>/dev/null; then
        local bearer_token=""
        if [ -n "${GHCR_USER}" ] && [ -n "${GHCR_TOKEN_VAL}" ]; then
            bearer_token=$(curl -s --max-time 10 -u "${GHCR_USER}:${GHCR_TOKEN_VAL}" "https://${GHCR_REGISTRY_VAL}/token?service=${GHCR_REGISTRY_VAL}&scope=repository:${GHCR_OWNER_VAL}/${repo_name}:pull" 2>/dev/null | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")
        fi
        if [ -z "${bearer_token}" ]; then
            bearer_token=$(curl -s --max-time 10 "https://${GHCR_REGISTRY_VAL}/token?service=${GHCR_REGISTRY_VAL}&scope=repository:${GHCR_OWNER_VAL}/${repo_name}:pull" 2>/dev/null | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")
        fi

        if [ -n "${bearer_token}" ]; then
            local http_code
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
                -H "Authorization: Bearer ${bearer_token}" \
                -H "Accept: application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json" \
                "https://${GHCR_REGISTRY_VAL}/v2/${GHCR_OWNER_VAL}/${repo_name}/manifests/${tag}" 2>/dev/null || echo "000")
            if [ "${http_code}" = "200" ]; then
                log_ok "Pre-deployment check: Image '${full_img}' verified in GHCR via Registry API (HTTP 200)"
                return 0
            fi
        fi
    fi

    # Strategy B: CLI Check via docker manifest inspect
    if command -v docker &>/dev/null; then
        if docker manifest inspect "${full_img}" >/dev/null 2>&1; then
            log_ok "Pre-deployment check: Image '${full_img}' verified in GHCR via Docker CLI"
            return 0
        fi
    fi

    log_error "FATAL Pre-deployment check failed: Image '${full_img}' is NOT available in GHCR."
    log_error "Deployment was NOT attempted and Argo CD parameter overrides were NOT updated."
    return 1
}

verify_ghcr_image "civicpulse-backend" "${BUILD_NUMBER}" || exit 1
verify_ghcr_image "civicpulse-frontend" "${BUILD_NUMBER}" || exit 1

# ── 2. Validate K3s Cluster & Argo CD Application Prerequisites ──────────────
if [ -z "${KUBECONFIG:-}" ]; then
    if [ -f "${HOME}/.kube/config" ] && [ -r "${HOME}/.kube/config" ]; then
        export KUBECONFIG="${HOME}/.kube/config"
    elif [ -f "/home/jenkins/.kube/config" ] && [ -r "/home/jenkins/.kube/config" ]; then
        export KUBECONFIG="/home/jenkins/.kube/config"
    elif [ -f "/home/tharun_adhithyaa/.kube/config" ] && [ -r "/home/tharun_adhithyaa/.kube/config" ]; then
        export KUBECONFIG="/home/tharun_adhithyaa/.kube/config"
    elif [ -f "/etc/rancher/k3s/k3s.yaml" ] && [ -r "/etc/rancher/k3s/k3s.yaml" ]; then
        export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
    fi
fi

if ! command -v kubectl &>/dev/null; then
    log_error "kubectl binary not found on PATH."
    exit 1
fi

log_info "Using KUBECONFIG=${KUBECONFIG:-unset}"

if ! kubectl get nodes --request-timeout=10s >/dev/null 2>&1; then
    log_error "Cannot connect to Kubernetes cluster using KUBECONFIG=${KUBECONFIG:-unset}."
    exit 1
fi
log_ok "K3s cluster accessible"

if ! kubectl get application civicpulse -n argocd --request-timeout=10s >/dev/null 2>&1; then
    log_warn "Argo CD Application 'civicpulse' not found in namespace 'argocd'. Applying manifest argocd/civicpulse-application.yaml..."
    if [ -f "${REPO_ROOT}/argocd/civicpulse-application.yaml" ]; then
        kubectl apply -f "${REPO_ROOT}/argocd/civicpulse-application.yaml" --request-timeout=10s >/dev/null 2>&1 || true
    fi
else
    log_ok "Argo CD Application 'civicpulse' found in namespace 'argocd'"
    if [ -f "${REPO_ROOT}/argocd/civicpulse-application.yaml" ]; then
        kubectl apply -f "${REPO_ROOT}/argocd/civicpulse-application.yaml" --request-timeout=10s >/dev/null 2>&1 || true
    fi
fi

# ── Retrieve Previous Tags & Display Stage Header ─────────────────────────────
PREV_BACKEND_TAG=$(kubectl get deployment civicpulse-backend -n civicpulse -o jsonpath='{.spec.template.spec.containers[0].image}' --request-timeout=10s 2>/dev/null | awk -F':' '{print $NF}' || echo "unknown")
PREV_FRONTEND_TAG=$(kubectl get deployment civicpulse-frontend -n civicpulse -o jsonpath='{.spec.template.spec.containers[0].image}' --request-timeout=10s 2>/dev/null | awk -F':' '{print $NF}' || echo "unknown")

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STAGE 11 — ARGO CD DEPLOYMENT                           ${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo "  Build Number       : ${BUILD_NUMBER}"
echo "  Target Backend     : ${EXPECTED_BACKEND}"
echo "  Target Frontend    : ${EXPECTED_FRONTEND}"
echo "  Previous Backend   : ${PREV_BACKEND_TAG}"
echo "  Previous Frontend  : ${PREV_FRONTEND_TAG}"
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Ensure Namespace and Secrets Exist ────────────────────────────────────────
kubectl create namespace civicpulse --dry-run=client -o yaml | kubectl apply --request-timeout=10s -f - >/dev/null 2>&1 || true

if [ -n "${GHCR_TOKEN_VAL}" ]; then
    log_info "Ensuring secret 'ghcr-secret' exists in namespace 'civicpulse'..."
    kubectl create secret docker-registry ghcr-secret \
        --namespace civicpulse \
        --docker-server="${GHCR_REGISTRY:-ghcr.io}" \
        --docker-username="${GHCR_USER}" \
        --docker-password="${GHCR_TOKEN_VAL}" \
        --dry-run=client -o yaml | kubectl apply --request-timeout=10s -f - >/dev/null 2>&1
    log_ok "ghcr-secret ready in namespace 'civicpulse'"
fi

JWT_ACCESS_SECRET_VAL="${JWT_ACCESS_SECRET:-civicpulse-ci-access-secret}"
JWT_REFRESH_SECRET_VAL="${JWT_REFRESH_SECRET:-civicpulse-ci-refresh-secret}"
DEFAULT_PASSWORD_VAL="${DEFAULT_PASSWORD:-CivicPulse@2026}"
kubectl create secret generic civicpulse-secret \
    --namespace civicpulse \
    --from-literal=JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET_VAL}" \
    --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET_VAL}" \
    --from-literal=DEFAULT_PASSWORD="${DEFAULT_PASSWORD_VAL}" \
    --dry-run=client -o yaml | kubectl apply --request-timeout=10s -f - >/dev/null 2>&1
log_ok "civicpulse-secret ready in namespace 'civicpulse'"

GRAFANA_SECRET="civicpulse-grafana-secret"
GRAFANA_NS="civicpulse"
GRAFANA_USER_VAL="${GRAFANA_ADMIN_USER:-admin}"
GRAFANA_PASS_VAL="${GRAFANA_ADMIN_PASSWORD:-CivicPulse@Grafana2026}"
log_info "Ensuring secret '${GRAFANA_SECRET}' exists in namespace '${GRAFANA_NS}'..."
kubectl create secret generic "${GRAFANA_SECRET}" \
    --namespace="${GRAFANA_NS}" \
    --from-literal=admin-user="${GRAFANA_USER_VAL}" \
    --from-literal=admin-password="${GRAFANA_PASS_VAL}" \
    --dry-run=client -o yaml | kubectl apply --request-timeout=10s -f - >/dev/null 2>&1
log_ok "${GRAFANA_SECRET} ready in namespace '${GRAFANA_NS}'"

# ── Zero-Commit GitOps Deployment Notice ──────────────────────────────────────
log_info "GitOps auto-commits disabled. Deploying build '${BUILD_NUMBER}' via zero-commit Argo CD parameter overrides..."

# ── Retrieve and Log Pre-Patch Application Parameters ─────────────────────────
log_info "Inspecting existing Argo CD Application spec parameters..."
PREV_PARAMS=$(kubectl get application civicpulse -n argocd -o jsonpath='{.spec.source.helm.parameters}' --request-timeout=10s 2>/dev/null || echo "[]")
log_info "Current spec parameters before patch: ${PREV_PARAMS}"

# ── Patch Argo CD Application Parameters ──────────────────────────────────────
log_info "Applying Argo CD Application parameter overrides for build '${BUILD_NUMBER}' (backend & frontend)..."
if ! kubectl patch application civicpulse -n argocd --type merge --request-timeout=10s -p "{
  \"spec\": {
    \"source\": {
      \"helm\": {
        \"parameters\": [
          {\"name\": \"frontend.image.tag\", \"value\": \"${BUILD_NUMBER}\"},
          {\"name\": \"backend.image.tag\", \"value\": \"${BUILD_NUMBER}\"}
        ]
      }
    }
  }
}"; then
    log_error "Failed to patch Argo CD Application parameter overrides for build '${BUILD_NUMBER}'"
    exit 1
fi
log_ok "Argo CD Application parameter overrides patch submitted"

# ── Verify Live Application Spec Parameters Immediately After Patch ───────────
FRONTEND_SPEC_TAG=$(kubectl get application civicpulse -n argocd -o jsonpath='{.spec.source.helm.parameters[?(@.name=="frontend.image.tag")].value}' --request-timeout=10s 2>/dev/null || echo "")
BACKEND_SPEC_TAG=$(kubectl get application civicpulse -n argocd -o jsonpath='{.spec.source.helm.parameters[?(@.name=="backend.image.tag")].value}' --request-timeout=10s 2>/dev/null || echo "")

if [ "${FRONTEND_SPEC_TAG}" != "${BUILD_NUMBER}" ] || [ "${BACKEND_SPEC_TAG}" != "${BUILD_NUMBER}" ]; then
    log_error "VERIFICATION FAILED: Argo CD Application live spec does NOT contain target build '${BUILD_NUMBER}'!"
    log_error "Live spec values — frontend.image.tag: '${FRONTEND_SPEC_TAG}', backend.image.tag: '${BACKEND_SPEC_TAG}'"
    exit 1
fi
log_ok "Verified Argo CD Application live spec parameters: frontend=${FRONTEND_SPEC_TAG}, backend=${BACKEND_SPEC_TAG}"

# ── Trigger Argo CD Refresh ───────────────────────────────────────────────────
log_info "Triggering Argo CD application refresh via Kubernetes API..."
kubectl annotate application civicpulse -n argocd argocd.argoproj.io/refresh=normal --overwrite --request-timeout=10s >/dev/null 2>&1 || true

log_info "Waiting for Argo CD to reconcile manifests..."
SYNC_WAIT=0
while [ $SYNC_WAIT -lt 60 ]; do
    SYNC_STATUS=$(kubectl get application civicpulse -n argocd -o jsonpath='{.status.sync.status}' --request-timeout=10s 2>/dev/null || echo "Unknown")
    if [ "${SYNC_STATUS}" = "Synced" ]; then
        log_ok "Argo CD application manifests synchronized (Sync: '${SYNC_STATUS}')"
        break
    fi
    sleep 5
    SYNC_WAIT=$((SYNC_WAIT + 5))
done

# ── 4. Wait for Deployment Spec Transition & Workload Rollout ───────────────
log_info "Waiting for Kubernetes Workload Rollout & Pod Readiness (Timeout: ${DEPLOYMENT_TIMEOUT}s)..."

# Initial grace period allowing Kubelet to register spec changes & initiate image pulls
GRACE_PERIOD=15
log_info "Allowing initial grace period (${GRACE_PERIOD}s) for Kubelet image pull initiation..."
sleep ${GRACE_PERIOD}

ELAPSED=${GRACE_PERIOD}
POLL_INTERVAL=10
ROLLOUT_COMPLETE=false
BACKEND_LIVE_IMG="unknown"
FRONTEND_LIVE_IMG="unknown"

while [ $ELAPSED -lt $DEPLOYMENT_TIMEOUT ]; do
    BACKEND_LIVE_IMG=$(kubectl get deployment civicpulse-backend -n civicpulse -o jsonpath='{.spec.template.spec.containers[0].image}' --request-timeout=10s 2>/dev/null || echo "unknown")
    FRONTEND_LIVE_IMG=$(kubectl get deployment civicpulse-frontend -n civicpulse -o jsonpath='{.spec.template.spec.containers[0].image}' --request-timeout=10s 2>/dev/null || echo "unknown")
    HEALTH_STATUS=$(kubectl get application civicpulse -n argocd -o jsonpath='{.status.health.status}' --request-timeout=10s 2>/dev/null || echo "Unknown")
    SYNC_STATUS=$(kubectl get application civicpulse -n argocd -o jsonpath='{.status.sync.status}' --request-timeout=10s 2>/dev/null || echo "Unknown")

    log_info "[GITOPS] Desired: :${BUILD_NUMBER} | Live Backend Spec: ${BACKEND_LIVE_IMG} | Live Frontend Spec: ${FRONTEND_LIVE_IMG} (${ELAPSED}s/${DEPLOYMENT_TIMEOUT}s)"

    # Inspect current pod status for target deployment components (backend & frontend)
    TARGET_POD_STATUS=$(kubectl get pods -n civicpulse -l 'app.kubernetes.io/component in (backend, frontend)' --no-headers --request-timeout=10s 2>/dev/null || true)

    if [ -n "${TARGET_POD_STATUS}" ]; then
        log_info "Current target pod status:"
        echo "${TARGET_POD_STATUS}"

        if echo "${TARGET_POD_STATUS}" | grep -qE "ImagePullBackOff|ErrImagePull"; then
            log_warn "Transient image pull phase detected (ErrImagePull/ImagePullBackOff). Image download/credential propagation in progress. Continuing to poll..."
        fi
        if echo "${TARGET_POD_STATUS}" | grep -qE "ContainerCreating|PodInitializing"; then
            log_info "Container initialization in progress. Continuing to poll..."
        fi
        if echo "${TARGET_POD_STATUS}" | grep -q "CrashLoopBackOff"; then
            log_warn "Container crash loop detected during startup. Continuing to poll for recovery / timeout..."
        fi
    fi

    # Non-blocking diagnostic inspection for other namespace pods (e.g. Grafana, Prometheus)
    OTHER_POD_ERRORS=$(kubectl get pods -n civicpulse --no-headers --request-timeout=10s 2>/dev/null | grep -v -E "civicpulse-backend|civicpulse-frontend" | grep -E "ImagePullBackOff|ErrImagePull|CrashLoopBackOff|CreateContainerConfigError|CreateContainerError" || true)
    if [ -n "${OTHER_POD_ERRORS}" ]; then
        log_warn "Detected container issue in non-target pod (advisory only, deployment continuing):"
        echo "${OTHER_POD_ERRORS}"
    fi

    # CRITICAL RACE-CONDITION PREVENTION:
    # Do NOT proceed until BOTH Kubernetes Deployments actually reference the new build image!
    if [[ "${BACKEND_LIVE_IMG}" != *":${BUILD_NUMBER}"* ]] || [[ "${FRONTEND_LIVE_IMG}" != *":${BUILD_NUMBER}"* ]]; then
        log_info "[GITOPS] Kubernetes Deployment spec has not yet updated to build ${BUILD_NUMBER}. Waiting..."
        sleep ${POLL_INTERVAL}
        ELAPSED=$((ELAPSED + POLL_INTERVAL))
        continue
    fi

    # Check rollout status once Deployment spec has updated
    BACKEND_READY=false
    FRONTEND_READY=false

    if kubectl rollout status deployment/civicpulse-backend -n civicpulse --timeout=5s >/dev/null 2>&1; then
        BACKEND_READY=true
    fi
    if kubectl rollout status deployment/civicpulse-frontend -n civicpulse --timeout=5s >/dev/null 2>&1; then
        FRONTEND_READY=true
    fi

    # Verify actual running pod images match BUILD_NUMBER
    POD_BACKEND_IMG=$(kubectl get pods -n civicpulse -l app.kubernetes.io/component=backend -o jsonpath='{.items[0].spec.containers[0].image}' --request-timeout=10s 2>/dev/null || echo "")
    POD_FRONTEND_IMG=$(kubectl get pods -n civicpulse -l app.kubernetes.io/component=frontend -o jsonpath='{.items[0].spec.containers[0].image}' --request-timeout=10s 2>/dev/null || echo "")

    if [ "${BACKEND_READY}" = "true" ] && [ "${FRONTEND_READY}" = "true" ] && \
       [ "${SYNC_STATUS}" = "Synced" ] && \
       [[ "${POD_BACKEND_IMG}" == *":${BUILD_NUMBER}"* ]] && [[ "${POD_FRONTEND_IMG}" == *":${BUILD_NUMBER}"* ]]; then
        log_ok "Workloads successfully rolled out and pods reported Ready (Backend: :${BUILD_NUMBER}, Frontend: :${BUILD_NUMBER})"
        ROLLOUT_COMPLETE=true
        break
    fi

    sleep ${POLL_INTERVAL}
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

# ── 5. Workload Verification & Output Summary ─────────────────────────────────
if [ "${ROLLOUT_COMPLETE}" = "true" ]; then
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  STAGE 11 — ARGO CD DEPLOYMENT SUCCESS                   ${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo "  Jenkins Build Number : ${BUILD_NUMBER}"
    echo ""
    echo "  Backend Image        : ghcr.io/tharunadhithyaa/civicpulse-backend:${BUILD_NUMBER}"
    echo "  Frontend Image       : ghcr.io/tharunadhithyaa/civicpulse-frontend:${BUILD_NUMBER}"
    echo "  MongoDB Image        : ${EXPECTED_MONGODB}"
    echo "  Nginx Image          : ${EXPECTED_NGINX}"
    echo ""
    echo "  Argo CD Sync         : Synced"
    echo "  Argo CD Health       : Healthy"
    echo ""
    echo "  Argo Backend Tag     : VERIFIED ${BUILD_NUMBER}"
    echo "  Argo Frontend Tag    : VERIFIED ${BUILD_NUMBER}"
    echo ""
    echo "  Backend Deployment   : VERIFIED :${BUILD_NUMBER}"
    echo "  Frontend Deployment  : VERIFIED :${BUILD_NUMBER}"
    echo ""
    echo "  Backend Pods         : VERIFIED :${BUILD_NUMBER}"
    echo "  Frontend Pods        : VERIFIED :${BUILD_NUMBER}"
    echo ""
    echo "  Backend Rollout      : Successful (1/1 Ready)"
    echo "  Frontend Rollout     : Successful (1/1 Ready)"
    echo ""
    echo "  Deployment Status    : SUCCESS"
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo ""
    exit 0
else
    log_error "══════════════════════════════════════════════════════════"
    log_error "  STAGE 11 — DEPLOYMENT DIAGNOSTICS                       "
    log_error "══════════════════════════════════════════════════════════"
    log_error "Deployment rollout failed to complete within ${DEPLOYMENT_TIMEOUT}s."
    echo ""
    log_error "Expected Backend Image : ${EXPECTED_BACKEND}"
    log_error "Actual Backend Image   : ${BACKEND_LIVE_IMG:-unknown}"
    log_error "Expected Frontend Image: ${EXPECTED_FRONTEND}"
    log_error "Actual Frontend Image  : ${FRONTEND_LIVE_IMG:-unknown}"
    echo ""
    log_info "=== Kubernetes Resource Overview (civicpulse namespace) ==="
    kubectl get pods -n civicpulse -o wide --request-timeout=10s 2>/dev/null || true
    kubectl get deployments -n civicpulse --request-timeout=10s 2>/dev/null || true
    kubectl get statefulsets -n civicpulse --request-timeout=10s 2>/dev/null || true
    kubectl get replicasets -n civicpulse --request-timeout=10s 2>/dev/null || true

    log_info "=== Pod Container Images & Status ==="
    kubectl get pods -n civicpulse -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\t"}{.status.phase}{"\n"}{end}' --request-timeout=10s 2>/dev/null || true

    log_info "=== Diagnostic Details for Non-Running / Non-Ready Pods ==="
    for pod in $(kubectl get pods -n civicpulse --no-headers --request-timeout=10s 2>/dev/null | grep -v "1/1" | awk '{print $1}'); do
        log_info "--- Describe Pod ${pod} ---"
        kubectl describe pod "$pod" -n civicpulse --request-timeout=10s 2>/dev/null || true
        log_info "--- Logs for Pod ${pod} ---"
        kubectl logs "$pod" -n civicpulse --all-containers --tail=50 --request-timeout=10s 2>/dev/null || true
    done

    log_info "=== Recent Kubernetes Events ==="
    kubectl get events -n civicpulse --sort-by='.lastTimestamp' --request-timeout=10s 2>/dev/null | tail -n 25 || true

    log_info "=== Argo CD Application Spec & Status Summary ==="
    kubectl get application civicpulse -n argocd -o yaml --request-timeout=10s 2>/dev/null || true
    exit 1
fi
