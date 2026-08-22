#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — GitOps Repository Update Script
# ============================================================================
# Updates helm/civicpulse/values.yaml with the new build tag and pushes
# the desired state change to GitHub on the 'gitops' branch to trigger Argo CD.
# Executed by Jenkinsfile Stage 11 (Update GitOps Repository).
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
GIT_BRANCH="${GITOPS_TARGET_BRANCH:-gitops}"
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

log_info "Starting GitOps update for build '${BUILD_NUMBER}'"

# Ensure we are in the repository root
cd "${REPO_ROOT}"

# Configure git committer details in main repo if not set
git config user.name >/dev/null 2>&1 || git config user.name "jenkins-bot"
git config user.email >/dev/null 2>&1 || git config user.email "jenkins-ci@civicpulse.local"

log_info "Synchronizing target branch '${GIT_BRANCH}'"
git fetch origin "${GIT_BRANCH}" 2>/dev/null || true

# ── Create Temporary Worktree for GitOps Branch Isolation ─────────────────────
WORKTREE_DIR=$(mktemp -d /tmp/gitops-worktree-XXXXXX 2>/dev/null || mktemp -d "${REPO_ROOT}/.gitops-worktree-XXXXXX")

cleanup_worktree() {
    git worktree remove --force "${WORKTREE_DIR}" 2>/dev/null || rm -rf "${WORKTREE_DIR}" 2>/dev/null || true
}
trap cleanup_worktree EXIT INT TERM

if git rev-parse --verify "origin/${GIT_BRANCH}" >/dev/null 2>&1; then
    git worktree add -B "${GIT_BRANCH}" "${WORKTREE_DIR}" "origin/${GIT_BRANCH}" >/dev/null 2>&1
elif git rev-parse --verify "${GIT_BRANCH}" >/dev/null 2>&1; then
    git worktree add "${WORKTREE_DIR}" "${GIT_BRANCH}" >/dev/null 2>&1
else
    git worktree add -b "${GIT_BRANCH}" "${WORKTREE_DIR}" >/dev/null 2>&1
fi

VALUES_FILE="${WORKTREE_DIR}/helm/civicpulse/values.yaml"
HELM_DIR="${WORKTREE_DIR}/helm/civicpulse"

if [ ! -f "${VALUES_FILE}" ]; then
    log_error "Helm values.yaml file not found at: ${VALUES_FILE}"
    exit 1
fi

log_info "Updating Helm image tags to build '${BUILD_NUMBER}'"

# Update YAML image tags safely via Python heredoc
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

log_info "Validating updated Helm chart"
helm lint "${HELM_DIR}" >/dev/null

log_info "Verifying rendered Helm manifest"
RENDERED=$(helm template civicpulse "${HELM_DIR}" --namespace civicpulse)

# Extract rendered image lines for diagnostics
RENDERED_BACKEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-backend:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_FRONTEND=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-frontend:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_MONGODB=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-mongodb:" | head -1 | awk '{print $2}' | tr -d "'\"\r")
RENDERED_NGINX=$(echo "${RENDERED}" | grep -E "image: ['\"]?ghcr.io/tharunadhithyaa/civicpulse-nginx:" | head -1 | awk '{print $2}' | tr -d "'\"\r")

log_info "Backend image: ${RENDERED_BACKEND}"
log_info "Frontend image: ${RENDERED_FRONTEND}"
log_info "MongoDB image: ${RENDERED_MONGODB}"
log_info "Nginx image: ${RENDERED_NGINX}"

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

log_ok "Helm manifest verification passed"

# Check if there are uncommitted changes in worktree
cd "${WORKTREE_DIR}"

if git diff --quiet helm/civicpulse/values.yaml 2>/dev/null && [ -z "$(git status --porcelain)" ]; then
    log_info "No GitOps changes required. Image tags already match build '${BUILD_NUMBER}'."
    log_ok "GitOps update completed successfully"
    exit 0
fi

log_info "Committing GitOps changes"
git add helm/civicpulse/values.yaml
if [ -d "argocd" ]; then
    git add argocd/ 2>/dev/null || true
fi

git commit -m "chore(deploy): update CivicPulse images to build ${BUILD_NUMBER} [skip ci]" >/dev/null

COMMIT_SHA=$(git rev-parse HEAD)

# Sync check before pushing to handle concurrent commits
git fetch origin "${GIT_BRANCH}" 2>/dev/null || true

if git rev-parse --verify "origin/${GIT_BRANCH}" >/dev/null 2>&1; then
    # Rebase onto latest remote branch to prevent force-pushing
    git rebase "origin/${GIT_BRANCH}" >/dev/null 2>&1 || {
        git rebase --abort >/dev/null 2>&1 || true
    }
fi

log_info "Pushing GitOps commit to origin/${GIT_BRANCH}"

export GIT_TERMINAL_PROMPT=0
PUSH_SUCCESS=0

if [ -n "${GITOPS_TOKEN}" ]; then
    ASKPASS_TMP=$(mktemp /tmp/git-askpass-XXXXXX.sh 2>/dev/null || mktemp "${WORKTREE_DIR}/.git-askpass-XXXXXX.sh")
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

    PUSH_USER="${GITOPS_USERNAME:-x-access-token}"
    AUTH_BASIC=$(echo -n "${PUSH_USER}:${GITOPS_TOKEN}" | base64 | tr -d '\r\n')

    if GIT_ASKPASS="${ASKPASS_TMP}" git -c "http.extraHeader=Authorization: Basic ${AUTH_BASIC}" push origin "${GIT_BRANCH}" >/dev/null 2>&1; then
        PUSH_SUCCESS=1
    fi

    rm -f "${ASKPASS_TMP}" 2>/dev/null || true
else
    if git push origin "${GIT_BRANCH}" >/dev/null 2>&1; then
        PUSH_SUCCESS=1
    fi
fi

if [ ${PUSH_SUCCESS} -eq 1 ]; then
    log_ok "GitOps update completed successfully"
else
    log_error "ERROR: Failed to push GitOps commit to origin/${GIT_BRANCH}"
    exit 1
fi

