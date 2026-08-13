#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Deployment Report Generator
# ============================================================================
# Generates a structured deployment report with build metadata, container
# status, and service information. Called by Jenkinsfile Stage 9.
#
# Usage:
#   ./generate-report.sh --build-number 42 --commit abc1234 \
#       --branch main --app-url http://localhost --env production
# ============================================================================
set -uo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[REPORT]${NC} $*"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
BUILD_NUMBER="${BUILD_NUMBER:-unknown}"
GIT_COMMIT="unknown"
GIT_BRANCH="unknown"
APP_URL="http://localhost"
DEPLOY_ENV="development"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-number) BUILD_NUMBER="$2"; shift 2 ;;
        --commit)       GIT_COMMIT="$2";   shift 2 ;;
        --branch)       GIT_BRANCH="$2";   shift 2 ;;
        --app-url)      APP_URL="$2";      shift 2 ;;
        --env)          DEPLOY_ENV="$2";   shift 2 ;;
        *) shift ;;
    esac
done

# ── Gather Data ───────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
HOSTNAME_VAL=$(hostname 2>/dev/null || echo "unknown")

# ── Create Reports Directory ─────────────────────────────────────────────────
mkdir -p jenkins/reports

# ── Report File ───────────────────────────────────────────────────────────────
REPORT_FILE="jenkins/reports/deployment-report-${BUILD_NUMBER}.txt"

# ── Generate Report ───────────────────────────────────────────────────────────
{
cat <<REPORT_HEADER
╔══════════════════════════════════════════════════════════════════╗
║              CivicPulseAI — DEPLOYMENT REPORT                   ║
╚══════════════════════════════════════════════════════════════════╝

─── Build Information ─────────────────────────────────────────────
  Build Number     : #${BUILD_NUMBER}
  Git Commit       : ${GIT_COMMIT}
  Git Branch       : ${GIT_BRANCH}
  Environment      : ${DEPLOY_ENV}
  Timestamp        : ${TIMESTAMP}
  Host             : ${HOSTNAME_VAL}

REPORT_HEADER

echo "─── Docker Images ─────────────────────────────────────────────"
docker images --format "  {{.Repository}}:{{.Tag}}  {{.Size}}  (created {{.CreatedSince}})" 2>/dev/null | \
    grep "civicpulse" || echo "  (no civicpulse images found)"
echo ""

echo "─── Container Status ──────────────────────────────────────────"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
docker compose ps 2>/dev/null || echo "  (docker compose not available)"
echo ""

echo "─── Container Health ──────────────────────────────────────────"
for container in civicpulse-mongodb civicpulse-backend civicpulse-frontend civicpulse-nginx; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
    HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "N/A")
    UPTIME=$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null || echo "N/A")
    printf "  %-25s Status: %-10s Health: %-10s Started: %s\n" "$container" "$STATUS" "$HEALTH" "$UPTIME"
done
echo ""

echo "─── Running Services ────────────────────────────────────────"
echo "  • MongoDB    : mongodb://localhost:27017"
echo "  • Backend API: http://localhost:8000/api/health"
echo "  • Frontend   : http://localhost:4200"
echo "  • Nginx Proxy: ${APP_URL}"
echo ""

echo "─── Network Information ───────────────────────────────────────"
docker network ls --format "  {{.Name}}  {{.Driver}}  {{.Scope}}" 2>/dev/null | \
    grep "civicpulse" || echo "  (no civicpulse networks found)"
echo ""

echo "─── Volume Information ────────────────────────────────────────"
docker volume ls --format "  {{.Name}}  {{.Driver}}" 2>/dev/null | \
    grep "civicpulse" || echo "  (no civicpulse volumes found)"
echo ""

echo "─── Disk Usage ──────────────────────────────────────────────"
docker system df 2>/dev/null || echo "  (not available)"
echo ""

cat <<REPORT_FOOTER
═══════════════════════════════════════════════════════════════════
  Report generated at: ${TIMESTAMP}
  Build: #${BUILD_NUMBER} | Branch: ${GIT_BRANCH} | Env: ${DEPLOY_ENV}
═══════════════════════════════════════════════════════════════════
REPORT_FOOTER
} | tee "$REPORT_FILE"

log_info "Report saved to: $REPORT_FILE"
