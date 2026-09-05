#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Health Check Script
# ============================================================================
# Performs comprehensive health verification of deployed services across both
# Helm (Kubernetes/K3s) and Docker Compose deployment methods.
# Called by Jenkinsfile Stage 12.
#
# Usage:
#   ./health-check.sh --deploy-method helm --retries 10 --interval 15
#   ./health-check.sh --deploy-method docker-compose --retries 10 --interval 15
# ============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[HEALTH]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[HEALTH]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[HEALTH]${NC} ⚠️  $*"; }
log_error() { echo -e "${RED}[HEALTH]${NC} ❌ $*"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
DEPLOY_METHOD="${DEPLOY_METHOD:-helm}"
MAX_RETRIES=10
INTERVAL=15
BACKEND_URL="http://localhost:8000"
APP_URL="http://localhost:4200"
NAMESPACE="${NAMESPACE:-civicpulse}"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --deploy-method) DEPLOY_METHOD="$2"; shift 2 ;;
        --retries)       MAX_RETRIES="$2";   shift 2 ;;
        --interval)      INTERVAL="$2";      shift 2 ;;
        --backend-url)   BACKEND_URL="$2";   shift 2 ;;
        --app-url)       APP_URL="$2";       shift 2 ;;
        --namespace)     NAMESPACE="$2";     shift 2 ;;
        *) log_warn "Unknown argument: $1";  shift 1 ;;
    esac
done

# ── Kubeconfig Discovery Helper ──────────────────────────────────────────────
find_kubeconfig() {
    if [ -n "${KUBECONFIG:-}" ] && [ -f "${KUBECONFIG}" ] && [ -r "${KUBECONFIG}" ]; then
        return 0
    fi
    for candidate in "${HOME}/.kube/config" "/home/jenkins/.kube/config" "/home/tharun_adhithyaa/.kube/config" "/etc/rancher/k3s/k3s.yaml"; do
        if [ -f "$candidate" ] && [ -r "$candidate" ]; then
            export KUBECONFIG="$candidate"
            return 0
        fi
    done
    return 1
}

# ── Docker Compose Health Check Functions ────────────────────────────────────
check_http() {
    local url="$1"
    local expected_code="${2:-200}"
    local label="${3:-$url}"

    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [ "$status_code" = "$expected_code" ]; then
        log_ok "$label — HTTP $status_code"
        return 0
    else
        log_warn "$label — HTTP $status_code (expected $expected_code)"
        return 1
    fi
}

check_container_health() {
    local service="$1"
    local container_id

    container_id=$(docker compose ps -q "$service" 2>/dev/null | head -1 || true)
    if [ -z "$container_id" ]; then
        local fallback_name
        case "$service" in
            mongodb)  fallback_name="civicpulse-mongodb"  ;;
            backend)  fallback_name="civicpulse-backend"  ;;
            frontend) fallback_name="civicpulse-frontend" ;;
            nginx)    fallback_name="civicpulse-nginx"    ;;
            *)        fallback_name="civicpulse-${service}" ;;
        esac
        container_id=$(docker ps -aq --filter "name=^/${fallback_name}$" 2>/dev/null | head -1 || true)
        if [ -z "$container_id" ]; then
            container_id=$(docker ps -aq --filter "name=${fallback_name}" 2>/dev/null | head -1 || true)
        fi
    fi

    if [ -z "$container_id" ]; then
        log_warn "Service '$service' — no container found via 'docker compose ps' or name lookup"
        return 1
    fi

    local cname
    cname=$(docker inspect -f '{{.Name}}' "$container_id" 2>/dev/null | sed 's/^\///' || echo "$service")
    local status
    status=$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || echo "not_found")
    local health
    health=$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "none")

    if [ "$status" != "running" ]; then
        log_warn "Container $cname (service: $service) status: $status"
        return 1
    fi

    case "$health" in
        healthy|none|"")
            log_ok "Container $cname (service: $service) — running ($health)"
            return 0
            ;;
        *)
            log_warn "Container $cname (service: $service) — health: $health"
            return 1
            ;;
    esac
}

