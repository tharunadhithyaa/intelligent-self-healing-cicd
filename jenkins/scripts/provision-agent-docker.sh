#!/usr/bin/env bash
# ============================================================================
# CivicPulseAI — Permanent Linux CI Agent Provisioning Script (Docker Config)
# ============================================================================
# Configures Linux CI agents / Jenkins nodes permanently during provisioning
# (cloud-init, EC2 user-data, AMI builder, Ansible, or Packer) to ensure
# ~/.docker/config.json NEVER contains Windows Docker Desktop credential helpers
# ("credsStore": "desktop.exe").
# ============================================================================
set -euo pipefail

echo "=========================================================="
echo " CivicPulseAI — Linux CI Agent Docker Provisioning"
echo "=========================================================="

CLEAN_DOCKER_CONFIG='{
  "auths": {},
  "credsStore": ""
}'

# 1. Configure system skeleton directory (/etc/skel) so all future user accounts inherit clean config
echo "📁 Provisioning /etc/skel/.docker/config.json..."
mkdir -p /etc/skel/.docker
echo "${CLEAN_DOCKER_CONFIG}" > /etc/skel/.docker/config.json
chmod 700 /etc/skel/.docker
chmod 600 /etc/skel/.docker/config.json

# 2. Provision jenkins user if present
if id "jenkins" &>/dev/null; then
    JENKINS_HOME=$(eval echo "~jenkins")
    echo "📁 Provisioning ${JENKINS_HOME}/.docker/config.json..."
    mkdir -p "${JENKINS_HOME}/.docker"
    echo "${CLEAN_DOCKER_CONFIG}" > "${JENKINS_HOME}/.docker/config.json"
    chown -R jenkins:jenkins "${JENKINS_HOME}/.docker" 2>/dev/null || true
    chmod 700 "${JENKINS_HOME}/.docker"
    chmod 600 "${JENKINS_HOME}/.docker/config.json"
    echo "  ✅ Configured Docker config for user 'jenkins'"
fi

# 3. Provision root user
echo "📁 Provisioning /root/.docker/config.json..."
mkdir -p /root/.docker
echo "${CLEAN_DOCKER_CONFIG}" > /root/.docker/config.json
chmod 700 /root/.docker
chmod 600 /root/.docker/config.json
echo "  ✅ Configured Docker config for user 'root'"

# 4. Provision current user if different from root and jenkins
CURRENT_USER=$(whoami 2>/dev/null || echo "")
if [ -n "${CURRENT_USER}" ] && [ "${CURRENT_USER}" != "root" ] && [ "${CURRENT_USER}" != "jenkins" ]; then
    CURRENT_HOME="${HOME:-/home/${CURRENT_USER}}"
    echo "📁 Provisioning ${CURRENT_HOME}/.docker/config.json..."
    mkdir -p "${CURRENT_HOME}/.docker"
    echo "${CLEAN_DOCKER_CONFIG}" > "${CURRENT_HOME}/.docker/config.json"
    chmod 700 "${CURRENT_HOME}/.docker"
    chmod 600 "${CURRENT_HOME}/.docker/config.json"
    echo "  ✅ Configured Docker config for user '${CURRENT_USER}'"
fi

echo "=========================================================="
echo " ✅ Linux CI Agent Docker Provisioning Complete"
echo "=========================================================="
