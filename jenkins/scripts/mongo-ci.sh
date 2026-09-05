#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — MongoDB CI Test Database Lifecycle Helper
# ============================================================================
# Manages the temporary MongoDB container (civicpulse-ci-mongodb) used during
# CI/CD backend unit & integration tests.
# ============================================================================
set -euo pipefail

# ── Colors & Logging ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[MONGO-CI]${NC} $*"; }
log_ok()   { echo -e "${GREEN}[MONGO-CI]${NC} ✅ $*"; }
log_warn() { echo -e "${YELLOW}[MONGO-CI]${NC} ⚠️  $*"; }
log_err()  { echo -e "${RED}[MONGO-CI]${NC} ❌ $*"; }

CONTAINER_NAME="civicpulse-ci-mongodb"
MONGO_PORT="27017"
MAX_RETRIES=30

# ── Ensure Docker CLI in PATH ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    # Fallback search common Docker Desktop installation paths on Windows/Linux
    DOCKER_PATHS=(
        "/usr/bin"
        "/usr/local/bin"
        "/mnt/c/Users/Tharun Adhithyaa/AppData/Local/Programs/DockerDesktop/resources/bin"
        "/c/Users/Tharun Adhithyaa/AppData/Local/Programs/DockerDesktop/resources/bin"
        "/c/Program Files/Docker/Docker/resources/bin"
    )
    for p in "${DOCKER_PATHS[@]}"; do
        if [ -x "${p}/docker" ] || [ -x "${p}/docker.exe" ]; then
            export PATH="${p}:${PATH}"
            break
        fi
    done
fi

# ── 1. Preflight Verification ─────────────────────────────────────────────────
preflight_check() {
    log_info "Performing Docker preflight checks..."
    if ! command -v docker &>/dev/null; then
        log_err "FATAL: 'docker' CLI is not found in PATH."
        log_err "PATH is currently: ${PATH}"
        log_err "Ensure Docker Desktop or Docker Engine is installed and added to the environment PATH."
        exit 1
    fi

    log_info "Docker CLI version: $(docker --version)"

    if ! docker info &>/dev/null; then
        log_err "FATAL: Cannot connect to the Docker daemon via 'docker info'."
        log_err "Verify Docker Desktop or the Docker daemon service is running."
        exit 1
    fi

    log_ok "Docker CLI and daemon preflight checks passed"
}

# ── Port Check Helper ────────────────────────────────────────────────────────
check_port() {
    if command -v nc &>/dev/null; then
        nc -z 127.0.0.1 "${MONGO_PORT}" &>/dev/null
    else
        (exec 3<>/dev/tcp/127.0.0.1/"${MONGO_PORT}") &>/dev/null
    fi
}

# ── 2. Start Container & Wait for Readiness ───────────────────────────────────
start_mongodb() {
    preflight_check

    echo ""
    echo "════════════════════════════════════════"
    echo "  🍃 MongoDB CI Test Database Startup"
    echo "════════════════════════════════════════"
    echo ""

    log_info "Checking MongoDB connectivity on 127.0.0.1:${MONGO_PORT}..."
    if check_port; then
        log_info "MongoDB is already listening on 127.0.0.1:${MONGO_PORT}"
    else
        log_info "Starting MongoDB container '${CONTAINER_NAME}'..."
        docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
        docker run -d \
            --name "${CONTAINER_NAME}" \
            -p "${MONGO_PORT}:${MONGO_PORT}" \
            mongo:8.0
        log_ok "Container '${CONTAINER_NAME}' created"
    fi

    log_info "Waiting for MongoDB container readiness..."
    RETRY_COUNT=0
    READY=0

    while [ "${RETRY_COUNT}" -lt "${MAX_RETRIES}" ]; do
        if check_port; then
            if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
                PING_RES=$(docker exec "${CONTAINER_NAME}" mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || true)
                if [ "${PING_RES}" = "1" ] || echo "${PING_RES}" | grep -q "1"; then
                    READY=1
                    break
                fi
            else
                READY=1
                break
            fi
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "⏳ Waiting for MongoDB... (${RETRY_COUNT}/${MAX_RETRIES})"
        sleep 1
    done

    if [ "${READY}" -eq 1 ]; then
        log_ok "MongoDB is ready and listening on 127.0.0.1:${MONGO_PORT}"
    else
        log_err "FATAL: MongoDB did not become ready on 127.0.0.1:${MONGO_PORT} within ${MAX_RETRIES} seconds"
        log_err "Fetching container logs:"
        docker logs "${CONTAINER_NAME}" 2>&1 || true
        docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
        exit 1
    fi
}

# ── 3. Stop & Clean Container ─────────────────────────────────────────────────
stop_mongodb() {
    log_info "Cleaning up temporary MongoDB container '${CONTAINER_NAME}'..."
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
        log_ok "Container '${CONTAINER_NAME}' removed successfully"
    else
        log_info "Container '${CONTAINER_NAME}' is not running"
    fi
}

# ── Main Entrypoint ───────────────────────────────────────────────────────────
COMMAND="${1:-start}"

case "${COMMAND}" in
    preflight)
        preflight_check
        ;;
    start)
        start_mongodb
        ;;
    stop|clean)
        stop_mongodb
        ;;
    *)
        echo "Usage: $0 {preflight|start|stop}"
        exit 1
        ;;
esac
