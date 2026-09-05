#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Conservative Post-Build Cleanup Script
# ============================================================================
# Safely cleans up temporary files, exited containers, and dangling images.
# Intentionally PRESERVES Docker BuildKit cache and required images.
# Called by Jenkinsfile post-actions.
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
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[CLEANUP]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[CLEANUP]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[CLEANUP]${NC} ⚠️  $*"; }

echo ""
echo "════════════════════════════════════════"
echo "  🧹 Conservative Post-Build Cleanup"
echo "════════════════════════════════════════"
echo ""

# ── Display Initial Disk Usage ────────────────────────────────────────────────
log_info "Docker disk usage BEFORE cleanup:"
docker system df 2>/dev/null || log_warn "Could not query Docker disk usage"
echo ""

# ── Step 1: Remove Exited Temporary Containers ────────────────────────────────
log_info "Removing exited temporary containers..."
docker container prune -f --filter "until=1h" 2>/dev/null || true
log_ok "Exited container cleanup complete"

# ── Step 2: Remove Dangling Untagged Images ───────────────────────────────────
log_info "Removing dangling untagged Docker images (<none>:<none>)..."
DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null || true)
if [ -n "$DANGLING" ]; then
    echo "$DANGLING" | xargs docker rmi -f 2>/dev/null || true
    log_ok "Dangling images removed"
else
    log_info "No dangling images found"
fi

# ── Step 3: Remove Unused Docker Networks ─────────────────────────────────────
log_info "Pruning unused temporary Docker networks..."
docker network prune -f 2>/dev/null || true
log_ok "Network cleanup complete"

# ── Step 4: Remove Temporary Files ────────────────────────────────────────────
log_info "Removing temporary files..."
rm -rf /tmp/civicpulse-* 2>/dev/null || true
rm -rf /tmp/npm-* 2>/dev/null || true
log_ok "Temporary files cleaned"

# ── Step 5: Preserve BuildKit Cache Notice ─────────────────────────────────────
log_info "BuildKit layer cache is intentionally PRESERVED for fast incremental builds."

# ── Summary & Final Disk Usage ────────────────────────────────────────────────
echo ""
log_info "Docker disk usage AFTER cleanup:"
docker system df 2>/dev/null || log_warn "Could not query Docker disk usage"

echo ""
log_ok "═══════════════════════════════════════════════════"
log_ok "  Conservative cleanup complete"
log_ok "═══════════════════════════════════════════════════"
