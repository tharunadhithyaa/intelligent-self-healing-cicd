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
| Node.js           | 18+             | `node --version`             |
| npm               | 9+              | `npm --version`              |
| Java (JDK)        | 11 or 17        | `java -version`              |

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

Install via Jenkins CLI:
```bash
jenkins-cli install-plugin pipeline-stage-view git docker-workflow \
  ansicolor timestamper ws-cleanup github pipeline-build-step
```

---

## Creating the Pipeline Job

1. Go to **Jenkins Dashboard → New Item**
2. Enter name: `CivicPulseAI-Pipeline`
3. Select **Pipeline** → Click **OK**
4. Configure:

### General
- ☑ **Do not allow concurrent builds**
- ☑ **GitHub project** → URL: `https://github.com/YOUR_USERNAME/CivicPluseAI/`

### Build Triggers
- ☑ **GitHub hook trigger for GITScm polling**
- ☑ **Poll SCM** (optional fallback) → Schedule: `H/5 * * * *`

### Pipeline
- **Definition**: Pipeline script from SCM
- **SCM**: Git
- **Repository URL**: `https://github.com/YOUR_USERNAME/CivicPluseAI.git`
- **Credentials**: (select your GitHub credentials)
- **Branch Specifier**: `*/main`
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

### Docker Hub (Optional — for pushing images)
1. **Kind**: Username with password
   - **Username**: Docker Hub username
   - **Password**: Docker Hub access token
   - **ID**: `dockerhub-credentials`

---

## Environment Variables

Configure global environment variables at **Manage Jenkins → Configure System → Global properties → Environment variables**:

| Variable              | Value                        | Required |
|-----------------------|------------------------------|----------|
| `DOCKER_HOST`         | `unix:///var/run/docker.sock`| Yes      |
| `PROJECT_NAME`        | `CivicPulseAI`              | Optional |

Pipeline-specific variables are defined in the `Jenkinsfile` `environment` block and `jenkins/config/pipeline.env`.

---

## GitHub Webhook Setup

See [WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) for detailed instructions.

### Quick Setup
1. Go to your GitHub repository → **Settings → Webhooks → Add webhook**
2. **Payload URL**: `http://YOUR_JENKINS_URL:8080/github-webhook/`
3. **Content type**: `application/json`
4. **Events**: Select **Just the push event**
5. Click **Add webhook**

---

## First Pipeline Run

1. Navigate to **CivicPulseAI-Pipeline** job
2. Click **Build with Parameters**
3. Configure parameters:
   - **BRANCH_NAME**: `main`
   - **DEPLOY_ENV**: `development`
   - **SKIP_TESTS**: unchecked
   - **DOCKER_PRUNE**: checked
   - **FORCE_REBUILD**: checked (recommended for first run)
4. Click **Build**
5. Monitor progress in **Console Output** or **Pipeline Stage View**

### Expected Pipeline Flow

```
Checkout → Environment Validation → Install Dependencies → Static Code Validation
    → Build Application → Docker Build → Deployment → Health Verification
    → Deployment Report
```

Average first build duration: **10–15 minutes** (subsequent builds: 5–8 minutes with caching).

---

## Troubleshooting

### Common Issues

#### 1. Docker Permission Denied
```
Got permission denied while trying to connect to the Docker daemon socket
```
**Solution:**
```bash
# Add Jenkins user to the docker group
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

#### 2. Node.js Not Found
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

#### 3. Docker Compose Not Found
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

#### 4. Port Already in Use
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

#### 5. Health Check Timeout
```
Health checks FAILED after 10 attempts
```
**Solution:**
- Increase `STARTUP_WAIT` in the Jenkinsfile (default 30s may be insufficient for cold starts)
- Check MongoDB connection — backend waits for MongoDB to be healthy
- Review container logs: `docker logs civicpulse-backend`
- Ensure `.env` files exist and are correct

#### 6. Build Out of Memory
```
JavaScript heap out of memory
```
**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### 7. Git Checkout Fails
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
