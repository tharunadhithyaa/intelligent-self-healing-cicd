# Pipeline Architecture — CivicPulseAI

Technical documentation for the Jenkins CI/CD pipeline architecture, execution flow, and configuration reference.

---

## Pipeline Execution Flow

```mermaid
flowchart TD
    A["🔄 GitHub Push / Manual Trigger"] --> B["Stage 1: Checkout Source Code"]
    B --> C["Stage 2: Environment Validation"]
    C --> D["Stage 3: Install Dependencies"]
    D --> D1["Backend: npm ci"]
    D --> D2["Frontend: npm ci"]
    D1 --> E["Stage 4: Static Code Validation"]
    D2 --> E
    E --> E1["Backend: ESLint + npm audit"]
    E --> E2["Frontend: Prettier + npm audit"]
    E1 --> F["Stage 5: Build Application"]
    E2 --> F
    F --> F1["Backend: tsc → dist/"]
    F --> F2["Frontend: ng build --prod"]
    F1 --> G1["Stage 6: SonarQube Analysis"]
    F2 --> G1
    G1 --> G2["Stage 7: SonarQube Quality Gate"]
    G2 -->|OK| T1["Stage 8: Trivy Filesystem Scan"]
    G2 -->|FAILED| M["❌ Pipeline Aborted"]
    T1 -->|OK| H["Stage 9: Docker Build"]
    T1 -->|FAILED| M
    H --> T2["Stage 10: Trivy Image Scan"]
    T2 -->|OK| I["Stage 11: Deployment"]
    T2 -->|FAILED| M
    I --> J["Stage 12: Health Verification"]
    J --> K["Stage 13: Deployment Report"]
    K --> L{"Pipeline Result"}
    L -->|Success| M1["✅ Post: Success Actions"]
    L -->|Failure| M
    M1 --> N["🧹 Post: Always - Cleanup"]
    M --> N

    style A fill:#4A90D9,color:#fff
    style K fill:#FF9800,color:#fff
    style L fill:#4CAF50,color:#fff
    style M fill:#F44336,color:#fff
    style N fill:#9E9E9E,color:#fff
```

---

## Stage Details

### Stage 1 — Checkout Source Code
| Aspect     | Detail                                        |
|------------|-----------------------------------------------|
| **Tool**   | Git (via Jenkins SCM)                         |
| **Action** | Clean workspace → Clone repository            |
| **Output** | `GIT_COMMIT_SHORT`, `GIT_AUTHOR`, `GIT_BRANCH_NAME` |
| **Failure**| Abort pipeline immediately                    |

### Stage 2 — Environment Validation
| Check              | Required | Failure Behavior        |
|--------------------|----------|-------------------------|
| Docker             | ✅        | Abort pipeline          |
| Docker Compose     | ✅        | Abort pipeline          |
| Git                | ✅        | Abort pipeline          |
| Node.js + npm      | ✅        | Abort pipeline          |
| Project directories| ✅        | Abort pipeline          |
| `.env` files       | ⚠️        | Warning only            |
| Dockerfiles        | ✅        | Abort pipeline          |

### Stage 3 — Install Dependencies
| Component  | Command          | Notes                          |
|------------|------------------|--------------------------------|
| Backend    | `npm ci`         | Deterministic, lockfile-based  |
| Frontend   | `npm ci`         | Runs in parallel with backend  |

### Stage 4 — Static Code Validation
| Check          | Tool          | Fail Build? |
|----------------|---------------|-------------|
| npm audit      | npm           | ❌ Advisory  |
| Backend lint   | ESLint        | ⚠️ Warning   |
| Frontend format| Prettier      | ⚠️ Warning   |

> Skippable via `SKIP_TESTS` parameter.

### Stage 5 — Build Application
| Component  | Command                              | Output             |
|------------|--------------------------------------|--------------------|
| Backend    | `npm run build` (tsc)                | `backend/dist/`    |
| Frontend   | `ng build --configuration production`| `frontend/dist/`   |

Build artifacts are archived in Jenkins for historical access.

### Stage 6 — SonarQube Analysis
| Parameter / Tool       | Configuration / Detail                                   |
|------------------------|----------------------------------------------------------|
| Scanner Execution      | `withSonarQubeEnv('SonarQube')`                          |
| Auto-Detection         | Dynamic `src` folder discovery (`backend/src`, `frontend/src`) |
| Platform Compatibility | Linux Docker (`sh`), Windows (`bat`)                     |
| Exclusions             | `node_modules`, `dist`, `coverage`, `logs`, Docker files |

### Stage 7 — SonarQube Quality Gate
| Parameter / Step       | Detail                                                   |
|------------------------|----------------------------------------------------------|
| Step Function          | `waitForQualityGate()`                                   |
| Timeout                | `45 MINUTES`                                             |
| Failure Handling       | Throws error & aborts pipeline if status != `OK`          |
| Pass Requirement       | Continues to Stage 8 only on `OK` status                 |

### Stage 8 — Trivy Filesystem Scan
| Action                 | Detail                                                   |
|------------------------|----------------------------------------------------------|
| Target                 | Repository filesystem (`.`)                              |
| Severity Levels        | `HIGH,CRITICAL` (`--ignore-unfixed`)                     |
| Reports Generated      | HTML, JSON, SARIF (`jenkins/reports/trivy/trivy-fs-*`)   |
| Quality Gate           | `--exit-code 1` (Aborts pipeline before Docker build)   |

### Stage 9 — Docker Build
| Action                 | Command / Detail                              |
|------------------------|-----------------------------------------------|
| Prune dangling images  | `docker image prune -f`                       |
| Build images           | `docker compose build [--no-cache] --pull`    |
| Image static tags      | `civicpulse/backend:v1`, `frontend:v1`, etc.  |