check_port() {
    local port="$1"
    local label="${2:-Port $port}"

    if curl -s --max-time 5 "http://localhost:$port" -o /dev/null 2>/dev/null; then
        log_ok "$label — port $port responding"
        return 0
    else
        log_warn "$label — port $port not responding"
        return 1
    fi
}

check_database() {
    local url="${BACKEND_URL}/api/health"
    local response
    response=$(curl -s --max-time 10 "$url" 2>/dev/null || echo '{}')

    local db_status
    db_status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

    if [ "$db_status" = "up" ] || [ "$db_status" = "UP" ]; then
        log_ok "Database connectivity — UP (via backend health endpoint)"
        return 0
    else
        log_warn "Database connectivity — status: $db_status"
        return 1
    fi
}

run_docker_compose_health_check() {
    log_info "Deployment method: docker-compose"
    log_info "Pre-check container overview:"
    echo "── Docker Compose Services (docker compose ps) ──"
    docker compose ps 2>/dev/null || true
    echo ""
    echo "── Running Docker Containers (docker ps) ──"
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
    echo ""

    local attempt=0
    local all_healthy=false

    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        local failures=0

        echo "────────────────────────────────────────"
        log_info "Docker Compose health check attempt $attempt/$MAX_RETRIES"
        echo "────────────────────────────────────────"

        check_http "${BACKEND_URL}/api/health" "200" "Backend API /api/health"  || failures=$((failures + 1))
        check_http "${APP_URL}/health"         "200" "Nginx /health"            || failures=$((failures + 1))
        check_http "${APP_URL}/"               "200" "Frontend /"               || failures=$((failures + 1))

        check_container_health "backend"  || failures=$((failures + 1))
        check_container_health "frontend" || failures=$((failures + 1))
        check_container_health "mongodb"  || failures=$((failures + 1))
        check_container_health "nginx"    || failures=$((failures + 1))

        check_port 80   "Nginx (HTTP)"       || failures=$((failures + 1))
        check_port 8000 "Backend API"        || failures=$((failures + 1))

        check_database || failures=$((failures + 1))

        echo ""
        if [ $failures -eq 0 ]; then
            all_healthy=true
            break
        fi

        if [ $attempt -lt $MAX_RETRIES ]; then
            log_warn "$failures check(s) failed — retrying in ${INTERVAL}s..."
            sleep "$INTERVAL"
        fi
    done

    if [ "$all_healthy" = true ]; then
        log_ok "All Docker Compose health checks passed on attempt $attempt/$MAX_RETRIES"
        exit 0
    else
        log_error "Docker Compose health checks FAILED after $MAX_RETRIES attempts"
        docker compose ps 2>/dev/null || true
        docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
        docker compose logs --tail=50 2>&1 || true
        exit 1
    fi
}

