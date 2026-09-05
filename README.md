# Intelligent Self-Healing CI/CD Platform with Predictive Monitoring for Web Applications

An enterprise-grade, automated CI/CD and DevOps orchestration framework. This platform is designed to provide robust, deterministic, and self-healing deployments alongside layered predictive monitoring for multi-container web applications.

As a reference workload, the platform deploys and monitors **CivicPulse AI**—a full-stack web application containing an Angular 22 frontend, Node.js/Express API gateway, MongoDB database, Nginx reverse proxy, and persistent SonarQube quality analysis engine.


---

## 📁 System Architecture & Core Layout

The repository is structured into two main scopes: the **CI/CD Orchestration Layer** (Jenkins automation and deployment lifecycle management) and the **Target Web Application Layer** (distributed services ready for containerized deployment) .

```
intelligent-self-healing-cicd/
├── jenkins/                      # CI/CD config, scripts, and templates
│   ├── config/
│   │   └── pipeline.env          # Centralized pipeline environment variables
│   ├── reports/                  # Generated deployment and Trivy vulnerability reports
│   └── scripts/                  # Lifecycle scripts (cleanup, deploy, health-check, gitops, self-healing)
├── ml-decision-controller/       # Intelligent ML Self-Healing Microservice (FastAPI + Kubernetes Client)
│   ├── app/                      # Webhook listener, decision engine, and Kubernetes remediations
│   ├── tests/                    # Microservice unit test suite
│   └── Dockerfile                # Production FastAPI container setup
├── argocd/                       # GitOps Continuous Deployment manifests
│   └── civicpulse-application.yaml # Argo CD Application specification
├── helm/                         # Production Kubernetes Helm chart
│   └── civicpulse/               # CivicPulse AI Helm chart template and values
├── docs/                         # Comprehensive DevOps and API manuals
│   ├── API_DOCUMENTATION.md      # Backend & ML Decision Controller REST API reference
│   ├── ARCHITECTURE.md           # System design & database schemas manual
│   ├── GITOPS_ARGOCD_GUIDE.md    # Argo CD GitOps architecture and workflow guide
│   ├── JENKINS_SETUP.md          # Jenkins installation & plugins guide
│   ├── PIPELINE_ARCHITECTURE.md  # Stage-by-stage pipeline execution guide
│   ├── POLL_SCM_SETUP.md         # Automated SCM polling trigger guide
│   └── self-healing.md           # Self-healing remediation viva demonstration guide
├── backend/                      # Node.js/Express TypeScript backend
│   ├── src/                      # API modules (Auth, Citizen, Complaints, Admin, AI-Chat, Officer, Field-Worker, Notifications)
│   └── Dockerfile.backend        # Multi-stage Node 22 production container
├── frontend/                     # Angular 22 standalone web application
│   ├── src/                      # Component views, services, and state
│   └── Dockerfile.frontend       # Multi-stage production Nginx wrapper
├── database/                     # MongoDB database container configuration
│   └── Dockerfile.mongodb        # Custom MongoDB 8.0 setup
├── nginx/                        # Routing & Static Assets Reverse Proxy
│   └── Dockerfile.nginx          # Custom Nginx routing and cache config
├── Jenkinsfile                   # Declarative pipeline script definition (15 stages)
└── docker-compose.yml            # Multi-service local runtime orchestrator
```