### Stage 10 — Trivy Image Scan
| Action                 | Detail                                                   |
|------------------------|----------------------------------------------------------|
| Targets Scanned        | `civicpulse/backend:v1`, `civicpulse/frontend:v1`, `civicpulse/nginx:v1`, `civicpulse/mongodb:v1` |
| Severity Levels        | `HIGH,CRITICAL` (`--ignore-unfixed`)                     |
| Reports Generated      | HTML, JSON, SARIF (`jenkins/reports/trivy/trivy-*-*`)   |
| Quality Gate           | `--exit-code 1` (Aborts deployment if images contain HIGH/CRITICAL) |
| Artifact Archiving     | Archived via `archiveArtifacts`                          |

### Stage 11 — Deployment
| Step | Action                                    |
|------|-------------------------------------------|
| 1    | `docker compose down --remove-orphans`    |
| 2    | Remove exited containers                  |
| 3    | Prune unused networks                     |
| 4    | `docker compose up -d --build --force-recreate` |
| 5    | Verify all 4 containers are running       |

> Includes automatic retry on first failure.

### Stage 12 — Health Verification
| Check                  | Endpoint / Method              | Retries |
|------------------------|--------------------------------|---------|
| Backend API            | `GET /api/health` → HTTP 200   | 10      |
| Nginx                  | `GET /health` → HTTP 200       | 10      |
| Frontend               | `GET /` → HTTP 200             | 10      |
| Container health       | `docker inspect` health status | 10      |
| Port 80                | HTTP connection test           | 10      |
| Port 8000              | HTTP connection test           | 10      |
| Database               | Backend health → `database.status` | 10  |

### Stage 13 — Deployment Report
Generates and archives a comprehensive deployment report including:
- Build metadata (number, commit, branch, timestamp)
- Docker image inventory (tags, sizes)
- Container status table
- Service URLs
- Network and volume information
- Disk usage summary

---

## Pipeline Parameters

| Parameter        | Type     | Default       | Description                        |
|------------------|----------|---------------|------------------------------------|
| `BRANCH_NAME`    | String   | `main`        | Git branch to build                |
| `DEPLOY_ENV`     | Choice   | `development` | Target environment                 |
| `SKIP_TESTS`     | Boolean  | `false`       | Skip static code validation        |
| `DOCKER_PRUNE`   | Boolean  | `true`        | Prune dangling Docker resources    |
| `FORCE_REBUILD`  | Boolean  | `true`        | Force `--no-cache` Docker build    |

---

## Environment Variables

### Pipeline-Level (Jenkinsfile)

| Variable              | Value                | Purpose                      |
|-----------------------|----------------------|------------------------------|
| `PROJECT_NAME`        | CivicPulseAI         | Project identifier           |
| `COMPOSE_PROJECT_NAME`| civicpulse           | Docker Compose project name  |
| `DOCKER_IMAGE_PREFIX` | civicpulse           | Image naming prefix          |
| `APP_URL`             | http://<K3S_NODE_IP>:30080/| Application URL (NodePort)  |
| `BACKEND_URL`         | http://localhost:8000| Backend API URL              |
| `HEALTH_ENDPOINT`     | /api/health          | Backend health path          |
| `HEALTH_RETRIES`      | 10                   | Max health check retries     |
| `HEALTH_INTERVAL`     | 15                   | Seconds between retries      |
| `STARTUP_WAIT`        | 30                   | Initial wait before checks   |

### External Configuration
See `jenkins/config/pipeline.env` for the full configuration reference.

---

## Error Handling Strategy

```mermaid
flowchart LR
    E1["Git Failure"] --> R1["Abort: clear error message"]
    E2["Env Validation Fail"] --> R2["Abort: list missing tools"]
    E3["npm ci Failure"] --> R3["Abort: show npm error log"]
    E4["Build Failure"] --> R4["Abort: show compiler errors"]
    E5["Docker Build Fail"] --> R5["Abort: show Docker build log"]
    E6["Deployment Fail"] --> R6["Retry once → dump logs"]
    E7["Health Check Fail"] --> R7["Retry 10x → dump all logs"]
    E8["Permission Error"] --> R8["Show fix command"]

    style E1 fill:#F44336,color:#fff
    style E2 fill:#F44336,color:#fff
    style E3 fill:#F44336,color:#fff
    style E4 fill:#F44336,color:#fff
    style E5 fill:#F44336,color:#fff
    style E6 fill:#FF9800,color:#fff
    style E7 fill:#FF9800,color:#fff
    style E8 fill:#F44336,color:#fff
```

Every failure produces:
1. **Descriptive error message** explaining what failed
2. **Context logs** (Docker logs, npm output, etc.)
3. **Post-failure cleanup** (always runs)

---

## File Structure

```
intelligent-self-healing-cicd/
├── Jenkinsfile                          # Main declarative pipeline definition (13 stages)
├── jenkins/
│   ├── scripts/
│   │   ├── deploy.sh                   # Deployment orchestration
│   │   ├── health-check.sh             # Health verification
│   │   ├── cleanup.sh                  # Post-build cleanup
│   │   ├── generate-env.sh             # Environment generator
│   │   └── generate-report.sh          # Report generator
│   ├── config/
│   │   └── pipeline.env                # Environment config
│   └── reports/                        # Generated reports (gitignored)
└── docs/
    ├── API_DOCUMENTATION.md            # REST API specification
    ├── ARCHITECTURE.md                 # System architecture manual
    ├── JENKINS_SETUP.md                # Jenkins setup guide
    ├── PIPELINE_ARCHITECTURE.md        # Pipeline architecture docs
    └── POLL_SCM_SETUP.md               # Poll SCM trigger guide
```

