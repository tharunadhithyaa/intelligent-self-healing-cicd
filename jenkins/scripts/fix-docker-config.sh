#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Docker Configuration Sanitizer Script
# ============================================================================
# Detects and purges invalid Windows Docker Desktop credential helpers
# ("credsStore": "desktop.exe" / "credHelpers": {"ghcr.io": "desktop.exe"})
# from Linux CI agent Docker configuration files (~/.docker/config.json).
#
# Root Cause Addressed:
# When Linux CI agents inherit a Docker config containing Windows Docker Desktop
# credential helpers, Docker BuildKit fails while pulling syntax images:
# "error getting credentials - err: exec: \"docker-credential-desktop.exe\": executable file not found in $PATH"
# ============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[DOCKER-CONFIG-FIX]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[DOCKER-CONFIG-FIX]${NC} ✅ $*"; }
log_warn()  { echo -e "${YELLOW}[DOCKER-CONFIG-FIX]${NC} ⚠️  $*"; }

sanitize_config_file() {
    local target_file="$1"
    local target_dir
    target_dir="$(dirname "${target_file}")"

    # Ensure parent directory exists with secure permissions
    mkdir -p "${target_dir}"
    chmod 700 "${target_dir}" 2>/dev/null || true

    # If file does not exist, initialize clean default config
    if [ ! -f "${target_file}" ]; then
        log_info "Creating clean Docker configuration file at ${target_file}..."
        cat <<'EOF' > "${target_file}"
{
  "auths": {},
  "credsStore": ""
}
EOF
        chmod 600 "${target_file}" 2>/dev/null || true
        log_ok "Created clean Docker config: ${target_file}"
        return 0
    fi

    # Check if Windows Desktop credential helper is present
    if grep -qiE 'desktop\.exe|docker-credential-desktop' "${target_file}"; then
        log_warn "Detected Windows Docker Desktop credential helper in: ${target_file}"

        # Option A: Sanitize using python3 if available
        if command -v python3 &>/dev/null; then
            python3 -c "
import json, sys
file_path = '${target_file}'
try:
    with open(file_path, 'r') as f:
        data = json.load(f)
    if 'credsStore' in data and ('desktop' in str(data['credsStore']).lower()):
        data['credsStore'] = ''
    if 'credHelpers' in data and isinstance(data['credHelpers'], dict):
        data['credHelpers'] = {k: v for k, v in data['credHelpers'].items() if 'desktop' not in str(v).lower() and 'desktop' not in str(k).lower()}
        if not data['credHelpers']:
            del data['credHelpers']
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)
except Exception as e:
    sys.exit(1)
" && {
                chmod 600 "${target_file}" 2>/dev/null || true
                log_ok "Sanitized ${target_file} (removed desktop.exe helper via Python)"
                return 0
            }
        fi

        # Option B: Sanitize using jq if available
        if command -v jq &>/dev/null; then
            local tmp_json
            tmp_json=$(mktemp)
            if jq 'if .credsStore and (.credsStore | test("desktop"; "i")) then .credsStore = "" else . end | if .credHelpers then .credHelpers |= with_entries(select(.value | test("desktop"; "i") | not)) else . end' "${target_file}" > "${tmp_json}"; then
                mv "${tmp_json}" "${target_file}"
                chmod 600 "${target_file}" 2>/dev/null || true
                log_ok "Sanitized ${target_file} (removed desktop.exe helper via jq)"
                return 0
            else
                rm -f "${tmp_json}"
            fi
        fi

        # Option C: Fallback clean overwrite
        log_warn "Replacing corrupted config ${target_file} with clean default configuration..."
        cat <<'EOF' > "${target_file}"
{
  "auths": {},
  "credsStore": ""
}
EOF
        chmod 600 "${target_file}" 2>/dev/null || true
        log_ok "Reset ${target_file} to clean default"
    else
        log_ok "Verified ${target_file} (clean — no Windows credential helper detected)"
    fi
}

# Determine target paths to check and sanitize
USER_HOME="${HOME:-/root}"
TARGET_PATHS=(
    "${USER_HOME}/.docker/config.json"
)

if [ -n "${DOCKER_CONFIG:-}" ]; then
    TARGET_PATHS+=("${DOCKER_CONFIG}/config.json")
fi

if [ -n "${WORKSPACE:-}" ]; then
    TARGET_PATHS+=("${WORKSPACE}/.docker/config.json")
fi

log_info "Checking Docker configuration files for invalid credential helpers..."
for config_path in "${TARGET_PATHS[@]}"; do
    sanitize_config_file "${config_path}"
done

log_ok "Docker configuration check complete. BuildKit credential helper errors prevented."
