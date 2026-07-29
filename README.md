# Intelligent Self-Healing CI/CD Platform with Predictive Monitoring for Web Applications

An enterprise-grade, automated CI/CD and DevOps orchestration framework. This platform is designed to provide robust, deterministic, and self-healing deployments alongside layered predictive monitoring for multi-container web applications.

As a reference workload, the platform deploys and monitors **CivicPulse AI**—a full-stack web application containing an Angular 17 frontend, Node.js/Express API gateway, MongoDB database, and Nginx reverse proxy.

---

## 📁 System Architecture & Core Layout

The repository is structured into two main scopes: the **CI/CD Orchestration Layer** (Jenkins automation and deployment lifecycle management) and the **Target Web Application Layer** (distributed services ready for containerized deployment).

```
CivicPulseAI/
├── jenkins/                      # CI/CD config and scripts
│   ├── config/
│   │   └── pipeline.env          # Centralized pipeline variables
│   └── scripts/
│       ├── cleanup.sh            # Post-build resource pruner
│       ├── deploy.sh             # Graceful deployment orchestrator
│       ├── generate-env.sh       # Secure environment config generator
│       ├── generate-report.sh    # Post-deployment markdown reporter
│       └── health-check.sh       # Multi-stage health verifier
├── docs/                         # Detailed DevOps manuals
│   ├── JENKINS_SETUP.md          # Jenkins installation & plugins guide
│   ├── PIPELINE_ARCHITECTURE.md  # Detailed pipeline execution stages
│   └── WEBHOOK_SETUP.md          # GitHub webhook webhook integration guide
├── backend/                      # Node.js/Express TypeScript backend
│   ├── src/                      # API modules, services, and models
│   └── Dockerfile.backend        # Multi-stage Node production container
├── frontend/                     # Angular 17 standalone web application
│   ├── src/                      # Component views, services, and state
│   └── Dockerfile.frontend       # Multi-stage production Nginx wrapper
├── database/                     # MongoDB database container configuration
│   └── Dockerfile.mongodb        # custom MongoDB 6.0 setup
├── nginx/                        # Routing & Static Assets Reverse Proxy
│   └── Dockerfile.nginx          # custom Nginx routing and cache config
├── Jenkinsfile                   # Declarative pipeline script definition
└── docker-compose.yml            # Multi-service runtime orchestrator
```

