#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Deployment Script
# ============================================================================
# Orchestrates graceful shutdown, cleanup, and fresh deployment via
# Docker Compose. Called by Jenkinsfile Stage 7.
# ============================================================================
set -euo pipefail

# ── Load pipeline environment variables ───────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../config/pipeline.env" ]; then
    set +u
    source "${SCRIPT_DIR}/../config/pipeline.env"
    set -u
fi

# Export project name for Docker Compose
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-civicpulse}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[DEPLOY]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[DEPLOY]${NC} ⚠️  $*"; }
log_error() { echo -e "${RED}[DEPLOY]${NC} ❌ $*"; }

# ── Step 1: Graceful Shutdown ─────────────────────────────────────────────────
log_info "Step 1/5 — Stopping previous deployment for project '${COMPOSE_PROJECT_NAME}'..."
docker compose down --remove-orphans --timeout 30 2>/dev/null || {
    log_warn "No previous deployment found or already stopped"
}
log_ok "Previous containers stopped"

# ── Step 1.5: Resolve Potential Container Name Conflicts ──────────────────────
log_info "Checking for potential container name conflicts..."
CONFLICTING_CONTAINERS=(
    "${MONGODB_CONTAINER:-civicpulse-mongodb}"
    "${BACKEND_CONTAINER:-civicpulse-backend}"
    "${FRONTEND_CONTAINER:-civicpulse-frontend}"
    "${NGINX_CONTAINER:-civicpulse-nginx}"
)

for container in "${CONFLICTING_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -Eq "^${container}$"; then
        log_warn "Conflicting container '$container' detected (possibly from another compose project or manual run)."
        log_info "Stopping and removing '$container' to ensure deployment idempotency..."
        docker stop "$container" 2>/dev/null || true
        docker rm -f "$container" 2>/dev/null || true
        log_ok "Successfully cleared conflicting container: $container"
    fi
done

# ── Step 2: Remove Exited Containers ─────────────────────────────────────────
log_info "Step 2/5 — Removing exited containers..."
EXITED=$(docker ps -aq --filter "status=exited" --filter "name=civicpulse" 2>/dev/null || true)
if [ -n "$EXITED" ]; then
    echo "$EXITED" | xargs docker rm -f 2>/dev/null || true
    log_ok "Removed exited containers"
else
    log_info "No exited containers to remove"
fi

# ── Step 3: Clean Unused Networks ────────────────────────────────────────────
log_info "Step 3/5 — Pruning unused Docker networks..."
docker network prune -f 2>/dev/null || true
log_ok "Network cleanup complete"

# ── Step 4: Deploy Fresh ─────────────────────────────────────────────────────
log_info "Step 4/5 — Starting fresh deployment..."
if ! docker compose up -d --build --force-recreate 2>&1; then
    log_error "docker compose up failed!"
    docker compose logs --tail 30 2>/dev/null || true
    exit 1
fi
log_ok "Docker Compose deployment initiated"

# ── Step 5: Verify Containers Are Running ────────────────────────────────────
log_info "Step 5/5 — Verifying container startup..."
sleep 5

EXPECTED_CONTAINERS=("civicpulse-mongodb" "civicpulse-backend" "civicpulse-frontend" "civicpulse-nginx")
FAILED=0

for container in "${EXPECTED_CONTAINERS[@]}"; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
    if [ "$STATUS" = "running" ]; then
        log_ok "$container is running"
    else
        log_error "$container status: $STATUS"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
log_info "Container overview:"
docker compose ps 2>/dev/null || true

if [ $FAILED -gt 0 ]; then
    log_error "$FAILED container(s) failed to start"
    log_info "Dumping logs for failed containers..."
    for container in "${EXPECTED_CONTAINERS[@]}"; do
        STATUS=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
        if [ "$STATUS" != "running" ]; then
            echo ""
            echo "── Logs: $container ──"
            docker logs --tail 30 "$container" 2>&1 || echo "(no logs available)"
        fi
    done
    exit 1
fi

echo ""
log_ok "═══════════════════════════════════════════════════"
log_ok "  Deployment successful — all containers running"
log_ok "═══════════════════════════════════════════════════"
