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
log_info "Step 1/5 — Stopping previous application deployment for project '${COMPOSE_PROJECT_NAME}'..."
docker compose down --remove-orphans 2>/dev/null || {
    docker compose stop mongodb backend frontend nginx 2>/dev/null || true
    docker compose rm -f mongodb backend frontend nginx 2>/dev/null || true
}
log_ok "Previous application containers stopped"

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

# ── Step 4: Deploy (Helm on K3s or Docker Compose) ───────────────────────────
DEPLOY_METHOD="${DEPLOY_METHOD:-helm}"

if [ "$DEPLOY_METHOD" = "helm" ] && command -v helm &>/dev/null; then
    log_info "Step 4/5 — Deploying application via Helm on Kubernetes (K3s)..."
    export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
    IMAGE_TAG="${BUILD_NUMBER:-latest}"
    HELM_CHART_DIR="${SCRIPT_DIR}/../../helm/civicpulse"

    if [ ! -d "$HELM_CHART_DIR" ]; then
        HELM_CHART_DIR="helm/civicpulse"
    fi

    log_info "Running Helm lint..."
    helm lint "$HELM_CHART_DIR"

    log_info "Executing Helm upgrade/install for release 'civicpulse' (tag: ${IMAGE_TAG})..."
    helm upgrade --install civicpulse "$HELM_CHART_DIR" \
        --namespace civicpulse \
        --create-namespace \
        --set backend.image.tag="${IMAGE_TAG}" \
        --set frontend.image.tag="${IMAGE_TAG}" \
        --set nginx.image.tag="${IMAGE_TAG}"

    log_ok "Helm deployment applied successfully"
else
    log_info "Step 4/5 — Starting fresh application deployment via Docker Compose..."
    if ! docker compose up -d --build --force-recreate mongodb backend frontend nginx 2>&1; then
        log_warn "First docker compose up attempt encountered an issue. Checking for storage volume incompatibilities..."
        if docker logs civicpulse-mongodb 2>&1 | grep -E -q "exitCode.*62|featureCompatibilityVersion"; then
            log_warn "Detected incompatible MongoDB data directory (exitCode 62). Pruning stale volume and retrying..."
            docker compose down -v 2>/dev/null || true
            docker volume rm "${COMPOSE_PROJECT_NAME}_mongodb-data" 2>/dev/null || true
            docker compose up -d --build --force-recreate mongodb backend frontend nginx
        else
            log_error "docker compose up failed!"
            docker compose logs --tail 30 2>/dev/null || true
            exit 1
        fi
    fi
    log_ok "Docker Compose deployment initiated"
fi

# ── Step 5: Verify Deployment ────────────────────────────────────────────────
log_info "Step 5/5 — Verifying deployment status..."
sleep 5

if [ "$DEPLOY_METHOD" = "helm" ] && command -v helm &>/dev/null && command -v kubectl &>/dev/null; then
    export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
    log_info "Kubernetes Pods in 'civicpulse' namespace:"
    kubectl get pods -n civicpulse 2>/dev/null || true
    echo ""
    log_info "Kubernetes Services in 'civicpulse' namespace:"
    kubectl get services -n civicpulse 2>/dev/null || true
    echo ""
    log_info "Helm release status:"
    helm list -n civicpulse 2>/dev/null || true
else
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
        if docker logs civicpulse-mongodb 2>&1 | grep -E -q "exitCode.*62|featureCompatibilityVersion"; then
            log_warn "MongoDB failed due to stale incompatible volume format (exitCode 62). Performing self-healing volume recovery..."
            docker compose down -v 2>/dev/null || true
            docker volume rm "${COMPOSE_PROJECT_NAME}_mongodb-data" 2>/dev/null || true
            log_info "Retrying fresh deployment after volume recovery..."
            docker compose up -d --build --force-recreate mongodb backend frontend nginx
        else
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
    fi
fi

echo ""
log_ok "═══════════════════════════════════════════════════"
log_ok "  Deployment successful — application is live"
log_ok "═══════════════════════════════════════════════════"

