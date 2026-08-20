#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Trivy Vulnerability Database Initialization & Retry Script
# ============================================================================
# Ensures the Trivy vulnerability database is downloaded and cached reliably.
# Prevents HTTP/2 stream errors (PROTOCOL_ERROR) over GHCR, prioritizes OCI
# mirrors, retries failed downloads, and cleans up partial/corrupt files.
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

# Resolve workspace persistent cache directory
CACHE_DIR="${TRIVY_CACHE_DIR:-${WORKSPACE:-${REPO_ROOT}}/.trivy-cache}"
mkdir -p "${CACHE_DIR}"
export TRIVY_CACHE_DIR="${CACHE_DIR}"

log_info "Checking vulnerability database..."
log_info "Trivy cache directory: ${CACHE_DIR}"

DB_FILE="${CACHE_DIR}/db/trivy.db"
MAX_ATTEMPTS=3
DB_SUCCESS=0

check_db_validity() {
    if [ -f "${DB_FILE}" ] && [ -s "${DB_FILE}" ]; then
        # Check if database is greater than 10MB (valid trivy.db is ~40-100MB)
        local size_bytes
        size_bytes=$(wc -c < "${DB_FILE}" 2>/dev/null || stat -c%s "${DB_FILE}" 2>/dev/null || echo 0)
        if [ "${size_bytes}" -gt 10485760 ]; then
            return 0
        fi
    fi
    return 1
}

clean_corrupted_cache() {
    log_warn "Cleaning partial or corrupted Trivy database files..."
    rm -rf "${CACHE_DIR}/db/trivy.db"* 2>/dev/null || true
    rm -rf "${CACHE_DIR}/db/metadata.json"* 2>/dev/null || true
    rm -rf "${CACHE_DIR}/db/tmp"* 2>/dev/null || true
}

log_info "Updating vulnerability database..."

for attempt in $(seq 1 ${MAX_ATTEMPTS}); do
    log_info "DB update attempt ${attempt}/${MAX_ATTEMPTS}"

    # Priority OCI repositories: Google Container Registry mirror followed by GHCR
    if trivy fs \
        --cache-dir "${CACHE_DIR}" \
        --download-db-only \
        --db-repository "mirror.gcr.io/aquasec/trivy-db:2,ghcr.io/aquasecurity/trivy-db:2" \
        --timeout 10m \
        "${REPO_ROOT}" >/dev/null 2>&1; then
        
        if check_db_validity; then
            DB_SUCCESS=1
            log_ok "Vulnerability database ready (Attempt ${attempt}/${MAX_ATTEMPTS})"
            break
        fi
    fi

    log_warn "DB update attempt ${attempt}/${MAX_ATTEMPTS} failed."
    clean_corrupted_cache

    if [ ${attempt} -lt ${MAX_ATTEMPTS} ]; then
        log_info "Waiting 5 seconds before retrying..."
        sleep 5
    fi
done

if [ ${DB_SUCCESS} -ne 1 ]; then
    if check_db_validity; then
        log_warn "DB update failed after ${MAX_ATTEMPTS} retries, but a valid cached database exists at '${DB_FILE}'."
        log_warn "Proceeding with scan using existing cached vulnerability database."
    else
        log_error "ERROR: Failed to download vulnerability database after ${MAX_ATTEMPTS} attempts and no valid cached database exists."
        log_error "Check network connectivity to ghcr.io and mirror.gcr.io."
        exit 1
    fi
fi

log_ok "Vulnerability database verification complete."