### Key Orchestration Files:
*   [Jenkinsfile](file:///d:/Project/CivicPluseAI/Jenkinsfile): The core declarative CI/CD pipeline specifying 9 sequential execution stages.
*   [docker-compose.yml](file:///d:/Project/CivicPluseAI/docker-compose.yml): Coordinates microservice boundaries, ports mapping, environment bindings, and healthy dependency structures.
*   [deploy.sh](file:///d:/Project/CivicPluseAI/jenkins/scripts/deploy.sh): Automatically handles container teardowns, network prunes, and recreations.
*   [health-check.sh](file:///d:/Project/CivicPluseAI/jenkins/scripts/health-check.sh): Performs robust layered verification.
*   [pipeline.env](file:///d:/Project/CivicPluseAI/jenkins/config/pipeline.env): Global configuration values for ports, URLs, retry counts, and intervals.

---

## ⚡ Key Capabilities & Features

### 🔄 1. Multi-Stage CI/CD Pipeline
Automated end-to-end delivery split into 9 distinct execution stages:
1.  **Checkout Source Code**: Clones source repo and captures git metadata (`GIT_COMMIT_SHORT`, `GIT_AUTHOR`).
2.  **Environment Validation**: Check pre-requisites (Docker, Node, Git) and auto-generates default `.env` files.
3.  **Install Dependencies**: Installs node modules in parallel (`npm ci`) for backend and frontend.
4.  **Static Code Validation**: Evaluates code quality (ESLint, Prettier formatting check, and security vulnerability audits).
5.  **Build Application**: Compiles Angular client and TypeScript backend in parallel.
6.  **Docker Build**: Generates production-ready, size-optimized container images.
7.  **Deployment**: Performs container restarts, cleans up exited instances, and runs network setups.
8.  **Health Verification**: Initiates layered service validations.
9.  **Deployment Report**: Compiles diagnostics statistics and publishes execution reports.

### 🛡️ 2. Intelligent Self-Healing Deployments
The deployment engine executes automated self-recovery procedures to eliminate downtime:
*   **Deployment Retry Policy**: The [Jenkinsfile](file:///d:/Project/CivicPluseAI/Jenkinsfile) automatically catches startup/deployment failures, waits for system cooling, and triggers an automated retry of [deploy.sh](file:///d:/Project/CivicPluseAI/jenkins/scripts/deploy.sh).
*   **Dependency-Chained Healthchecks**: Docker Compose enforces start ordering (`depends_on` conditions). The backend server waits for MongoDB to be `healthy` before booting, and Nginx/Frontend wait for backend health check approval.
*   **Container Restart Policies**: Set to `unless-stopped` to auto-recover components from internal crashes or memory faults.

### 📊 3. Predictive Health Monitoring
Our [health-check.sh](file:///d:/Project/CivicPluseAI/jenkins/scripts/health-check.sh) script goes beyond basic port checkups:
1.  **HTTP Layer Verification**: Resolves and queries specific application endpoints (e.g. `GET /api/health`, `GET /health` and `GET /`) expecting HTTP `200 OK`.
2.  **Container Status Inspection**: Uses `docker inspect` to verify container status is `running` and health status is `healthy`.
3.  **Port Response Profiling**: Directly verifies Nginx (port `80`) and Express API (port `8000`) bindings.
4.  **Database Connection Auditing**: Checks deep backend-to-database bridge connectivity through downstream health metrics.
5.  **Diagnostic Auto-Dumping**: If checks fail after maximum retries (configurable in [pipeline.env](file:///d:/Project/CivicPluseAI/jenkins/config/pipeline.env)), the script dumps service statuses, process details, and last 20 lines of container logs for rapid mitigation.

### 🧹 4. Automated Resource Optimization
Continuous resource conservation routines integrated inside [cleanup.sh](file:///d:/Project/CivicPluseAI/jenkins/scripts/cleanup.sh) and pipeline `post-always` tasks:
*   Removes dangling and untagged Docker images.
*   Discards exited and orphan container leftovers.
*   Prunes unreferenced bridge networks.
*   Enforces image history count limits (`BUILD_IMAGES_TO_KEEP=5`) to prevent build-node disk exhaustion.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
*   **Docker** (version 20.10.x or higher)
*   **Docker Compose** (version 2.x or higher)
*   **Node.js** (version 20.x or higher) & **npm**

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

### 3. Run Static Code Audits & Integration Tests
Navigate to the backend module to trigger tests:
```bash
cd backend
npm install
npm test
```

---

## 📚 Technical Setup & References Guides

Detailed architecture manuals and instructions are available in the [docs/](file:///d:/Project/CivicPluseAI/docs) directory:
*   **CI/CD Setup Manual**: [docs/JENKINS_SETUP.md](file:///d:/Project/CivicPluseAI/docs/JENKINS_SETUP.md) — Step-by-step setup for Jenkins, plugins, and execution permissions.
*   **Pipeline Architecture**: [docs/PIPELINE_ARCHITECTURE.md](file:///d:/Project/CivicPluseAI/docs/PIPELINE_ARCHITECTURE.md) — Stage-by-stage parameters, environment flags, and build flow design.
*   **Git Webhooks**: [docs/WEBHOOK_SETUP.md](file:///d:/Project/CivicPluseAI/docs/WEBHOOK_SETUP.md) — Linking Github pushes to automatically trigger pipeline execution.
*   **System Design**: [ARCHITECTURE.md](file:///d:/Project/CivicPluseAI/ARCHITECTURE.md) — Detailed overview of database schemas, role permissions, and API structure.
*   **API Directory**: [API_DOCUMENTATION.md](file:///d:/Project/CivicPluseAI/API_DOCUMENTATION.md) — REST API endpoints payload structures,roles requirements, and authentication.

