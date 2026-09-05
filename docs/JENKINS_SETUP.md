# Jenkins Setup Guide — CivicPulseAI

Complete guide to installing Jenkins, configuring the CI/CD pipeline, and integrating with GitHub for automated deployments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Jenkins Installation](#jenkins-installation)
3. [Required Jenkins Plugins](#required-jenkins-plugins)
4. [Creating the Pipeline Job](#creating-the-pipeline-job)
5. [Credentials Configuration](#credentials-configuration)
6. [Environment Variables](#environment-variables)
7. [GitHub Webhook Setup](#github-webhook-setup)
8. [First Pipeline Run](#first-pipeline-run)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure the following are installed on the Jenkins server:

| Tool              | Minimum Version | Check Command               |
|-------------------|-----------------|------------------------------|
| Docker            | 20.10+          | `docker --version`           |
| Docker Compose    | 2.0+ (v2 plugin)| `docker compose version`    |
| Git               | 2.30+           | `git --version`              |
| Node.js           | 22+             | `node --version`             |
| npm               | 10+             | `npm --version`              |
| Java (JDK)        | 17 or 21        | `java -version`              |

---

## Jenkins Installation

### Option A: Docker-based Installation (Recommended)

```bash
# Create a Docker network for Jenkins
docker network create jenkins

# Run Jenkins with Docker-in-Docker support
docker run -d \
  --name jenkins \
  --restart unless-stopped \
  --network jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(which docker):/usr/bin/docker \
  jenkins/jenkins:lts
```

Get the initial admin password:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### Option B: Native Installation (Ubuntu/Debian)

```bash
# Add Jenkins repository key
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

# Add Jenkins apt repository
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
sudo apt update
sudo apt install jenkins

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins
```

### Option C: Windows Installation

1. Download the Jenkins MSI installer from https://www.jenkins.io/download/
2. Run the installer and follow the setup wizard
3. Jenkins will be available at `http://localhost:8080`

---

## Required Jenkins Plugins

Navigate to **Manage Jenkins → Manage Plugins → Available** and install:

| Plugin                | Purpose                                    |
|-----------------------|--------------------------------------------|
| **Pipeline**          | Declarative/Scripted pipeline support      |
| **Git**               | Git SCM integration                        |
| **Docker Pipeline**   | Docker build/push within pipelines         |
| **AnsiColor**         | Colored console output                     |
| **Timestamper**       | Timestamp each log line                    |
| **Workspace Cleanup** | Clean workspace before/after builds        |
| **GitHub Integration**| GitHub webhook receiver                    |
| **Pipeline Stage View**| Visual pipeline stage view                |
| **Build Timeout**     | Build timeout support                      |
| **SonarQube Scanner** | SonarQube quality analysis integration     |

Install via Jenkins CLI:
```bash
jenkins-cli install-plugin pipeline-stage-view git docker-workflow \
  ansicolor timestamper ws-cleanup github pipeline-build-step sonar
```

---

## Creating the Pipeline Job

1. Go to **Jenkins Dashboard → New Item**
2. Enter name: `CivicPulseAI-Pipeline`
3. Select **Pipeline** → Click **OK**
4. Configure:

### General
- ☑ **Do not allow concurrent builds**
- ☑ **GitHub project** → URL: `https://github.com/YOUR_USERNAME/intelligent-self-healing-cicd/`

### Build Triggers
- ☑ **GitHub hook trigger for GITScm polling**
- ☑ **Poll SCM** (optional fallback) → Schedule: `H/5 * * * *`

### Pipeline
- **Definition**: Pipeline script from SCM
- **SCM**: Git
- **Repository URL**: `https://github.com/YOUR_USERNAME/intelligent-self-healing-cicd.git`
- **Credentials**: (select your GitHub credentials)
- **Branch Specifier**: `*/main` *(CRITICAL: Must specify `*/main` strictly to prevent Poll SCM build loops from GitOps commits on `gitops` branch)*
- **Script Path**: `Jenkinsfile`

5. Click **Save**

---

## Credentials Configuration

### GitHub Credentials
1. Go to **Manage Jenkins → Credentials → System → Global credentials**
2. Click **Add Credentials**
3. **Kind**: Username with password
   - **Username**: Your GitHub username
   - **Password**: Your GitHub Personal Access Token (PAT)
   - **ID**: `github-credentials`
   - **Description**: GitHub access for CivicPulseAI

---

## Environment Variables

Configure global environment variables at **Manage Jenkins → Configure System → Global properties → Environment variables**:

| Variable              | Value                        | Required |
|-----------------------|------------------------------|----------|
| `DOCKER_HOST`         | `unix:///var/run/docker.sock`| Yes      |
| `PROJECT_NAME`        | `CivicPulseAI`              | Optional |

Pipeline-specific variables are defined in the `Jenkinsfile` `environment` block and `jenkins/config/pipeline.env`.

---

## Poll SCM Trigger Setup

See [POLL_SCM_SETUP.md](./POLL_SCM_SETUP.md) for detailed instructions.

### Quick Setup
1. Go to your Jenkins Job → **Configure → Build Triggers**
2. Check ☑ **Poll SCM**
3. **Schedule**: `H/5 * * * *` (polls every 5 minutes)
4. Click **Save**

---

## First Pipeline Run

1. Navigate to **CivicPulseAI-Pipeline** job
2. Click **Build with Parameters**
3. Configure parameters:
   - **BRANCH_NAME**: `main`
   - **DEPLOY_ENV**: `development`
   - **SKIP_TESTS**: unchecked (`false`)
   - **DOCKER_PRUNE**: checked (`true`)
   - **FORCE_REBUILD**: checked (`true`)
4. Click **Build**
5. Monitor progress in **Console Output** or **Pipeline Stage View**

### Expected Pipeline Flow (15 Stages)

```
Stage 1: Checkout Source Code
  → Stage 2: Environment Validation
  → Stage 3: Install Dependencies
  → Stage 4: Static Code Validation
  → Stage 5: Build Application
  → Stage 6: Unit Tests & Code Coverage
  → Stage 7: SonarQube Analysis & Quality Gate
  → Stage 8: Trivy Filesystem Scan
  → Stage 9: Docker Build
  → Stage 10: Trivy Image Scan & GHCR Push
  → Stage 11: Apply Argo CD Parameter Override (Zero-Commit)
  → Stage 12: Verify Self-Healing Controller & Remediations
  → Stage 13: Application Health Verification
  → Stage 14: Monitoring Stack Verification
  → Stage 15: Publish Deployment & Security Reports
```

Average build duration: **5–10 minutes**.


---

## Persistent SonarQube Service Setup (Docker Compose)

SonarQube runs as a persistent container service managed via Docker Compose (`docker-compose.yml`). The SonarQube image is pulled once, and all project data, plugins, and scan metrics are preserved permanently in named Docker volumes.

### Management Commands:

1. **First-Time Service Initialization**:
   ```bash
   docker compose up -d sonarqube
   ```
2. **Check Running Status**:
   ```bash
   docker ps | grep sonarqube
   ```
3. **Stop SonarQube Service**:
   ```bash
   docker stop sonarqube
   ```
4. **Start SonarQube Service**:
   ```bash
   docker start sonarqube
   ```
5. **Access Web UI**:
   Navigate to [http://localhost:9000](http://localhost:9000)

### Volume Persistence & Data Retention:
The setup defines named Docker volumes so data is preserved across container restarts, pipeline deployments, or host reboots:
- `sonarqube_data`: Stores database metrics, user profiles, and analyzed project histories.
- `sonarqube_extensions`: Stores installed SonarQube plugins and third-party rules.
- `sonarqube_logs`: Stores application log files.

---

## Permanent Linux CI Agent Provisioning — Docker Credential Store Fix

### Problem Addressed
When Linux CI agents inherit a Docker configuration copied or mounted from a Windows environment containing `"credsStore": "desktop.exe"`, BuildKit and Docker CLI fail with:
```
error getting credentials - err: exec: "docker-credential-desktop.exe": executable file not found in $PATH
```

### 1. Agent Provisioning (AMI / Cloud-Init / User-Data / Ansible / Terraform)

To ensure new Linux CI agents never inherit Windows credential helpers, execute `./jenkins/scripts/provision-agent-docker.sh` or include the following configuration during node provisioning:

#### Shell Provisioning Script
```bash
# Execute repository agent provisioning script
sudo bash jenkins/scripts/provision-agent-docker.sh
```

#### Manual / Cloud-Init User-Data (EC2 / Terraform)
```yaml
#cloud-config
write_files:
  - path: /etc/skel/.docker/config.json
    permissions: '0600'
    owner: root:root
    content: |
      {
        "auths": {},
        "credsStore": ""
      }
  - path: /home/jenkins/.docker/config.json
    permissions: '0600'
    owner: jenkins:jenkins
    content: |
      {
        "auths": {},
        "credsStore": ""
      }
runcmd:
  - chmod 700 /home/jenkins/.docker
  - chown -R jenkins:jenkins /home/jenkins/.docker
```

#### Ansible Playbook Task
```yaml
- name: Configure clean Docker credentials store for Jenkins CI user
  ansible.builtin.copy:
    dest: "/home/jenkins/.docker/config.json"
    owner: jenkins
    group: jenkins
    mode: '0600'
    content: |
      {
        "auths": {},
        "credsStore": ""
      }
```

### 2. Pre-Build Sanitization Script (`jenkins/scripts/fix-docker-config.sh`)

The pipeline automatically invokes `jenkins/scripts/fix-docker-config.sh` before Docker builds. It sanitizes `~/.docker/config.json` and `$DOCKER_CONFIG/config.json` by purging any `desktop.exe` entry:

```bash
# Run manually on any Linux build node if needed:
./jenkins/scripts/fix-docker-config.sh
```

### 3. Linux-Compatible Authentication for Private Registries (GHCR)

Always use standard token-based authentication via `docker login` with `--password-stdin`. This writes directly to the `"auths"` object inside `config.json` without requiring external credential helpers:

```bash
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
```

---

## Troubleshooting

### Common Issues

#### 1. Docker Credential Desktop Helper Error
```
error getting credentials - err: exec: "docker-credential-desktop.exe": executable file not found in $PATH
```
**Solution:**
Run the pre-build sanitizer script to purge `desktop.exe` from `~/.docker/config.json`:
```bash
./jenkins/scripts/fix-docker-config.sh
```
Or overwrite `~/.docker/config.json` directly:
```bash
mkdir -p ~/.docker
cat <<'EOF' > ~/.docker/config.json
{
  "auths": {},
  "credsStore": ""
}
EOF
chmod 600 ~/.docker/config.json
```

#### 2. Docker Permission Denied
```
Got permission denied while trying to connect to the Docker daemon socket
```
**Solution:**
```bash
# Add Jenkins user to the docker group
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

#### 3. Node.js Not Found
```
node: command not found
```
**Solution:** Install Node.js globally on the Jenkins server, or use the **NodeJS Plugin** to manage Node.js installations within Jenkins:
```bash
# Install Node.js via nvm on the Jenkins server
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
nvm use 22
```

#### 4. Docker Compose Not Found
```
docker compose: command not found
```
**Solution:**
```bash
# Docker Compose V2 (plugin)
sudo apt install docker-compose-plugin

# Or standalone
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 5. Port Already in Use
```
Bind for 0.0.0.0:80: address already in use
```
**Solution:**
```bash
# Find and kill the process using the port
sudo lsof -i :80
sudo kill -9 <PID>
# Or stop existing containers
docker compose down
```

#### 6. Health Check Timeout
```
Health checks FAILED after 10 attempts
```
**Solution:**
- Increase `STARTUP_WAIT` in the Jenkinsfile (default 30s may be insufficient for cold starts)
- Check MongoDB connection — backend waits for MongoDB to be healthy
- Review container logs: `docker logs civicpulse-backend`
- Ensure `.env` files exist and are correct

#### 7. Build Out of Memory
```
JavaScript heap out of memory
```
**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### 8. Git Checkout Fails
```
Permission denied (publickey)
```
**Solution:** Use HTTPS credentials instead of SSH, or configure SSH keys:
```bash
# Generate SSH key for Jenkins
ssh-keygen -t ed25519 -C "jenkins@server"
# Add public key to GitHub → Settings → SSH keys
```

---

## Jenkins Security Best Practices

1. **Enable CSRF protection** (Manage Jenkins → Security)
2. **Use credentials store** — never hardcode secrets in Jenkinsfile
3. **Restrict pipeline permissions** — use Matrix Authorization
4. **Enable audit logging** — track who runs builds
5. **Use HTTPS** — place Jenkins behind a reverse proxy with SSL
6. **Regular updates** — keep Jenkins and plugins updated

