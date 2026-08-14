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

# ── Step 4: Deploy (Docker Compose or Helm) ──────────────────────────────────
DEPLOY_METHOD="${DEPLOY_METHOD:-docker-compose}"

if [ "$DEPLOY_METHOD" = "helm" ] && command -v helm &>/dev/null; then
    log_info "Step 4/5 — Deploying application via Helm on Kubernetes (K3s)..."
    export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
    IMAGE_TAG="${IMAGE_TAG:-${BUILD_NUMBER:-latest}}"
    HELM_CHART_DIR="${SCRIPT_DIR}/../../helm/civicpulse"

    if [ ! -d "$HELM_CHART_DIR" ]; then
        HELM_CHART_DIR="helm/civicpulse"
    fi

    log_info "Running Helm lint..."
    helm lint "$HELM_CHART_DIR"

    log_info "Verifying rendered Helm manifest for tag '${IMAGE_TAG}'..."
    RENDERED=$(helm template civicpulse "$HELM_CHART_DIR" \
        --namespace civicpulse \
        --set backend.image.tag="${IMAGE_TAG}" \
        --set frontend.image.tag="${IMAGE_TAG}" \
        --set nginx.image.tag="${IMAGE_TAG}")

    if ! echo "$RENDERED" | grep -q "civicpulse-backend:${IMAGE_TAG}"; then
        log_error "Rendered manifest missing expected backend tag '${IMAGE_TAG}'"
        exit 1
    fi
    if ! echo "$RENDERED" | grep -q "civicpulse-frontend:${IMAGE_TAG}"; then
        log_error "Rendered manifest missing expected frontend tag '${IMAGE_TAG}'"
        exit 1
    fi
    if ! echo "$RENDERED" | grep -q "civicpulse-nginx:${IMAGE_TAG}"; then
        log_error "Rendered manifest missing expected nginx tag '${IMAGE_TAG}'"
        exit 1
    fi
    if ! echo "$RENDERED" | grep -q "ghcr-secret"; then
        log_error "Rendered manifest missing imagePullSecrets 'ghcr-secret'"
        exit 1
    fi
    log_ok "Rendered Helm manifest verified: all images set to '${IMAGE_TAG}' with 'ghcr-secret'"

    GHCR_USER="${GHCR_USER:-${GHCR_OWNER:-tharunadhithyaa}}"
    if [ -n "${GHCR_TOKEN:-}" ]; then
        log_info "Ensuring secret 'ghcr-secret' exists in namespace 'civicpulse'..."
        kubectl create namespace civicpulse --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true
        kubectl create secret docker-registry ghcr-secret \
            --namespace civicpulse \
            --docker-server="${GHCR_REGISTRY:-ghcr.io}" \
            --docker-username="${GHCR_USER}" \
            --docker-password="${GHCR_TOKEN}" \
            --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1
        log_ok "Kubernetes secret 'ghcr-secret' successfully created/updated in 'civicpulse' namespace"
    else
        log_info "Checking if Kubernetes secret 'ghcr-secret' exists in 'civicpulse' namespace..."
        if kubectl get secret ghcr-secret -n civicpulse &>/dev/null; then
            log_ok "Existing Kubernetes secret 'ghcr-secret' confirmed in 'civicpulse' namespace"
        else
            log_warn "Kubernetes secret 'ghcr-secret' not found in 'civicpulse' namespace and no GHCR credentials supplied."
        fi
    fi

    log_info "Executing Helm upgrade/install for release 'civicpulse' (tag: ${IMAGE_TAG})..."
    helm upgrade --install civicpulse "$HELM_CHART_DIR" \
        --namespace civicpulse \
        --create-namespace \
        --set backend.image.tag="${IMAGE_TAG}" \
        --set frontend.image.tag="${IMAGE_TAG}" \
        --set nginx.image.tag="${IMAGE_TAG}"

    log_ok "Helm deployment applied successfully"

    log_info "Verifying rollout status for Kubernetes workloads in 'civicpulse' namespace..."
    ROLLOUT_FAILED=0

    log_info "Checking statefulset/civicpulse-mongodb..."
    kubectl -n civicpulse rollout status statefulset/civicpulse-mongodb --timeout=120s || ROLLOUT_FAILED=1

    log_info "Checking deployment/civicpulse-backend..."
    kubectl -n civicpulse rollout status deployment/civicpulse-backend --timeout=120s || ROLLOUT_FAILED=1

    log_info "Checking deployment/civicpulse-frontend..."
    kubectl -n civicpulse rollout status deployment/civicpulse-frontend --timeout=120s || ROLLOUT_FAILED=1

    log_info "Checking deployment/civicpulse-nginx..."
    kubectl -n civicpulse rollout status deployment/civicpulse-nginx --timeout=120s || ROLLOUT_FAILED=1

    if [ "$ROLLOUT_FAILED" -ne 0 ]; then
        log_error "Kubernetes deployment rollout failed! Workloads are not ready."
        log_info "Current Pod status:"
        kubectl get pods -n civicpulse 2>/dev/null || true
        log_info "Recent Kubernetes events:"
        kubectl get events -n civicpulse --sort-by=.lastTimestamp 2>/dev/null | tail -n 20 || true
        exit 1
    fi

    log_ok "All Kubernetes workloads successfully rolled out and are Ready!"
