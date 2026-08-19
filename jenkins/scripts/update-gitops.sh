#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — GitOps Repository Update Script
# ============================================================================
# Updates helm/civicpulse/values.yaml with the new build tag and pushes
# the desired state change to GitHub to trigger Argo CD automated sync.
# Called by Jenkinsfile Stage 11 (Update GitOps Repository).
#
# Usage:
#   ./update-gitops.sh --build-number 229 --branch main
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

# Update image tags in values.yaml using sed
sed -i -E "s/(repository: ghcr.io\/tharunadhithyaa\/civicpulse-frontend\s*\n\s*tag:\s*)\"[^\"]*\"/\1\"${BUILD_NUMBER}\"/" "${VALUES_FILE}" 2>/dev/null || \
python3 -c "
import re
with open('${VALUES_FILE}', 'r') as f:
    content = f.read()
for app in ['frontend', 'backend', 'mongodb', 'nginx']:
    content = re.sub(
        r'(repository:\s*ghcr\.io/tharunadhithyaa/civicpulse-' + app + r'\s*\n\s*tag:\s*)\"[^\"]*\"',
        r'\1\"${BUILD_NUMBER}\"',
        content
    )
with open('${VALUES_FILE}', 'w') as f:
    f.write(content)
"

log_info "Validating updated Helm chart..."
helm lint "${REPO_ROOT}/helm/civicpulse" >/dev/null

log_info "Verifying rendered Helm manifest for build '${BUILD_NUMBER}'..."
RENDERED=$(helm template civicpulse "${REPO_ROOT}/helm/civicpulse" --namespace civicpulse)

if ! echo "${RENDERED}" | grep -q "civicpulse-backend:${BUILD_NUMBER}"; then
    log_error "Rendered manifest failed verification for backend tag '${BUILD_NUMBER}'"
    exit 1
fi

log_ok "Helm values.yaml successfully updated and verified for build '${BUILD_NUMBER}'"

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
