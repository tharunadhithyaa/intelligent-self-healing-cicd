#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Trivy Vulnerability Database Initialization & Retry Script
# ============================================================================
# Ensures the Trivy vulnerability database is downloaded and cached reliably.
# Prevents HTTP/2 stream errors (PROTOCOL_ERROR), iterates individual OCI mirror
# candidate repositories for Trivy 0.52.2 compatibility, retries with backoff,
# and preserves persistent cache outside the Jenkins workspace (~/.cache/trivy).
# Called by Jenkinsfile before running Trivy scans.
# ============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[TRIVY]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[TRIVY]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[TRIVY]${NC} ⚠️  $*"; }
log_error() { echo -e "${RED}[TRIVY]${NC} ❌ $*"; }

# ── Environment & Network Optimization ────────────────────────────────────────
# Force HTTP/1.1 for Go HTTP client to prevent HTTP/2 frame stream protocol errors (PROTOCOL_ERROR)
export HTTP2_DISABLE=true
export GODEBUG="http2client=0"
export DISABLE_HTTP2=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Resolve persistent cache directory outside Jenkins workspace
DEFAULT_CACHE="${HOME:-/tmp}/.cache/trivy"
CACHE_DIR="${TRIVY_CACHE_DIR:-${DEFAULT_CACHE}}"
mkdir -p "${CACHE_DIR}"
export TRIVY_CACHE_DIR="${CACHE_DIR}"

log_info "Trivy version:"
trivy --version 2>/dev/null || echo "trivy version unavailable"
log_info "Cache directory: ${CACHE_DIR}"
log_info "Checking existing vulnerability database..."

DB_FILE="${CACHE_DIR}/db/trivy.db"
MAX_ATTEMPTS=3
DB_SUCCESS=0

check_db_validity() {
    if [ -f "${DB_FILE}" ] && [ -s "${DB_FILE}" ]; then
        local size_bytes
        size_bytes=$(wc -c < "${DB_FILE}" 2>/dev/null || stat -c%s "${DB_FILE}" 2>/dev/null || echo 0)
        # Valid trivy.db is >10MB (typically ~40MB to ~100MB)
        if [ "${size_bytes}" -gt 10485760 ]; then
            return 0
        fi
    fi
    return 1
}

clean_corrupted_cache() {
    log_warn "Purging incomplete Trivy database files..."
    rm -rf "${CACHE_DIR}/db/trivy.db"* 2>/dev/null || true
    rm -rf "${CACHE_DIR}/db/metadata.json"* 2>/dev/null || true
    rm -rf "${CACHE_DIR}/db/tmp"* 2>/dev/null || true
}

if check_db_validity; then
    log_ok "Valid existing vulnerability database found in persistent cache."
else
    log_info "No valid existing vulnerability database found in persistent cache."
fi

# Candidate OCI repositories tested individually for Trivy 0.52.2 compatibility
REPOS=(
    "mirror.gcr.io/aquasec/trivy-db:2"
    "ghcr.io/aquasecurity/trivy-db:2"
)

log_info "Configured DB repositories:"
for repo in "${REPOS[@]}"; do
    log_info "  - ${repo}"
done
log_info "Updating vulnerability database..."

DELAYS=(10 20 30)

for i in $(seq 1 ${MAX_ATTEMPTS}); do
    attempt=$i
    delay=${DELAYS[$((i-1))]}
    
    log_info "DB update attempt ${attempt}/${MAX_ATTEMPTS}"

    for repo in "${REPOS[@]}"; do
        log_info "Downloading vulnerability DB from repository: ${repo}..."
        
        if trivy fs \
            --cache-dir "${CACHE_DIR}" \
            --download-db-only \
            --db-repository "${repo}" \
            --timeout 15m \
            "${REPO_ROOT}"; then
            
            if check_db_validity; then
                DB_SUCCESS=1
                log_ok "Vulnerability database successfully initialized from '${repo}'."
                log_ok "Persistent cache is ready."
                break 2
            fi
        fi
        
        log_warn "Failed to download DB from '${repo}'."
    done

    log_warn "DB update attempt ${attempt}/${MAX_ATTEMPTS} failed."

    if [ ${attempt} -lt ${MAX_ATTEMPTS} ]; then
        log_info "Waiting ${delay} seconds before retry..."
        sleep "${delay}"
    fi
done

if [ ${DB_SUCCESS} -ne 1 ]; then
    if check_db_validity; then
        log_warn "DB update failed after ${MAX_ATTEMPTS} attempts, but a valid cached database exists at '${DB_FILE}'."
        log_warn "Proceeding with scan using existing cached vulnerability database."
        log_ok "Vulnerability database verification complete."
        exit 0
    fi

    # Database genuinely unavailable - purge bad cache & print diagnostic breakdown
    clean_corrupted_cache
    log_error "ERROR: Failed to download vulnerability database after ${MAX_ATTEMPTS} attempts and no valid cached database exists."
    log_error "Executing diagnostic checks..."

    log_info "--- Diagnostics Breakdown ---"
    
    if getent hosts ghcr.io >/dev/null 2>&1; then
        log_info "[TRIVY] DNS resolution (ghcr.io): OK ($(getent hosts ghcr.io | awk '{print $1}' | head -1))"
    else
        log_error "[TRIVY] DNS resolution (ghcr.io): FAILED"
    fi

    if getent hosts mirror.gcr.io >/dev/null 2>&1; then
        log_info "[TRIVY] DNS resolution (mirror.gcr.io): OK ($(getent hosts mirror.gcr.io | awk '{print $1}' | head -1))"
    else
        log_error "[TRIVY] DNS resolution (mirror.gcr.io): FAILED"
    fi

    if curl -4 -Is --connect-timeout 5 https://ghcr.io >/dev/null 2>&1; then
        log_info "[TRIVY] IPv4 HTTPS connectivity (ghcr.io): OK"
    else
        log_warn "[TRIVY] IPv4 HTTPS connectivity (ghcr.io): FAILED"
    fi

    if curl -6 -Is --connect-timeout 5 https://ghcr.io >/dev/null 2>&1; then
        log_info "[TRIVY] IPv6 HTTPS connectivity (ghcr.io): OK"
    else
        log_warn "[TRIVY] IPv6 HTTPS connectivity (ghcr.io): FAILED / NAT64 issue"
    fi

    if curl -4 -Is --connect-timeout 5 https://mirror.gcr.io >/dev/null 2>&1; then
        log_info "[TRIVY] IPv4 HTTPS connectivity (mirror.gcr.io): OK"
    else
        log_warn "[TRIVY] IPv4 HTTPS connectivity (mirror.gcr.io): FAILED"
    fi

    log_error "[TRIVY] OCI vulnerability DB download: FAILED"
    log_error "Vulnerability database is unavailable. Aborting scan."
    exit 1
fi

log_ok "Vulnerability database verification complete."
