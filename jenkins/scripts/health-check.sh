#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Health Check Script
# ============================================================================
# Performs comprehensive health verification of all deployed services.
# Called by Jenkinsfile Stage 8.
#
# Usage:
#   ./health-check.sh --retries 10 --interval 15 \
#       --backend-url http://localhost:8000 --app-url http://localhost
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
MAX_RETRIES=10
INTERVAL=15
BACKEND_URL="http://localhost:8000"
APP_URL="http://localhost:4200"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --retries)      MAX_RETRIES="$2";   shift 2 ;;
        --interval)     INTERVAL="$2";      shift 2 ;;
        --backend-url)  BACKEND_URL="$2";   shift 2 ;;
        --app-url)      APP_URL="$2";       shift 2 ;;
        *) log_warn "Unknown argument: $1"; shift   ;;
    esac
done

# ── Health Check Functions ────────────────────────────────────────────────────

# Check an HTTP endpoint, return 0 if status code matches expected
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

# Check Docker container health status
check_container_health() {
    local container="$1"
    local health
    health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    local status
    status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")

    if [ "$status" != "running" ]; then
        log_warn "Container $container is not running (status: $status)"
        return 1
    fi

    case "$health" in
        healthy)
            log_ok "Container $container — healthy"
            return 0
            ;;
        starting)
            log_warn "Container $container — still starting"
            return 1
            ;;
        unhealthy)
            log_warn "Container $container — unhealthy"
            return 1
            ;;
        none|"")
            # No healthcheck defined, but container is running
            log_ok "Container $container — running (no healthcheck)"
            return 0
            ;;
        *)
            log_warn "Container $container — unknown health: $health"
            return 1
            ;;
    esac
}

# Check if a port is accepting connections
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

# Check database connectivity via the backend health endpoint
check_database() {
    local url="${BACKEND_URL}/api/health"
    local response
    response=$(curl -s --max-time 10 "$url" 2>/dev/null || echo '{}')

    local db_status
    db_status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

    if [ "$db_status" = "up" ]; then
        log_ok "Database connectivity — UP (via backend health endpoint)"
        return 0
    else
        log_warn "Database connectivity — status: $db_status"
        return 1
    fi
}

# ── Main Health Check Loop ────────────────────────────────────────────────────
log_info "Starting health verification..."
log_info "  Max retries : $MAX_RETRIES"
log_info "  Interval    : ${INTERVAL}s"
log_info "  Backend URL : $BACKEND_URL"
log_info "  App URL     : $APP_URL"
echo ""

ATTEMPT=0
ALL_HEALTHY=false

while [ $ATTEMPT -lt $MAX_RETRIES ]; do
    ATTEMPT=$((ATTEMPT + 1))
    FAILURES=0

    echo "────────────────────────────────────────"
    log_info "Health check attempt $ATTEMPT/$MAX_RETRIES"
    echo "────────────────────────────────────────"

    # 1. HTTP endpoint checks
    check_http "${BACKEND_URL}/api/health" "200" "Backend API /api/health"  || FAILURES=$((FAILURES + 1))
    check_http "${APP_URL}/health"         "200" "Nginx /health"            || FAILURES=$((FAILURES + 1))
    check_http "${APP_URL}/"               "200" "Frontend /"               || FAILURES=$((FAILURES + 1))

    # 2. Container health checks
    check_container_health "civicpulse-backend"  || FAILURES=$((FAILURES + 1))
    check_container_health "civicpulse-frontend" || FAILURES=$((FAILURES + 1))
    check_container_health "civicpulse-mongodb"  || FAILURES=$((FAILURES + 1))
    check_container_health "civicpulse-nginx"    || FAILURES=$((FAILURES + 1))

    # 3. Port availability
    check_port 80   "Nginx (HTTP)"       || FAILURES=$((FAILURES + 1))
    check_port 8000 "Backend API"        || FAILURES=$((FAILURES + 1))

    # 4. Database connectivity
    check_database || FAILURES=$((FAILURES + 1))

    echo ""
    if [ $FAILURES -eq 0 ]; then
        ALL_HEALTHY=true
        break
    fi

    if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        log_warn "$FAILURES check(s) failed — retrying in ${INTERVAL}s..."
        sleep "$INTERVAL"
    fi
done

echo ""
echo "════════════════════════════════════════"
if [ "$ALL_HEALTHY" = true ]; then
    log_ok "All health checks passed on attempt $ATTEMPT/$MAX_RETRIES"
    echo ""
    log_ok "═══════════════════════════════════════════════════"
    log_ok "  Application is healthy and ready to serve traffic"
    log_ok "═══════════════════════════════════════════════════"
    exit 0
else
    log_error "Health checks FAILED after $MAX_RETRIES attempts"
    echo ""
    log_error "Dumping container status for diagnosis:"
    docker compose ps 2>/dev/null || true
    echo ""
    log_error "Last 20 lines of container logs:"
    for c in civicpulse-backend civicpulse-frontend civicpulse-mongodb civicpulse-nginx; do
        echo ""
        echo "── $c ──"
        docker logs --tail 20 "$c" 2>&1 || echo "(not available)"
    done
    exit 1
fi
