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
GITOPS_USERNAME="${GITOPS_USERNAME:-}"
GITOPS_TOKEN="${GITOPS_TOKEN:-${GITHUB_TOKEN:-${GIT_TOKEN:-}}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-number) BUILD_NUMBER="$2"; shift 2 ;;
        --branch)       GIT_BRANCH="$2";   shift 2 ;;
        --username)     GITOPS_USERNAME="$2"; shift 2 ;;
        --token)        GITOPS_TOKEN="$2";    shift 2 ;;
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

log_info "Starting GitOps update for build '${BUILD_NUMBER}'..."
log_info "Updating Helm image tags in '${VALUES_FILE}'..."

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
RENDERED_BACKEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-backend:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_FRONTEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-frontend:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_MONGODB=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-mongodb:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_NGINX=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-nginx:" | head -1 | awk '{print $2}' | tr -d "'\"\r")

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
    log_info "Committing values.yaml..."
    git add helm/civicpulse/values.yaml argocd/
    git commit -m "chore(deploy): update CivicPulse images to build ${BUILD_NUMBER} [skip ci]"
    
    COMMIT_SHA=$(git rev-parse HEAD)
    log_info "Created GitOps commit: ${COMMIT_SHA:0:7} (${COMMIT_SHA})"
    
    log_info "Verifying Git remote configuration..."
    git remote -v
    
    log_info "Authenticating to GitOps repository..."
    log_info "Pushing GitOps change to origin/${GIT_BRANCH}..."

    # Ensure Git never prompts interactively for credentials
    export GIT_TERMINAL_PROMPT=0

    PUSH_SUCCESS=0
    if [ -n "${GITOPS_TOKEN}" ]; then
        # Secure non-interactive authentication via GIT_ASKPASS helper
        ASKPASS_TMP=$(mktemp /tmp/git-askpass-XXXXXX.sh 2>/dev/null || mktemp "${REPO_ROOT}/.git-askpass-XXXXXX.sh")
        cat << ASKPASS_EOF > "${ASKPASS_TMP}"
#!/usr/bin/env bash
prompt="\$1"
if echo "\${prompt}" | grep -qi "username"; then
    echo "${GITOPS_USERNAME:-x-access-token}"
else
    echo "${GITOPS_TOKEN}"
fi
ASKPASS_EOF
        chmod 700 "${ASKPASS_TMP}"

        # Clean up temporary askpass script on exit
        trap 'rm -f "${ASKPASS_TMP}" 2>/dev/null || true' EXIT

        PUSH_USER="${GITOPS_USERNAME:-x-access-token}"
        AUTH_BASIC=$(echo -n "${PUSH_USER}:${GITOPS_TOKEN}" | base64 | tr -d '\r\n')

        if GIT_ASKPASS="${ASKPASS_TMP}" git -c "http.extraHeader=Authorization: Basic ${AUTH_BASIC}" push origin HEAD:"${GIT_BRANCH}" 2>/dev/null; then
            PUSH_SUCCESS=1
        fi
        
        rm -f "${ASKPASS_TMP}" 2>/dev/null || true
        trap - EXIT
    else
        # Unauthenticated / SSH push fallback
        if git push origin HEAD:"${GIT_BRANCH}" 2>/dev/null; then
            PUSH_SUCCESS=1
        fi
    fi

    if [ ${PUSH_SUCCESS} -eq 1 ]; then
        log_ok "GitOps changes pushed successfully (commit: ${COMMIT_SHA})"
    else
        log_error "ERROR: GitOps update failed"
        log_info "Check GitHub credentials, repository URL, branch, and authentication method."
        exit 1
    fi
fi

log_info "Triggering Argo CD synchronization..."
log_ok "GitOps update complete. Argo CD will synchronize the K3s cluster automatically."