# ── Kubernetes Health Check Functions ─────────────────────────────────────────
run_kubernetes_health_check() {
    log_info "Deployment method: helm"
    log_info "Kubernetes namespace: $NAMESPACE"

    if ! find_kubeconfig; then
        log_error "No readable kubeconfig file found."
        exit 1
    fi

    log_info "Using KUBECONFIG=${KUBECONFIG}"
    log_info "Checking K3s cluster connectivity..."
    kubectl version --client --request-timeout=10s >/dev/null 2>&1 || true
    kubectl cluster-info --request-timeout=10s >/dev/null 2>&1 || true

    if ! kubectl get nodes --request-timeout=10s >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster using KUBECONFIG=${KUBECONFIG}."
        exit 1
    fi
    log_ok "K3s cluster accessible"

    log_info "Pre-check Kubernetes resource overview:"
    kubectl get pods -n "$NAMESPACE" -o wide --request-timeout=10s 2>/dev/null || true
    echo ""

    local attempt=0
    local all_healthy=false

    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        local failures=0

        echo "────────────────────────────────────────"
        log_info "Kubernetes health check attempt $attempt/$MAX_RETRIES"
        echo "────────────────────────────────────────"

        # 0. Check for any failing / stuck pods
        log_info "Checking for failed or extra pods in namespace '$NAMESPACE'..."
        local bad_pods
        bad_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers --request-timeout=10s 2>/dev/null | grep -v "Running" || true)
        if [ -n "$bad_pods" ]; then
            log_warn "Detected non-running pods in namespace '$NAMESPACE':"
            echo "$bad_pods"
            failures=$((failures + 1))
        fi

        # Verify exact 1 pod count per component
        for comp in backend frontend nginx mongodb; do
            local pod_count
            pod_count=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component="$comp" --no-headers --request-timeout=10s 2>/dev/null | wc -l | tr -d ' ')
            if [ "$pod_count" -eq 1 ]; then
                log_ok "Component '$comp' — exactly 1 pod found"
            else
                log_warn "Component '$comp' — expected 1 pod, found $pod_count pods"
                failures=$((failures + 1))
            fi
        done

        # 1. Workload Rollout Status Checks
        log_info "Checking Kubernetes workload rollouts..."
        if kubectl rollout status deployment/civicpulse-backend -n "$NAMESPACE" --timeout=15s >/dev/null 2>&1; then
            log_ok "Deployment civicpulse-backend — Ready"
        else
            log_warn "Deployment civicpulse-backend — Not ready"
            failures=$((failures + 1))
        fi

        if kubectl rollout status deployment/civicpulse-frontend -n "$NAMESPACE" --timeout=15s >/dev/null 2>&1; then
            log_ok "Deployment civicpulse-frontend — Ready"
        else
            log_warn "Deployment civicpulse-frontend — Not ready"
            failures=$((failures + 1))
        fi

        if kubectl rollout status deployment/civicpulse-nginx -n "$NAMESPACE" --timeout=15s >/dev/null 2>&1; then
            log_ok "Deployment civicpulse-nginx — Ready"
        else
            log_warn "Deployment civicpulse-nginx — Not ready"
            failures=$((failures + 1))
        fi

        if kubectl rollout status statefulset/civicpulse-mongodb -n "$NAMESPACE" --timeout=15s >/dev/null 2>&1; then
            log_ok "StatefulSet civicpulse-mongodb — Ready"
        else
            log_warn "StatefulSet civicpulse-mongodb — Not ready"
            failures=$((failures + 1))
        fi

        # 2. Service Endpoints Checks
        log_info "Checking Kubernetes service endpoints..."
        for svc in civicpulse-backend civicpulse-frontend civicpulse-mongodb civicpulse-nginx; do
            local ep_ip
            ep_ip=$(kubectl get endpoints "$svc" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' --request-timeout=10s 2>/dev/null || true)
            if [ -n "$ep_ip" ]; then
                log_ok "Service $svc — Endpoint IP(s): $ep_ip"
            else
                log_warn "Service $svc — No active endpoints"
                failures=$((failures + 1))
            fi
        done

        # 3. Backend API Internal Endpoint (/api/health)
        log_info "Checking Backend API (/api/health)..."
        local backend_pod
        backend_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=backend --no-headers --request-timeout=10s 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)
        if [ -n "$backend_pod" ]; then
            local b_resp
            b_resp=$(kubectl exec "$backend_pod" -n "$NAMESPACE" --request-timeout=10s -- wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || echo '{}')
            if echo "$b_resp" | grep -q '"status":"up"' || echo "$b_resp" | grep -q '"status":"UP"'; then
                log_ok "Backend API /api/health — UP (via pod $backend_pod)"
            else
                log_warn "Backend API /api/health — response: $b_resp"
                failures=$((failures + 1))
            fi
        else
            log_warn "Backend API — No running backend pod found for exec check"
            failures=$((failures + 1))
        fi

        # 4. Frontend Internal Endpoint (/)
        log_info "Checking Frontend static content (/)..."
        local frontend_pod
        frontend_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=frontend --no-headers --request-timeout=10s 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)
        if [ -n "$frontend_pod" ]; then
            local f_resp
            f_resp=$(kubectl exec "$frontend_pod" -n "$NAMESPACE" --request-timeout=10s -- wget -qO- http://127.0.0.1/ 2>/dev/null || echo '')
            if echo "$f_resp" | grep -q -E "<html|<app-root"; then
                log_ok "Frontend / — OK (via pod $frontend_pod)"
            else
                log_warn "Frontend / — unexpected response from pod $frontend_pod"
                failures=$((failures + 1))
            fi
        else
            log_warn "Frontend — No running frontend pod found for exec check"
            failures=$((failures + 1))
        fi

        # 5. Nginx Reverse Proxy Internal Endpoints (/health and /api/health)
        log_info "Checking Nginx Reverse Proxy (/health & /api/health)..."
        local nginx_pod
        nginx_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=nginx --no-headers --request-timeout=10s 2>/dev/null | grep 'Running' | awk '{print $1}' | head -1 || true)
        if [ -n "$nginx_pod" ]; then
            local n_health
            n_health=$(kubectl exec "$nginx_pod" -n "$NAMESPACE" --request-timeout=10s -- wget -qO- http://127.0.0.1/health 2>/dev/null || echo '')
            if [ "$n_health" = "OK" ]; then
                log_ok "Nginx /health — OK (via pod $nginx_pod)"
            else
                log_warn "Nginx /health — response: $n_health"
                failures=$((failures + 1))
            fi

            local n_api
            n_api=$(kubectl exec "$nginx_pod" -n "$NAMESPACE" --request-timeout=10s -- wget -qO- http://127.0.0.1/api/health 2>/dev/null || echo '{}')
            if echo "$n_api" | grep -q '"status":"up"' || echo "$n_api" | grep -q '"status":"UP"'; then
                log_ok "Nginx /api/health routing to backend — UP (via pod $nginx_pod)"
            else
                log_warn "Nginx /api/health routing — response: $n_api"
                failures=$((failures + 1))
            fi
        else
            log_warn "Nginx — No running nginx pod found for exec check"
            failures=$((failures + 1))
        fi

        echo ""
        if [ $failures -eq 0 ]; then
            all_healthy=true
            break
        fi

        if [ $attempt -lt $MAX_RETRIES ]; then
            log_warn "$failures check(s) failed — retrying in ${INTERVAL}s..."
            sleep "$INTERVAL"
        fi
    done

    echo ""
    echo "════════════════════════════════════════"
    if [ "$all_healthy" = true ]; then
        log_ok "All Kubernetes health checks passed on attempt $attempt/$MAX_RETRIES"
        echo ""
        log_ok "═══════════════════════════════════════════════════"
        log_ok "  CivicPulse Kubernetes Application is Healthy"
        log_ok "═══════════════════════════════════════════════════"
        exit 0
    else
        log_error "Kubernetes health checks FAILED after $MAX_RETRIES attempts"
        echo ""
        log_error "Dumping Kubernetes resources for diagnosis:"
        kubectl get pods -n "$NAMESPACE" -o wide --request-timeout=10s 2>/dev/null || true
        kubectl get deployments -n "$NAMESPACE" --request-timeout=10s 2>/dev/null || true
        kubectl get statefulsets -n "$NAMESPACE" --request-timeout=10s 2>/dev/null || true
        kubectl get services -n "$NAMESPACE" --request-timeout=10s 2>/dev/null || true
        kubectl get endpoints -n "$NAMESPACE" --request-timeout=10s 2>/dev/null || true
        kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' --request-timeout=10s 2>/dev/null || true

        log_error "Dumping logs for non-ready/unhealthy pods:"
        for pod in $(kubectl get pods -n "$NAMESPACE" --no-headers --request-timeout=10s 2>/dev/null | awk '{print $1}'); do
            log_info "--- Logs for pod $pod ---"
            kubectl logs "$pod" -n "$NAMESPACE" --tail=100 --request-timeout=10s 2>/dev/null || true
            kubectl logs "$pod" -n "$NAMESPACE" --previous --tail=100 --request-timeout=10s 2>/dev/null || true
        done
        exit 1
    fi
}

# ── Main Entrypoint ───────────────────────────────────────────────────────────
log_info "Starting health verification..."
log_info "  Deploy Method : $DEPLOY_METHOD"
log_info "  Max retries   : $MAX_RETRIES"
log_info "  Interval      : ${INTERVAL}s"
echo ""

case "$DEPLOY_METHOD" in
    helm|k8s|kubernetes)
        run_kubernetes_health_check
        ;;
    docker-compose|docker|compose)
        run_docker_compose_health_check
        ;;
    *)
        log_warn "Unknown deployment method '$DEPLOY_METHOD'. Defaulting to Helm/Kubernetes checks..."
        run_kubernetes_health_check
        ;;
esac