else
    log_info "Step 4/5 — Starting fresh application deployment via Docker Compose..."
    if ! docker compose up -d --build --force-recreate mongodb backend frontend nginx; then
        log_warn "First docker compose up attempt encountered an issue. Checking for storage volume incompatibilities..."
        if docker logs civicpulse-mongodb 2>&1 | grep -E -q "exitCode.*62|featureCompatibilityVersion"; then
            log_warn "Detected incompatible MongoDB data directory (exitCode 62). Pruning stale volume and retrying..."
            docker compose down -v 2>/dev/null || true
            docker volume rm "${COMPOSE_PROJECT_NAME}_mongodb-data" 2>/dev/null || true
            if ! docker compose up -d --build --force-recreate mongodb backend frontend nginx; then
                log_error "docker compose up failed on retry!"
                echo ""
                log_error "Dumping Docker Compose logs for diagnosis:"
                docker compose logs --tail=50 2>&1 || true
                exit 1
            fi
        else
            log_error "docker compose up failed!"
            echo ""
            log_error "Dumping Docker Compose logs for diagnosis:"
            docker compose logs --tail=50 2>&1 || true
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
    log_info "Docker Compose Services Status (docker compose ps):"
    docker compose ps 2>/dev/null || true
    echo ""
    log_info "Running Docker Containers (docker ps):"
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
    echo ""

    EXPECTED_SERVICES=("mongodb" "backend" "frontend" "nginx")
    FAILED=0

    for svc in "${EXPECTED_SERVICES[@]}"; do
        CID=$(docker compose ps -q "$svc" 2>/dev/null | head -1 || true)
        if [ -z "$CID" ]; then
            CID=$(docker ps -aq --filter "name=${svc}" 2>/dev/null | head -1 || true)
        fi

        if [ -n "$CID" ]; then
            STATUS=$(docker inspect -f '{{.State.Status}}' "$CID" 2>/dev/null || echo "not_found")
            CNAME=$(docker inspect -f '{{.Name}}' "$CID" 2>/dev/null | sed 's/^\///' || echo "$svc")
            if [ "$STATUS" = "running" ]; then
                log_ok "Service '$svc' ($CNAME) is running"
            else
                log_error "Service '$svc' ($CNAME) status: $STATUS"
                FAILED=$((FAILED + 1))
            fi
        else
            log_error "Service '$svc' — no container found"
            FAILED=$((FAILED + 1))
        fi
    done

    if [ $FAILED -gt 0 ]; then
        log_error "$FAILED service(s) failed to start"
        log_info "Dumping logs for services..."
        docker compose logs --tail=50 2>&1 || true
        exit 1
    fi
fi

echo ""
log_ok "═══════════════════════════════════════════════════"
log_ok "  Deployment successful — application is live"
log_ok "═══════════════════════════════════════════════════"