### Key Orchestration Files:
*   [Jenkinsfile](file:///d:/Project/intelligent-self-healing-cicd/Jenkinsfile): The core declarative CI/CD pipeline specifying 13 sequential execution stages.
*   [docker-compose.yml](file:///d:/Project/intelligent-self-healing-cicd/docker-compose.yml): Coordinates microservice boundaries, ports mapping, environment bindings, and healthy dependency structures (`mongodb`, `backend`, `frontend`, `nginx`, `sonarqube`).
*   [deploy.sh](file:///d:/Project/intelligent-self-healing-cicd/jenkins/scripts/deploy.sh): Automatically handles container teardowns, network prunes, volume conflict resolutions, and recreations.
*   [health-check.sh](file:///d:/Project/intelligent-self-healing-cicd/jenkins/scripts/health-check.sh): Performs robust layered verification.
*   [pipeline.env](file:///d:/Project/intelligent-self-healing-cicd/jenkins/config/pipeline.env): Global configuration values for ports, URLs, retry counts, and intervals.

---

## ⚡ Key Capabilities & Features

### 🔄 1. Multi-Stage CI/CD Pipeline
Automated end-to-end delivery split into 15 distinct execution stages:
1.  **Checkout Source Code**: Clones source repo and captures git metadata (`GIT_COMMIT_SHORT`, `GIT_AUTHOR`).
2.  **Environment Validation**: Checks pre-requisites (Docker, Docker Compose, Git, Node, npm) and auto-generates default `.env` files.
3.  **Install Dependencies**: Installs node modules in parallel (`npm ci`) for backend and frontend.
4.  **Static Code Validation**: Evaluates code quality (ESLint for backend, Prettier format check for frontend).
5.  **Build Application**: Compiles Angular client and TypeScript backend in parallel.
6.  **Unit Tests & Code Coverage**: Runs backend (Jest + CI MongoDB) and frontend (Vitest) test suites, producing `lcov.info` coverage reports.
7.  **SonarQube Analysis & Quality Gate**: Runs system SonarScanner with dynamic source detection and waits for Quality Gate evaluation.
8.  **Trivy Filesystem Scan**: Scans repository source files for HIGH/CRITICAL vulnerabilities before Docker build.
9.  **Docker Build**: Generates production-ready container images tagged with `${BUILD_NUMBER}`.
10. **Trivy Image Scan & GHCR Push**: Scans container images and pushes published tags (`ghcr.io/tharunadhithyaa/civicpulse-*:BUILD_NUMBER`) to GitHub Container Registry.
11. **Apply Argo CD Parameter Override**: Zero-commit stage executing `update-gitops.sh --build-number ${BUILD_NUMBER}` immediately after GHCR image push to patch Argo CD application parameters (`backend.image.tag`, `frontend.image.tag`) directly in K3s.
12. **Verify Self-Healing Controller & Remediations**: Audits real-time K3s cluster health, ML decision controller readiness, and remediation triggers.
13. **Health Verification**: Layered HTTP endpoint polling and container probe verifications (`health-check.sh`).
14. **Monitoring Stack Verification**: Audits Prometheus, Grafana, and Alertmanager endpoint readiness (`verify-monitoring.sh`).
15. **Publish Deployment & Security Reports**: Publishes consolidated build, security, and deployment audit reports (`generate-report.sh`).

> **Note on Zero-Commit GitOps Architecture & Poll SCM**:
> - **`main` Branch**: Pushed by developers and monitored by Jenkins Poll SCM (`*/main`).
> - **Zero-Commit Deployment**: Argo CD parameter overrides are applied live directly to the Argo CD Application resource in K3s without making Git commits, eliminating commit churn and build loops.
> - Restricting Poll SCM strictly to `*/main` isolates CI triggers and guarantees deterministic pipeline runs.

### 🛡️ 2. Intelligent Self-Healing Deployments
The deployment engine executes automated self-recovery procedures to eliminate downtime:
*   **Deployment Retry Policy**: The [Jenkinsfile](file:///d:/Project/intelligent-self-healing-cicd/Jenkinsfile) automatically catches startup/deployment failures, waits for system cooling, and triggers an automated retry of [deploy.sh](file:///d:/Project/intelligent-self-healing-cicd/jenkins/scripts/deploy.sh).
*   **Volume & Storage Incompatibility Self-Healing**: `deploy.sh` automatically detects stale MongoDB storage volume incompatibilities (e.g. exit code 62) and performs automatic volume recovery and re-deployment.
*   **Dependency-Chained Healthchecks**: Docker Compose enforces start ordering (`depends_on` conditions). The backend server waits for MongoDB to be `healthy` before booting, and Nginx/Frontend wait for backend health check approval.
*   **Container Restart Policies**: Set to `unless-stopped` to auto-recover components from internal crashes or memory faults.

### 📊 3. Predictive Health Monitoring
Our [health-check.sh](file:///d:/Project/intelligent-self-healing-cicd/jenkins/scripts/health-check.sh) script goes beyond basic port checkups:
1.  **HTTP Layer Verification**: Resolves and queries specific application endpoints (`GET /api/health`, `GET /health` and `GET /`) expecting HTTP `200 OK`.
2.  **Container Status Inspection**: Uses `docker inspect` to verify container status is `running` and health status is `healthy`.
3.  **Port Response Profiling**: Directly verifies Nginx (port `80`) and Express API (port `8000`) bindings.
4.  **Database Connection Auditing**: Checks deep backend-to-database bridge connectivity through downstream health metrics.
5.  **Diagnostic Auto-Dumping**: If checks fail after maximum retries (configurable in [pipeline.env](file:///d:/Project/intelligent-self-healing-cicd/jenkins/config/pipeline.env)), the script dumps service statuses, process details, and last 20 lines of container logs for rapid mitigation.

### 🧹 4. Automated Resource Optimization
Continuous resource conservation routines integrated inside [cleanup.sh](file:///d:/Project/intelligent-self-healing-cicd/jenkins/scripts/cleanup.sh) and pipeline `post-always` tasks:
*   Removes dangling and untagged Docker images.
*   Discards exited and orphan container leftovers.
*   Prunes unreferenced bridge networks and anonymous volumes.
*   Enforces build artifact retention (`logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5')`) to prevent build-node disk exhaustion.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
*   **Docker** (version 20.10.x or higher)
*   **Docker Compose** (version 2.x or higher)
*   **Node.js** (version 22.x or higher) & **npm** (version 10.x or higher)

### 1. Configure the Environment
Generate the required local `.env` configs from default templates by executing:
```bash
chmod +x jenkins/scripts/generate-env.sh
./jenkins/scripts/generate-env.sh
```

### 2. Stand Up the Multi-Container Stack
Build the service images locally and start the orchestration network:
```bash
docker compose up -d --build
```

Access local service endpoints:
*   **Web Client (Frontend)**: [http://localhost](http://localhost) or [http://localhost:4200](http://localhost:4200)
*   **Express API Server (Backend)**: [http://localhost:8000](http://localhost:8000)
*   **Nginx Proxy Health**: [http://localhost/health](http://localhost/health)
*   **API Health Gateway**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
*   **SonarQube Dashboard**: [http://localhost:9000](http://localhost:9000)

### 3. Run Static Code Audits & Integration Tests
Navigate to the backend module to trigger tests:
```bash
cd backend
npm install
npm test
```

### 4. Helm-Based Kubernetes Deployment (K3s)

CivicPulse AI includes a production-grade Helm chart located in `helm/civicpulse`.

#### Prerequisites
* **Kubernetes Cluster** (K3s, MicroK8s, Minikube, or EKS/GKE/AKS)
* **Helm v3** (`helm version`)
* **kubectl** (`kubectl version --client`)

#### GHCR Image Pull Secret (Optional for Private Registries)
```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<YOUR_GITHUB_USERNAME> \
  --docker-password=<YOUR_GITHUB_PAT> \
  --namespace=civicpulse
```

#### Install / Deploy
```bash
helm upgrade --install civicpulse ./helm/civicpulse \
  --namespace civicpulse \
  --create-namespace
```

#### Check Deployment
```bash
kubectl get pods -n civicpulse
kubectl get services -n civicpulse
kubectl get deployments -n civicpulse
kubectl get pvc -n civicpulse
helm list -n civicpulse
```

#### Upgrade
```bash
helm upgrade civicpulse ./helm/civicpulse \
  --namespace civicpulse \
  --set backend.image.tag=$BUILD_NUMBER \
  --set frontend.image.tag=$BUILD_NUMBER \
  --set nginx.image.tag=$BUILD_NUMBER
```

#### Rollback
```bash
# View release history and revisions
helm history civicpulse -n civicpulse

# Rollback to a specific revision (e.g. revision 1)
helm rollback civicpulse 1 -n civicpulse
```

#### Uninstall
```bash
helm uninstall civicpulse -n civicpulse
```

---

## 📚 Technical Setup & References Guides

Detailed architecture manuals and instructions are available in the [docs/](file:///d:/Project/intelligent-self-healing-cicd/docs) directory:
*   **CI/CD Setup Manual**: [docs/JENKINS_SETUP.md](file:///d:/Project/intelligent-self-healing-cicd/docs/JENKINS_SETUP.md) — Step-by-step setup for Jenkins, plugins, and execution permissions.
*   **Pipeline Architecture**: [docs/PIPELINE_ARCHITECTURE.md](file:///d:/Project/intelligent-self-healing-cicd/docs/PIPELINE_ARCHITECTURE.md) — Stage-by-stage parameters, environment flags, and build flow design.
*   **Poll SCM Trigger**: [docs/POLL_SCM_SETUP.md](file:///d:/Project/intelligent-self-healing-cicd/docs/POLL_SCM_SETUP.md) — Configuring Poll SCM schedule for automated build triggers.
*   **System Design**: [docs/ARCHITECTURE.md](file:///d:/Project/intelligent-self-healing-cicd/docs/ARCHITECTURE.md) — Detailed overview of database schemas, role permissions, and API structure.
*   **API Directory**: [docs/API_DOCUMENTATION.md](file:///d:/Project/intelligent-self-healing-cicd/docs/API_DOCUMENTATION.md) — REST API endpoints payload structures, roles requirements, and authentication.



