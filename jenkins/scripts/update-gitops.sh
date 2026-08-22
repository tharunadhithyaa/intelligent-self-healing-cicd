#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Argo CD Zero-Commit Deployment Script
# ============================================================================
# Applies Argo CD Application parameter overrides (image.tag = BUILD_NUMBER)
# directly to the 'civicpulse' Argo CD Application in Kubernetes.
# Executed by Jenkinsfile Stage 11 (Deploy via Argo CD).
#
# ZERO GIT COMMITS ARE CREATED BY THIS SCRIPT.
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

# ── Defaults ──────────────────────────────────────────────────────────────────
BUILD_NUMBER="${BUILD_NUMBER:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-number) BUILD_NUMBER="$2"; shift 2 ;;
        *) shift ;;
    esac
done

if [ -z "${BUILD_NUMBER}" ]; then
    log_error "Missing required argument --build-number"
    exit 1
fi

log_info "Starting Argo CD deployment update for build '${BUILD_NUMBER}'"

# Ensure we are in the repository root
cd "${REPO_ROOT}"

EXPECTED_BACKEND="ghcr.io/tharunadhithyaa/civicpulse-backend:${BUILD_NUMBER}"
EXPECTED_FRONTEND="ghcr.io/tharunadhithyaa/civicpulse-frontend:${BUILD_NUMBER}"
EXPECTED_MONGODB="ghcr.io/tharunadhithyaa/civicpulse-mongodb:${BUILD_NUMBER}"
EXPECTED_NGINX="ghcr.io/tharunadhithyaa/civicpulse-nginx:${BUILD_NUMBER}"

log_info "Target Backend image : ${EXPECTED_BACKEND}"
log_info "Target Frontend image: ${EXPECTED_FRONTEND}"
log_info "Target MongoDB image : ${EXPECTED_MONGODB}"
log_info "Target Nginx image   : ${EXPECTED_NGINX}"

# ── 1. Validate Base Helm Chart ──────────────────────────────────────────────
HELM_DIR="${REPO_ROOT}/helm/civicpulse"
if [ -d "${HELM_DIR}" ] && command -v helm &>/dev/null; then
    log_info "Validating Helm chart structure"
    helm lint "${HELM_DIR}" >/dev/null 2>&1 || log_warn "Helm lint warning (non-blocking)"
fi

# ── 2. Update Argo CD Application Parameter Overrides (Zero Commit on Main) ──
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

if ! kubectl get nodes >/dev/null 2>&1; then
    log_error "Cannot connect to Kubernetes cluster using KUBECONFIG=${KUBECONFIG:-unset}."
    exit 1
fi
log_ok "K3s cluster accessible"

if ! kubectl get application civicpulse -n argocd >/dev/null 2>&1; then
    log_error "Argo CD Application 'civicpulse' not accessible in namespace 'argocd'."
    exit 1
fi
log_ok "Argo CD Application 'civicpulse' found in namespace 'argocd'"

log_info "Applying Argo CD Application parameter overrides for build '${BUILD_NUMBER}'..."
if ! kubectl patch application civicpulse -n argocd --type merge -p "{
  \"spec\": {
    \"source\": {
      \"helm\": {
        \"parameters\": [
          {\"name\": \"frontend.image.tag\", \"value\": \"${BUILD_NUMBER}\"},
          {\"name\": \"backend.image.tag\", \"value\": \"${BUILD_NUMBER}\"},
          {\"name\": \"mongodb.image.tag\", \"value\": \"${BUILD_NUMBER}\"},
          {\"name\": \"nginx.image.tag\", \"value\": \"${BUILD_NUMBER}\"}
        ]
      }
    }
  }
}"; then
    log_error "Failed to patch Argo CD Application parameter overrides for build '${BUILD_NUMBER}'"
    exit 1
fi

log_ok "Argo CD Application parameter overrides applied successfully (zero Git commits)"

# ── 3. Optional Argo CD Sync Trigger ──────────────────────────────────────────
if command -v argocd &>/dev/null; then
    log_info "Triggering Argo CD application sync via Argo CD CLI..."
    argocd app sync civicpulse >/dev/null 2>&1 || log_warn "argocd app sync skipped (CLI unauthenticated or non-blocking)"
fi

log_ok "Argo CD deployment update completed successfully for build '${BUILD_NUMBER}'"
exit 0
