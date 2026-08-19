#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — GitOps Repository Update Script
# ============================================================================
# Updates helm/civicpulse/values.yaml with the new build tag and pushes
# the desired state change to GitHub to trigger Argo CD automated sync.
# Called by Jenkinsfile Stage 11 (Update GitOps Repository).
#
# Usage:
#   ./update-gitops.sh --build-number 230 --branch main
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
GIT_BRANCH="${GIT_BRANCH_NAME:-${BRANCH_NAME:-main}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-number) BUILD_NUMBER="$2"; shift 2 ;;
        --branch)       GIT_BRANCH="$2";   shift 2 ;;
        *) shift ;;
    esac
done

if [ -z "${BUILD_NUMBER}" ]; then
    log_error "Missing required argument --build-number"
    exit 1
fi

VALUES_FILE="${REPO_ROOT}/helm/civicpulse/values.yaml"

if [ ! -f "${VALUES_FILE}" ]; then
    log_error "Helm values.yaml file not found at: ${VALUES_FILE}"
    exit 1
fi

log_info "Updating GitOps image tags in '${VALUES_FILE}' to build '${BUILD_NUMBER}'..."

# Reliable YAML tag update using Python3 heredoc (handles string & int tags safely)
python3 - "${VALUES_FILE}" "${BUILD_NUMBER}" << 'EOF'
import sys
import re

values_file = sys.argv[1]
build_number = sys.argv[2]

with open(values_file, 'r') as f:
    content = f.read()

# Update tag: "..." under all service sections (frontend, backend, mongodb, nginx)
updated_content = re.sub(
    r'(tag:\s*)"[^"]*"',
    f'tag: "{build_number}"',
    content
)

with open(values_file, 'w') as f:
    f.write(updated_content)
EOF

EXPECTED_BACKEND="ghcr.io/tharunadhithyaa/civicpulse-backend:${BUILD_NUMBER}"
EXPECTED_FRONTEND="ghcr.io/tharunadhithyaa/civicpulse-frontend:${BUILD_NUMBER}"
EXPECTED_MONGODB="ghcr.io/tharunadhithyaa/civicpulse-mongodb:${BUILD_NUMBER}"
EXPECTED_NGINX="ghcr.io/tharunadhithyaa/civicpulse-nginx:${BUILD_NUMBER}"

log_info "Validating updated Helm chart..."
helm lint "${REPO_ROOT}/helm/civicpulse" >/dev/null

log_info "Verifying rendered Helm manifest for build '${BUILD_NUMBER}'..."
RENDERED=$(helm template civicpulse "${REPO_ROOT}/helm/civicpulse" --namespace civicpulse)

# Extract rendered image lines for diagnostics
RENDERED_BACKEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-backend:" | head -1 | awk '{print $2}' | tr -d "'\"")
RENDERED_FRONTEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-frontend:" | head -1 | awk '{print $2}' | tr -d "'\"")
RENDERED_MONGODB=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-mongodb:" | head -1 | awk '{print $2}' | tr -d "'\"")
RENDERED_NGINX=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-nginx:" | head -1 | awk '{print $2}' | tr -d "'\"")

log_info "Expected backend image  : ${EXPECTED_BACKEND}"
log_info "Rendered backend image  : ${RENDERED_BACKEND}"
log_info "Expected frontend image : ${EXPECTED_FRONTEND}"
log_info "Rendered frontend image : ${RENDERED_FRONTEND}"
log_info "Expected mongodb image  : ${EXPECTED_MONGODB}"
log_info "Rendered mongodb image  : ${RENDERED_MONGODB}"
log_info "Expected nginx image    : ${EXPECTED_NGINX}"
log_info "Rendered nginx image    : ${RENDERED_NGINX}"

VERIFY_FAILED=0

if [ "${RENDERED_BACKEND}" != "${EXPECTED_BACKEND}" ]; then
    log_error "Backend image verification FAILED! Expected '${EXPECTED_BACKEND}', got '${RENDERED_BACKEND}'"
    VERIFY_FAILED=1
fi

if [ "${RENDERED_FRONTEND}" != "${EXPECTED_FRONTEND}" ]; then
    log_error "Frontend image verification FAILED! Expected '${EXPECTED_FRONTEND}', got '${RENDERED_FRONTEND}'"
    VERIFY_FAILED=1
fi

if [ "${RENDERED_MONGODB}" != "${EXPECTED_MONGODB}" ]; then
    log_error "MongoDB image verification FAILED! Expected '${EXPECTED_MONGODB}', got '${RENDERED_MONGODB}'"
    VERIFY_FAILED=1
fi

if [ "${RENDERED_NGINX}" != "${EXPECTED_NGINX}" ]; then
    log_error "Nginx image verification FAILED! Expected '${EXPECTED_NGINX}', got '${RENDERED_NGINX}'"
    VERIFY_FAILED=1
fi

if [ $VERIFY_FAILED -ne 0 ]; then
    log_error "Helm manifest verification FAILED for build '${BUILD_NUMBER}'"
    exit 1
fi

log_ok "Helm manifest verification passed for build '${BUILD_NUMBER}'"

cd "${REPO_ROOT}"

# Configure git committer details if not present
git config user.name >/dev/null 2>&1 || git config user.name "jenkins-bot"
git config user.email >/dev/null 2>&1 || git config user.email "jenkins-ci@civicpulse.local"

if git diff --quiet helm/civicpulse/values.yaml argocd/ 2>/dev/null; then
    log_info "No changes detected in GitOps files. Skipping commit."
else
    log_info "Committing GitOps desired state change..."
    git add helm/civicpulse/values.yaml argocd/
    git commit -m "chore(deploy): update CivicPulse images to build ${BUILD_NUMBER}"
    
    log_info "Pushing GitOps commit to branch '${GIT_BRANCH}'..."
    if git push origin "${GIT_BRANCH}" 2>/dev/null; then
        log_ok "GitOps desired state pushed to GitHub repository!"
    else
        log_warn "Git push via default remote failed. Attempting authenticated push..."
        git push origin HEAD:"${GIT_BRANCH}" || {
            log_error "Failed to push GitOps changes to GitHub branch '${GIT_BRANCH}'."
            log_info "Ensure Jenkins git credentials (e.g. github-gitops-credentials) are configured with write permissions."
            exit 1
        }
    fi
fi

log_ok "GitOps update complete. Argo CD will synchronize the K3s cluster automatically."
