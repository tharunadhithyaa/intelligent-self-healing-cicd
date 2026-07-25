#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Post-Build Cleanup Script
# ============================================================================
# Cleans up temporary Docker resources and build artifacts.
# Called by Jenkinsfile post-actions.
# ============================================================================
set -uo pipefail

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
echo "  🧹 Post-Build Cleanup"
echo "════════════════════════════════════════"
echo ""

# ── Step 1: Remove Dangling Docker Images ─────────────────────────────────────
log_info "Removing dangling Docker images..."
DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null || true)
if [ -n "$DANGLING" ]; then
    echo "$DANGLING" | xargs docker rmi -f 2>/dev/null || true
    log_ok "Dangling images removed"
else
    log_info "No dangling images found"
fi

# ── Step 2: Remove Unused Docker Networks ─────────────────────────────────────
log_info "Pruning unused Docker networks..."
docker network prune -f 2>/dev/null || true
log_ok "Network cleanup complete"

# ── Step 3: Remove Unused Docker Volumes ──────────────────────────────────────
log_info "Pruning unused Docker volumes (excluding named volumes)..."
# Only prune anonymous volumes — named volumes are preserved
docker volume prune -f 2>/dev/null || true
log_ok "Volume cleanup complete"

# ── Step 4: Remove Temporary Files ────────────────────────────────────────────
log_info "Removing temporary files..."
rm -rf /tmp/civicpulse-* 2>/dev/null || true
rm -rf /tmp/npm-* 2>/dev/null || true
log_ok "Temporary files cleaned"

# ── Step 5: Remove Old Build-Tagged Images ────────────────────────────────────
log_info "Checking for old build-tagged images..."
# Keep only the 5 most recent build-tagged images per service
SERVICES=("mongodb" "backend" "frontend" "nginx")
for svc in "${SERVICES[@]}"; do
    OLD_IMAGES=$(docker images "civicpulse/${svc}" --format "{{.Tag}} {{.ID}}" 2>/dev/null | \
                 grep "^build-" | sort -t'-' -k2 -rn | tail -n +6 | awk '{print $2}' || true)
    if [ -n "$OLD_IMAGES" ]; then
        echo "$OLD_IMAGES" | xargs docker rmi -f 2>/dev/null || true
        log_ok "Cleaned old build images for $svc"
    fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
log_info "Docker disk usage after cleanup:"
docker system df 2>/dev/null || log_warn "Could not query Docker disk usage"

echo ""
log_ok "═══════════════════════════════════════════════════"
log_ok "  Cleanup complete"
log_ok "═══════════════════════════════════════════════════"
