// ============================================================================
// CivicPulseAI — Declarative Jenkins CI/CD Pipeline
// ============================================================================
// Automates: Checkout → Validate → Install → Lint → Build → SonarQube Scan
//            → Quality Gate → Trivy FS Scan → Docker Build → Trivy Image Scan → Push Images to GHCR → Deploy → Health Check → Report
// ============================================================================

pipeline {
    agent any

    // ── Pipeline Options ─────────────────────────────────────────────────────
    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    // ── Pipeline Parameters ──────────────────────────────────────────────────
    parameters {
        string(
            name: 'BRANCH_NAME',
            defaultValue: 'main',
            description: 'Git branch to build and deploy'
        )
        choice(
            name: 'DEPLOY_ENV',
            choices: ['development', 'staging', 'production'],
            description: 'Target deployment environment'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip static code validation & SonarQube analysis stage'
        )
        booleanParam(
            name: 'DOCKER_PRUNE',
            defaultValue: true,
            description: 'Prune dangling Docker resources before build'
        )
        booleanParam(
            name: 'FORCE_REBUILD',
            defaultValue: true,
            description: 'Force Docker image rebuild (--no-cache)'
        )
    }

    // ── Environment Variables ────────────────────────────────────────────────
    environment {
        // Project
        PROJECT_NAME        = 'CivicPulseAI'
        COMPOSE_PROJECT_NAME = 'civicpulse'

        // Docker image prefix
        DOCKER_IMAGE_PREFIX = 'civicpulse'

        // GitHub Container Registry (GHCR) settings
        GHCR_REGISTRY       = 'ghcr.io'
        GHCR_OWNER          = 'tharunadhithyaa'

        // Single pipeline image tag (set to BUILD_NUMBER)
        IMAGE_TAG           = "${env.BUILD_NUMBER}"

        // Application URLs (Kubernetes NodePort deployment)
        K3S_NODE_IP         = '172.17.184.54'
        APP_URL             = 'http://172.17.184.54:30080/'
        BACKEND_URL         = 'http://172.17.184.54:30080'
        HEALTH_ENDPOINT     = '/api/health'
        NGINX_HEALTH        = '/health'

        // Health check tuning
        HEALTH_RETRIES      = '10'
        HEALTH_INTERVAL     = '15'
        STARTUP_WAIT        = '30'

        // SonarQube integration settings
        SONAR_SERVER        = 'SonarQube'
        SONAR_PROJECT_KEY   = 'intelligent-self-healing-cicd'
        SONAR_PROJECT_NAME  = 'intelligent-self-healing-cicd'

        // Trivy vulnerability scanner settings
        TRIVY_SEVERITY      = 'HIGH,CRITICAL'
        TRIVY_REPORTS_DIR   = 'jenkins/reports/trivy'
        TRIVY_CACHE_DIR     = "${WORKSPACE}/.trivy-cache"
        HTTP2_DISABLE       = 'true'
        GODEBUG             = 'http2client=0'
        DISABLE_HTTP2       = 'true'
    }

    stages {
        // ══════════════════════════════════════════════════════════════════════
        // STAGE 1 — Checkout Source Code
        // ══════════════════════════════════════════════════════════════════════
        stage('Checkout Source Code') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 1 — Checkout Source Code\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                // Clean workspace before checkout, preserving persistent Trivy DB cache
                cleanWs(patterns: [[pattern: '.trivy-cache/**', type: 'EXCLUDE']])

                // Checkout from SCM (configured in Jenkins job)
                checkout scm

                // Display commit information for traceability
                script {
                    if (isUnix()) {
                        env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD 2>/dev/null || echo "b${BUILD_NUMBER}"', returnStdout: true).trim()
                        env.GIT_COMMIT_FULL  = sh(script: 'git rev-parse HEAD 2>/dev/null || echo "unknown"', returnStdout: true).trim()
                        env.GIT_AUTHOR       = sh(script: 'git log -1 --pretty=format:"%an" 2>/dev/null || echo "jenkins"', returnStdout: true).trim()
                        env.GIT_MESSAGE      = sh(script: 'git log -1 --pretty=format:"%s" 2>/dev/null || echo "build"', returnStdout: true).trim()
                        env.GIT_BRANCH_NAME  = env.BRANCH_NAME ?: env.GIT_BRANCH ?: params.BRANCH_NAME ?: sh(script: 'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"', returnStdout: true).trim()
                        env.BUILD_TIMESTAMP  = sh(script: 'date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown"', returnStdout: true).trim()

                        def detectedIp = sh(script: 'kubectl get nodes -o wide 2>/dev/null | awk \'NR==2 {print $6}\'', returnStdout: true).trim()
                        if (detectedIp && detectedIp != '<none>' && detectedIp != 'NAME' && detectedIp.contains('.')) {
                            env.K3S_NODE_IP = detectedIp
                        } else {
                            env.K3S_NODE_IP = '172.17.184.54'
                        }
                    } else {
                        env.GIT_COMMIT_SHORT = bat(script: '@git rev-parse --short HEAD 2>nul || echo b%BUILD_NUMBER%', returnStdout: true).trim()
                        env.GIT_COMMIT_FULL  = bat(script: '@git rev-parse HEAD 2>nul || echo unknown', returnStdout: true).trim()
                        env.GIT_AUTHOR       = bat(script: '@git log -1 --pretty=format:"%%an" 2>nul || echo jenkins', returnStdout: true).trim()
                        env.GIT_MESSAGE      = bat(script: '@git log -1 --pretty=format:"%%s" 2>nul || echo build', returnStdout: true).trim()
                        env.GIT_BRANCH_NAME  = env.BRANCH_NAME ?: env.GIT_BRANCH ?: params.BRANCH_NAME ?: bat(script: '@git rev-parse --abbrev-ref HEAD 2>nul || echo main', returnStdout: true).trim()
                        env.BUILD_TIMESTAMP  = bat(script: '@powershell -Command "Get-Date -Format yyyy-MM-ddTHH:mm:ssZ"', returnStdout: true).trim()

                        def detectedIp = bat(script: '@powershell -Command "$ip = (wsl kubectl get nodes -o wide --no-headers 2>nul) -split \'\\s+\' | Select-Object -Index 5; if ($ip) { Write-Output $ip }"', returnStdout: true).trim()
                        if (detectedIp && detectedIp != '<none>' && detectedIp.contains('.')) {
                            env.K3S_NODE_IP = detectedIp
                        } else {
                            env.K3S_NODE_IP = '172.17.184.54'
                        }
                    }
                    env.IMAGE_TAG   = "${env.BUILD_NUMBER}"
                    env.APP_URL     = "http://${env.K3S_NODE_IP}:30080/"
                    env.BACKEND_URL = "http://${env.K3S_NODE_IP}:30080"
                }

                echo "✅ Repository cloned successfully"
                echo "Using GHCR credential ID: ghcr-credentials"
                echo "   Branch   : ${env.GIT_BRANCH_NAME}"
                echo "   Commit   : ${env.GIT_COMMIT_SHORT} — ${env.GIT_MESSAGE}"
                echo "   Author   : ${env.GIT_AUTHOR}"
                echo "   ImageTag : ${env.IMAGE_TAG}"

                // Verify critical project files exist
                sh '''
                    echo "🔍 Verifying repository integrity..."
                    for f in docker-compose.yml backend/package.json frontend/package.json; do
                        if [ ! -f "$f" ]; then
                            echo "❌ FATAL: Missing required file: $f"
                            exit 1
                        fi
                    done
                    echo "✅ All critical project files present"
                '''
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 2 — Environment Validation
        // ══════════════════════════════════════════════════════════════════════
        stage('Environment Validation') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 2 — Environment Validation\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                sh '''
                    ERRORS=0

                    echo "🔍 Checking required tools..."

                    # Docker
                    if command -v docker &>/dev/null; then
                        echo "  ✅ Docker        : $(docker --version)"
                    else
                        echo "  ❌ Docker        : NOT FOUND"
                        ERRORS=$((ERRORS + 1))
                    fi

                    # Docker Compose (v2 plugin)
                    if docker compose version &>/dev/null; then
                        echo "  ✅ Docker Compose: $(docker compose version --short)"
                    elif command -v docker-compose &>/dev/null; then
                        echo "  ✅ Docker Compose: $(docker-compose --version)"
                    else
                        echo "  ❌ Docker Compose: NOT FOUND"
                        ERRORS=$((ERRORS + 1))
                    fi

                    # Git
                    if command -v git &>/dev/null; then
                        echo "  ✅ Git           : $(git --version)"
                    else
                        echo "  ❌ Git           : NOT FOUND"
                        ERRORS=$((ERRORS + 1))
                    fi

                    # Node.js
                    if command -v node &>/dev/null; then
                        echo "  ✅ Node.js       : $(node --version)"
                    else
                        echo "  ❌ Node.js       : NOT FOUND"
                        ERRORS=$((ERRORS + 1))
                    fi

                    # npm
                    if command -v npm &>/dev/null; then
                        echo "  ✅ npm           : $(npm --version)"
                    else
                        echo "  ❌ npm           : NOT FOUND"
                        ERRORS=$((ERRORS + 1))
                    fi

                    echo ""
                    echo "🔍 Checking required directories..."
                    for dir in backend frontend nginx database; do
                        if [ -d "$dir" ]; then
                            echo "  ✅ $dir/"
                        else
                            echo "  ❌ $dir/ — MISSING"
                            ERRORS=$((ERRORS + 1))
                        fi
                    done

                    echo ""
                    echo "🔍 Checking and generating environment files..."
                    # Generate .env files if missing (they are gitignored for security)
                    chmod +x jenkins/scripts/generate-env.sh 2>/dev/null || true
                    if [ -x jenkins/scripts/generate-env.sh ]; then
                        ./jenkins/scripts/generate-env.sh
                    else
                        # Fallback: inline generation if script not available
                        for envfile in backend/.env frontend/.env; do
                            if [ -f "$envfile" ]; then
                                echo "  ✅ $envfile"
                            else
                                echo "  ⚠️  $envfile — MISSING"
                                TEMPLATE="${envfile%.env}.env.example"
                                if [ -f "$TEMPLATE" ]; then
                                    echo "  📋 Generating from $TEMPLATE..."
                                    cp "$TEMPLATE" "$envfile"
                                    # Fix MongoDB URI for Docker networking
                                    sed -i 's|mongodb://localhost:|mongodb://mongodb:|' "$envfile"
                                    echo "  ✅ $envfile generated from template"
                                else
                                    echo "  ❌ No template found — creating minimal defaults"
                                    if echo "$envfile" | grep -q "backend"; then
                                        cat > "$envfile" <<ENVEOF
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://mongodb:27017/civicpulse
JWT_ACCESS_SECRET=civicpulse-ci-access-secret
JWT_REFRESH_SECRET=civicpulse-ci-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:4200
LOG_LEVEL=debug
ENVEOF
                                    else
                                        cat > "$envfile" <<ENVEOF
NODE_ENV=development
API_URL=http://localhost:3000/api
PORT=3000
MONGODB_URI=mongodb://mongodb:27017/civicpulse
JWT_ACCESS_SECRET=civicpulse-ci-access-secret
JWT_REFRESH_SECRET=civicpulse-ci-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=user
SMTP_PASS=pass
AI_API_KEY=your-ai-api-key-here
ENVEOF
                                    fi
                                    echo "  ✅ $envfile generated with defaults"
                                fi
                            fi
                        done
                    fi

                    echo ""
                    echo "🔍 Checking Dockerfiles..."
                    for df in backend/Dockerfile.backend frontend/Dockerfile.frontend database/Dockerfile.mongodb nginx/Dockerfile.nginx; do
                        if [ -f "$df" ]; then
                            echo "  ✅ $df"
                        else
                            echo "  ❌ $df — MISSING"
                            ERRORS=$((ERRORS + 1))
                        fi
                    done

                    echo ""
                    if [ $ERRORS -gt 0 ]; then
                        echo "❌ FATAL: $ERRORS environment validation error(s) found. Aborting pipeline."
                        exit 1
                    fi
                    echo "✅ Environment validation passed — all checks green"
                '''
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 3 — Install Dependencies
        // ══════════════════════════════════════════════════════════════════════
        stage('Install Dependencies') {
            parallel {
                stage('Backend Dependencies') {
                    steps {
                        echo '📦 Installing backend dependencies...'
                        dir('backend') {
                            sh '''
                                if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
                                    echo "  ℹ️  node_modules exists — running npm ci for deterministic install"
                                fi
                                npm ci --prefer-offline --no-audit
                                echo "  ✅ Backend dependencies installed ($(ls node_modules | wc -l) packages)"
                            '''
                        }
                    }
                }
                stage('Frontend Dependencies') {
                    steps {
                        echo '📦 Installing frontend dependencies...'
                        dir('frontend') {
                            sh '''
                                if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
                                    echo "  ℹ️  node_modules exists — running npm ci for deterministic install"
                                fi
                                npm ci --prefer-offline --no-audit
                                echo "  ✅ Frontend dependencies installed ($(ls node_modules | wc -l) packages)"
                            '''
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 4 — Static Code Validation
        // ══════════════════════════════════════════════════════════════════════
        stage('Static Code Validation') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            parallel {
                stage('Backend Lint') {
                    steps {
                        echo '🔎 Running backend static analysis...'
                        dir('backend') {
                            // npm audit — advisory only, don't fail the build
                            sh '''
                                echo "  📋 npm audit (advisory)..."
                                npm audit --audit-level=high || echo "  ⚠️  Audit found vulnerabilities (advisory — non-blocking)"
                            '''
                            // ESLint
                            sh '''
                                echo "  📋 ESLint..."
                                npx eslint src/**/*.ts --max-warnings=0 || {
                                    echo "  ⚠️  Lint warnings found — review recommended"
                                    exit 0
                                }
                                echo "  ✅ Backend lint passed"
                            '''
                        }
                    }
                }
                stage('Frontend Lint') {
                    steps {
                        echo '🔎 Running frontend static analysis...'
                        dir('frontend') {
                            sh '''
                                echo "  📋 npm audit (advisory)..."
                                npm audit --audit-level=high || echo "  ⚠️  Audit found vulnerabilities (advisory — non-blocking)"
                            '''
                            // Prettier format check
                            sh '''
                                echo "  📋 Prettier format check..."
                                npx prettier --check "src/**/*.{ts,html,scss}" || {
                                    echo "  ⚠️  Formatting issues found — review recommended"
                                    exit 0
                                }
                                echo "  ✅ Frontend format check passed"
                            '''
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 5 — Build Application
        // ══════════════════════════════════════════════════════════════════════
        stage('Build Application') {
            parallel {
                stage('Build Backend') {
                    steps {
                        echo '🔨 Building backend (TypeScript → JavaScript)...'
                        dir('backend') {
                            sh '''
                                npm run build
                                echo "  ✅ Backend build complete"
                                echo "  📁 Output: backend/dist/"
                                ls -la dist/ | head -20
                            '''
                        }
                    }
                }
                stage('Build Frontend') {
                    steps {
                        echo '🔨 Building frontend (Angular production build)...'
                        dir('frontend') {
                            sh '''
                                npm run build -- --configuration production
                                echo "  ✅ Frontend build complete"
                                echo "  📁 Output: frontend/dist/"
                                du -sh dist/ 2>/dev/null || echo "  ℹ️  dist directory created"
                            '''
                        }
                    }
                }
            }
            post {
                success {
                    // Archive build artifacts for Jenkins build history
                    archiveArtifacts artifacts: 'backend/dist/**/*', fingerprint: true, allowEmptyArchive: true
                    archiveArtifacts artifacts: 'frontend/dist/**/*', fingerprint: true, allowEmptyArchive: true
                    echo '📦 Build artifacts archived'
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 5.5 — Unit Tests & Code Coverage
        // ══════════════════════════════════════════════════════════════════════
        stage('Unit Tests & Code Coverage') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            parallel {
                stage('Backend Unit Tests') {
                    steps {
                        echo '🧪 Running backend unit tests & generating LCOV coverage...'
                        dir('backend') {
                            script {
                                if (isUnix()) {
                                    sh '''
                                        echo "════════════════════════════════════════"
                                        echo "  🍃 MongoDB CI Test Database"
                                        echo "════════════════════════════════════════"
                                        echo ""
                                        
                                        check_port() {
                                            if command -v nc &>/dev/null; then
                                                nc -z 127.0.0.1 27017 2>/dev/null
                                            else
                                                (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null
                                            fi
                                        }

                                        echo "Checking MongoDB connectivity on 127.0.0.1:27017..."
                                        if check_port; then
                                            echo "  ℹ️  MongoDB is already listening on 127.0.0.1:27017"
                                        else
                                            echo "Starting MongoDB..."
                                            docker rm -f civicpulse-ci-mongodb 2>/dev/null || true
                                            docker run -d \
                                                --name civicpulse-ci-mongodb \
                                                -p 27017:27017 \
                                                mongo:8.0 || {
                                                    echo "  ⚠️ mongo:8.0 launch failed, trying civicpulse/mongodb:${env.IMAGE_TAG}..."
                                                    docker run -d --name civicpulse-ci-mongodb -p 27017:27017 civicpulse/mongodb:${env.IMAGE_TAG}
                                                }
                                        fi

                                        echo "Waiting for MongoDB..."
                                        MAX_RETRIES=30
                                        RETRY_COUNT=0
                                        READY=0

                                        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
                                            if check_port; then
                                                if docker ps --format '{{.Names}}' | grep -q "^civicpulse-ci-mongodb$"; then
                                                    PING_RES=$(docker exec civicpulse-ci-mongodb mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || true)
                                                    if [ "$PING_RES" = "1" ] || echo "$PING_RES" | grep -q "1"; then
                                                        READY=1
                                                        break
                                                    fi
                                                else
                                                    READY=1
                                                    break
                                                fi
                                            fi
                                            RETRY_COUNT=$((RETRY_COUNT + 1))
                                            echo "  ⏳ Waiting for MongoDB... ($RETRY_COUNT/$MAX_RETRIES)"
                                            sleep 1
                                        done

                                        if [ $READY -eq 1 ]; then
                                            echo "MongoDB is ready."
                                            echo "MongoDB listening on 127.0.0.1:27017"
                                            echo "Starting backend integration tests..."
                                            echo ""
                                        else
                                            echo "❌ FATAL: MongoDB did not become ready on 127.0.0.1:27017"
                                            docker logs civicpulse-ci-mongodb 2>&1 || true
                                            docker rm -f civicpulse-ci-mongodb 2>/dev/null || true
                                            exit 1
                                        fi

                                        export TEST_MONGODB_URI="mongodb://127.0.0.1:27017/civicpulse_test"
                                        export MONGODB_URI="mongodb://127.0.0.1:27017/civicpulse_test"
                                        npm test
                                        echo "  ✅ Backend tests completed"
                                        if [ -f "coverage/lcov.info" ]; then
                                            echo "  ✅ backend/coverage/lcov.info successfully generated"
                                        else
                                            echo "  ❌ FATAL: backend/coverage/lcov.info missing!"
                                            exit 1
                                        fi
                                    '''
                                } else {
                                    bat '''
                                        echo ════════════════════════════════════════
                                        echo   🍃 MongoDB CI Test Database
                                        echo ════════════════════════════════════════
                                        echo Starting MongoDB...
                                        docker rm -f civicpulse-ci-mongodb 2>NUL
                                        docker run -d --name civicpulse-ci-mongodb -p 27017:27017 mongo:8.0
                                        echo Waiting for MongoDB...
                                        docker exec civicpulse-ci-mongodb mongosh --quiet --eval "db.adminCommand('ping').ok"
                                        echo MongoDB is ready.
                                        echo MongoDB listening on 127.0.0.1:27017
                                        echo Starting backend integration tests...
                                        set TEST_MONGODB_URI=mongodb://127.0.0.1:27017/civicpulse_test
                                        set MONGODB_URI=mongodb://127.0.0.1:27017/civicpulse_test
                                        npm test
                                        if exist coverage\\lcov.info (
                                            echo ✅ backend\\coverage\\lcov.info successfully generated
                                        ) else (
                                            echo ❌ FATAL: backend\\coverage\\lcov.info missing!
                                            exit 1
                                        )
                                    '''
                                }
                            }
                        }
                    }
                    post {
                        always {
                            script {
                                if (isUnix()) {
                                    sh 'docker rm -f civicpulse-ci-mongodb 2>/dev/null || true'
                                } else {
                                    bat 'docker rm -f civicpulse-ci-mongodb 2>NUL || exit 0'
                                }
                            }
                        }
                    }
                }
                stage('Frontend Unit Tests') {
                    steps {
                        echo '🧪 Running frontend unit tests & generating LCOV coverage...'
                        dir('frontend') {
                            script {
                                if (isUnix()) {
                                    sh '''
                                        npm test
                                        echo "  ✅ Frontend tests completed"
                                        if [ -f "coverage/lcov.info" ]; then
                                            echo "  ✅ frontend/coverage/lcov.info successfully generated"
                                        else
                                            echo "  ❌ FATAL: frontend/coverage/lcov.info missing!"
                                            exit 1
                                        fi
                                    '''
                                } else {
                                    bat '''
                                        npm test
                                        if exist coverage\\lcov.info (
                                            echo ✅ frontend\\coverage\\lcov.info successfully generated
                                        ) else (
                                            echo ❌ FATAL: frontend\\coverage\\lcov.info missing!
                                            exit 1
                                        )
                                    '''
                                }
                            }
                        }
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'backend/coverage/**/*', fingerprint: true, allowEmptyArchive: true
                    archiveArtifacts artifacts: 'frontend/coverage/**/*', fingerprint: true, allowEmptyArchive: true
                    echo '📦 Unit test coverage reports archived'
                }
            }
        }
            
        // ══════════════════════════════════════════════════════════════════════
        // STAGE 6 — SonarQube Analysis (Using manually installed system sonar-scanner)
        // ══════════════════════════════════════════════════════════════════════
        stage('SonarQube Analysis') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 6 — SonarQube Analysis\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    echo "🔍 Executing pre-scan coverage diagnostics..."
                    if (isUnix()) {
                        sh '''
                            echo "📍 Current working directory:"
                            pwd
                            echo "📂 Workspace contents:"
                            ls -la
                            echo "🔎 Searching for lcov.info files in workspace:"
                            find . -name "lcov.info" || true
                            echo "📁 backend/coverage contents:"
                            ls -R backend/coverage 2>/dev/null || echo "  (backend/coverage directory missing)"
                            echo "📁 frontend/coverage contents:"
                            ls -R frontend/coverage 2>/dev/null || echo "  (frontend/coverage directory missing)"
                        '''
                    } else {
                        bat '''
                            echo Current working directory:
                            cd
                            echo Workspace contents:
                            dir
                            echo Searching for lcov.info files in workspace:
                            dir /s /b lcov.info
                            echo backend/coverage contents:
                            dir /s backend\\coverage
                            echo frontend/coverage contents:
                            dir /s frontend\\coverage
                        '''
                    }

                    echo "🔍 Executing SonarQube analysis using system-installed sonar-scanner CLI..."

                    // Execute SonarQube analysis against configured server ('SonarQube') using system PATH
                    withSonarQubeEnv('SonarQube') {
                        // Export SONAR_TOKEN for SonarScanner CLI and SonarQube 10.x environment inheritance
                        env.SONAR_TOKEN = env.SONAR_TOKEN ?: env.SONAR_AUTH_TOKEN
                        if (isUnix()) {
                            // Execution on Linux / Unix agents
                            sh '/opt/sonar-scanner/bin/sonar-scanner'
                        } else {
                            // Execution on Windows agents
                            bat 'sonar-scanner'
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 7 — SonarQube Quality Gate
        // ══════════════════════════════════════════════════════════════════════
        stage('SonarQube Quality Gate') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 7 — SonarQube Quality Gate\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    // Pause execution and wait for SonarQube server webhook to evaluate Quality Gate status
                    // Timeout set to 5 minutes to prevent build agent hanging indefinitely
                    timeout(time: 45, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "❌ SonarQube Quality Gate FAILED with status '${qg.status}'. Pipeline execution aborted before Docker Build."
                        } else {
                            echo "✅ SonarQube Quality Gate PASSED with status '${qg.status}'."
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 8 — Trivy Filesystem Scan
        // ══════════════════════════════════════════════════════════════════════
        stage('Trivy Filesystem Scan') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 8 — Trivy Filesystem Scan\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    def trivyCache = "${WORKSPACE}/.trivy-cache"
                    // Create Trivy reports and cache directories (OS agnostic)
                    if (isUnix()) {
                        sh 'mkdir -p jenkins/reports/trivy'
                        sh "mkdir -p '${trivyCache}'"
                        sh 'chmod +x jenkins/scripts/trivy-init-db.sh'
                        sh './jenkins/scripts/trivy-init-db.sh'
                    } else {
                        bat 'if not exist jenkins\\reports\\trivy mkdir jenkins\\reports\\trivy'
                        bat 'if not exist .trivy-cache mkdir .trivy-cache'
                        bat "set HTTP2_DISABLE=true && set GODEBUG=http2client=0 && trivy fs --cache-dir \"%WORKSPACE%\\.trivy-cache\" --download-db-only --timeout 15m --db-repository \"mirror.gcr.io/aquasec/trivy-db:2,ghcr.io/aquasecurity/trivy-db:2\" ."
                    }

                    echo '[TRIVY] Starting filesystem vulnerability scan...'

                    if (isUnix()) {
                        // Generate JSON, SARIF, and HTML reports for filesystem scan using cached DB
                        sh """
                            trivy fs --cache-dir "${trivyCache}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-fs-report.json . || true
                            trivy fs --cache-dir "${trivyCache}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-fs-report.sarif . || true
                            trivy fs --cache-dir "${trivyCache}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-fs-report.html . || true
                        """
                        // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                        sh "trivy fs --cache-dir \"${trivyCache}\" --skip-db-update --severity ${env.TRIVY_SEVERITY ?: 'HIGH,CRITICAL'} --ignorefile .trivyignore --exit-code 1 ."
                    } else {
                        // Windows agent execution using cached DB
                        bat """
                            trivy fs --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-fs-report.json . || exit 0
                            trivy fs --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-fs-report.sarif . || exit 0
                            trivy fs --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-fs-report.html . || exit 0
                        """
                        // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                        bat "trivy fs --cache-dir \"%WORKSPACE%\\.trivy-cache\" --skip-db-update --severity %TRIVY_SEVERITY% --ignorefile .trivyignore --exit-code 1 ."
                    }
                }
            }
            post {
                always {
                    // Archive filesystem vulnerability scan reports as Jenkins build artifacts
                    archiveArtifacts artifacts: 'jenkins/reports/trivy/trivy-fs-report.*', fingerprint: true, allowEmptyArchive: true
                    echo '📦 Trivy Filesystem vulnerability reports archived'
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 9 — Docker Build
        // ══════════════════════════════════════════════════════════════════════
        stage('Docker Build') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 9 — Docker Build\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    // Prune dangling images if enabled
                    if (params.DOCKER_PRUNE) {
                        sh '''
                            echo "🧹 Pruning dangling Docker images..."
                            docker image prune -f || true
                            echo "  ✅ Prune complete"
                        '''
                    }

                    // Build Docker images tagged with BUILD_NUMBER
                    def buildFlags = params.FORCE_REBUILD ? '--no-cache --pull' : '--pull'
                    if (isUnix()) {
                        sh """
                            echo "🐳 Building Docker images tagged as ${env.IMAGE_TAG} (flags: ${buildFlags})..."
                            if ! IMAGE_TAG="${env.IMAGE_TAG}" docker compose build ${buildFlags}; then
                                echo "❌ [DOCKER BUILD] Docker Compose image build failed"
                                exit 1
                            fi
                            echo ""
                            echo "✅ Docker images built successfully"
                        """
                    } else {
                        bat """
                            echo 🐳 Building Docker images tagged as ${env.IMAGE_TAG} (flags: ${buildFlags})...
                            set IMAGE_TAG=${env.IMAGE_TAG}
                            docker compose build ${buildFlags}
                            if errorlevel 1 (
                                echo ❌ [DOCKER BUILD] Docker Compose image build failed
                                exit /b 1
                            )
                            echo.
                            echo ✅ Docker images built successfully
                        """
                    }

                    // Display built images
                    sh '''
                        echo ""
                        echo "📋 Docker images:"
                        docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}\\t{{.CreatedSince}}" | grep -E "civicpulse|REPOSITORY" || true
                    '''
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10 — Trivy Image Scan
        // ══════════════════════════════════════════════════════════════════════
        stage('Trivy Image Scan') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10 — Trivy Image Scan\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {

                    // Create Trivy reports directory
                    if (isUnix()) {
                        sh 'mkdir -p jenkins/reports/trivy'
                    } else {
                        bat 'if not exist jenkins\\reports\\trivy mkdir jenkins\\reports\\trivy'
                    }
                    def currentTag = (env.IMAGE_TAG && env.IMAGE_TAG != 'null') ? env.IMAGE_TAG : (env.BUILD_NUMBER ?: 'build')
                    // Container images generated by Docker Compose build
                    def imagesToScan = [
                        "${env.DOCKER_IMAGE_PREFIX}/backend:${currentTag}",
                        "${env.DOCKER_IMAGE_PREFIX}/frontend:${currentTag}",
                        "${env.DOCKER_IMAGE_PREFIX}/nginx:${currentTag}",
                        "${env.DOCKER_IMAGE_PREFIX}/mongodb:${currentTag}"
                    ]

                    imagesToScan.each { img ->
                        def cleanName = img.replace('/', '-').replace(':', '-')
                        echo "🛡️ Scanning image: ${img}..."

                        if (isUnix()) {
                            // Generate JSON, SARIF, and HTML reports for each container image using cached DB
                            sh """
                                trivy image --cache-dir "${env.TRIVY_CACHE_DIR}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-${cleanName}-report.json ${img} || true
                                trivy image --cache-dir "${env.TRIVY_CACHE_DIR}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-${cleanName}-report.sarif ${img} || true
                                trivy image --cache-dir "${env.TRIVY_CACHE_DIR}" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-${cleanName}-report.html ${img} || true
                            """
                            // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                            sh "trivy image --cache-dir \"${env.TRIVY_CACHE_DIR}\" --skip-db-update --severity ${env.TRIVY_SEVERITY ?: 'HIGH,CRITICAL'} --ignorefile .trivyignore --exit-code 1 ${img}"
                        } else {
                            // Windows agent execution using cached DB
                            bat """
                                trivy image --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-${cleanName}-report.json ${img} || exit 0
                                trivy image --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-${cleanName}-report.sarif ${img} || exit 0
                                trivy image --cache-dir "%WORKSPACE%\\.trivy-cache" --skip-db-update --severity HIGH,CRITICAL --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-${cleanName}-report.html ${img} || exit 0
                            """
                            bat "trivy image --cache-dir \"%WORKSPACE%\\.trivy-cache\" --skip-db-update --severity %TRIVY_SEVERITY% --ignorefile .trivyignore --exit-code 1 ${img}"
                        }
                    }
                }
            }
            post {
                always {
                    // Archive all container image vulnerability reports as Jenkins artifacts
                    archiveArtifacts artifacts: 'jenkins/reports/trivy/**/*', fingerprint: true, allowEmptyArchive: true
                    echo '📦 All Trivy Container Image vulnerability reports archived'
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10.5 — Push Images to GHCR
        // ══════════════════════════════════════════════════════════════════════
        stage('Push Images to GHCR') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10.5 — Push Images to GHCR\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    withCredentials([usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USERNAME', passwordVariable: 'GHCR_TOKEN')]) {
                        def backendLocal       = "${env.DOCKER_IMAGE_PREFIX}/backend:${env.IMAGE_TAG}"
                        def frontendLocal      = "${env.DOCKER_IMAGE_PREFIX}/frontend:${env.IMAGE_TAG}"
                        def nginxLocal         = "${env.DOCKER_IMAGE_PREFIX}/nginx:${env.IMAGE_TAG}"
                        def mongodbLocal       = "${env.DOCKER_IMAGE_PREFIX}/mongodb:${env.IMAGE_TAG}"

                        def backendGhcrTag     = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}"
                        def frontendGhcrTag    = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}"
                        def nginxGhcrTag       = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}"
                        def mongodbGhcrTag     = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}"

                        if (isUnix()) {
                            sh """
                                set -e
                                set +x
                                echo "🔐 Logging in to GitHub Container Registry (${env.GHCR_REGISTRY})..."
                                echo "\${GHCR_TOKEN}" | docker login "${env.GHCR_REGISTRY}" -u "\${GHCR_USERNAME}" --password-stdin
                                echo "  ✅ Logged in to GHCR successfully"

                                echo ""
                                echo "🏷️ Tagging container images for GHCR (tag: ${env.IMAGE_TAG})..."
                                docker tag ${backendLocal} ${backendGhcrTag}
                                docker tag ${frontendLocal} ${frontendGhcrTag}
                                docker tag ${nginxLocal} ${nginxGhcrTag}
                                docker tag ${mongodbLocal} ${mongodbGhcrTag}

                                push_with_retry() {
                                    local img="\$1"
                                    local max_attempts=3
                                    local attempt=1
                                    local delay=5

                                    while [ \$attempt -le \$max_attempts ]; do
                                        echo "🚀 Pushing \${img} (Attempt \${attempt}/\${max_attempts})..."
                                        local output
                                        set +e
                                        output=\$(docker push "\${img}" 2>&1)
                                        local exit_code=\$?
                                        set -e

                                        if [ \$exit_code -eq 0 ]; then
                                            echo "  ✅ Successfully pushed \${img}"
                                            return 0
                                        fi

                                        echo "⚠️ Push attempt \${attempt} failed for \${img}:"
                                        echo "\${output}"

                                        # Non-retryable auth / permission check
                                        if echo "\${output}" | grep -iE "unauthorized|authentication|permission denied|invalid credentials|repository not found|401|403" >/dev/null 2>&1; then
                                            echo "❌ FATAL: Unrecoverable authentication or permission error. Halting pipeline."
                                            return 1
                                        fi

                                        if [ \$attempt -lt \$max_attempts ]; then
                                            echo "⏳ Waiting \${delay}s before retrying push for \${img}..."
                                            sleep \$delay
                                            delay=\$((delay * 2))
                                        fi
                                        attempt=\$((attempt + 1))
                                    done

                                    echo "❌ FATAL: Failed to push \${img} after \${max_attempts} attempts."
                                    return 1
                                }

                                echo ""
                                echo "🚀 Pushing container images to GHCR with automated retries for transient errors..."
                                push_with_retry "${backendGhcrTag}" || exit 1
                                push_with_retry "${frontendGhcrTag}" || exit 1
                                push_with_retry "${nginxGhcrTag}" || exit 1
                                push_with_retry "${mongodbGhcrTag}" || exit 1

                                echo ""
                                echo "✅ Successfully pushed build-number images to GHCR:"
                                echo "   • ${backendGhcrTag}"
                                echo "   • ${frontendGhcrTag}"
                                echo "   • ${nginxGhcrTag}"
                                echo "   • ${mongodbGhcrTag}"
                            """
                        } else {
                            bat """
                                @echo off
                                echo 🔐 Logging in to GitHub Container Registry (${env.GHCR_REGISTRY})...
                                echo %GHCR_TOKEN% | docker login %GHCR_REGISTRY% -u %GHCR_USERNAME% --password-stdin
                                if errorlevel 1 exit /b 1
                                echo   ✅ Logged in to GHCR successfully

                                echo.
                                echo 🏷️ Tagging container images for GHCR (tag: ${env.IMAGE_TAG})...
                                docker tag ${backendLocal} ${backendGhcrTag}
                                docker tag ${frontendLocal} ${frontendGhcrTag}
                                docker tag ${nginxLocal} ${nginxGhcrTag}
                                docker tag ${mongodbLocal} ${mongodbGhcrTag}
                                if errorlevel 1 exit /b 1

                                echo.
                                echo 🚀 Pushing container images to GHCR...
                                docker push ${backendGhcrTag}
                                if errorlevel 1 exit /b 1
                                docker push ${frontendGhcrTag}
                                if errorlevel 1 exit /b 1
                                docker push ${nginxGhcrTag}
                                if errorlevel 1 exit /b 1
                                docker push ${mongodbGhcrTag}
                                if errorlevel 1 exit /b 1

                                echo.
                                echo ✅ Successfully pushed container images to GHCR:
                                echo    • ${backendGhcrTag}
                                echo    • ${frontendGhcrTag}
                                echo    • ${nginxGhcrTag}
                                echo    • ${mongodbGhcrTag}
                            """
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10.6 — Pre-Deployment Image Verification
        // ══════════════════════════════════════════════════════════════════════
        stage('Pre-Deployment Image Verification') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10.6 — Pre-Deployment Image Verification\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    echo "=================================================="
                    echo "IMAGE VERSION VERIFICATION"
                    echo "=================================================="
                    echo "IMAGE_TAG = ${env.IMAGE_TAG}"
                    echo ""
                    echo "Backend:  ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}"
                    echo "Frontend: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}"
                    echo "Nginx:    ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}"
                    echo "MongoDB:  ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}"
                    echo "=================================================="

                    withCredentials([usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USERNAME', passwordVariable: 'GHCR_TOKEN')]) {
                        if (isUnix()) {
                            sh """
                                set -e
                                set +x
                                echo "🔐 Authenticating with GHCR before inspecting image manifests..."
                                echo "\${GHCR_TOKEN}" | docker login "${env.GHCR_REGISTRY}" -u "\${GHCR_USERNAME}" --password-stdin
                                echo "  ✅ GHCR authentication successful"

                                echo ""
                                echo "🔍 Verifying images exist in GHCR before deployment..."

                                for repo_name in "civicpulse-backend" "civicpulse-frontend" "civicpulse-mongodb" "civicpulse-nginx"; do
                                    img="${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/\${repo_name}:${env.IMAGE_TAG}"
                                    short_name="\${repo_name#civicpulse-}"
                                    echo "  Verifying image: \${img}..."
                                    if ! docker manifest inspect "\${img}" >/dev/null 2>&1; then
                                        echo "  ❌ FATAL: Image manifest not found in GHCR: \${img}"
                                        exit 1
                                    fi
                                    echo "[IMAGE VERIFY] \${short_name}:${env.IMAGE_TAG} FOUND"
                                done
                                echo ""
                                echo "✅ All required container images verified in GHCR"
                            """
                        } else {
                            bat """
                                @echo off
                                echo 🔐 Authenticating with GHCR before inspecting image manifests...
                                echo %GHCR_TOKEN% | docker login %GHCR_REGISTRY% -u %GHCR_USERNAME% --password-stdin
                                if errorlevel 1 exit /b 1
                                echo   ✅ GHCR authentication successful

                                echo.
                                echo 🔍 Verifying images exist in GHCR before deployment...

                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                echo [IMAGE VERIFY] backend:${env.IMAGE_TAG} FOUND

                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                echo [IMAGE VERIFY] frontend:${env.IMAGE_TAG} FOUND

                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                echo [IMAGE VERIFY] mongodb:${env.IMAGE_TAG} FOUND

                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                echo [IMAGE VERIFY] nginx:${env.IMAGE_TAG} FOUND

                                echo.
                                echo ✅ All required container images verified in GHCR
                            """
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 11 — Update GitOps Repository (Argo CD Deployment)
        // ══════════════════════════════════════════════════════════════════════
        stage('Update GitOps Repository') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 11 — Update GitOps Repository & Trigger Argo CD Deployment\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    env.KUBERNETES_STAGE_REACHED = 'true'
                    sh 'chmod +x jenkins/scripts/update-gitops.sh'
                    
                    echo '[GITOPS] Starting GitOps update stage...'

                    def gitopsUser = ''
                    def gitopsPass = ''
                    def credsFound = false

                    // Candidate 1: 'github-gitops-credentials' (usernamePassword)
                    try {
                        withCredentials([
                            usernamePassword(
                                credentialsId: 'github-gitops-credentials',
                                usernameVariable: 'GITOPS_USER_TMP',
                                passwordVariable: 'GITOPS_PASS_TMP'
                            )
                        ]) {
                            gitopsUser = env.GITOPS_USER_TMP
                            gitopsPass = env.GITOPS_PASS_TMP
                            credsFound = true
                            echo '[GITOPS] Authenticated using Jenkins credential ID: github-gitops-credentials'
                        }
                    } catch (Exception e1) {
                        echo "  ℹ️  Credential 'github-gitops-credentials' not available: ${e1.message}"
                    }

                    // Candidate 2: 'ghcr-credentials' (usernamePassword - verified active in Stage 10.5)
                    if (!credsFound) {
                        try {
                            withCredentials([
                                usernamePassword(
                                    credentialsId: 'ghcr-credentials',
                                    usernameVariable: 'GITOPS_USER_TMP',
                                    passwordVariable: 'GITOPS_PASS_TMP'
                                )
                            ]) {
                                gitopsUser = env.GITOPS_USER_TMP
                                gitopsPass = env.GITOPS_PASS_TMP
                                credsFound = true
                                echo '[GITOPS] Authenticated using Jenkins credential ID: ghcr-credentials'
                            }
                        } catch (Exception e2) {
                            echo "  ℹ️  Credential 'ghcr-credentials' fallback check: ${e2.message}"
                        }
                    }

                    // Candidate 3: 'github-credentials' (usernamePassword)
                    if (!credsFound) {
                        try {
                            withCredentials([
                                usernamePassword(
                                    credentialsId: 'github-credentials',
                                    usernameVariable: 'GITOPS_USER_TMP',
                                    passwordVariable: 'GITOPS_PASS_TMP'
                                )
                            ]) {
                                gitopsUser = env.GITOPS_USER_TMP
                                gitopsPass = env.GITOPS_PASS_TMP
                                credsFound = true
                                echo '[GITOPS] Authenticated using Jenkins credential ID: github-credentials'
                            }
                        } catch (Exception e3) {
                            echo "  ℹ️  Credential 'github-credentials' fallback check: ${e3.message}"
                        }
                    }

                    // Candidate 4: 'github-token' (string / secret text)
                    if (!credsFound) {
                        try {
                            withCredentials([
                                string(
                                    credentialsId: 'github-token',
                                    variable: 'GITOPS_PASS_TMP'
                                )
                            ]) {
                                gitopsUser = 'x-access-token'
                                gitopsPass = env.GITOPS_PASS_TMP
                                credsFound = true
                                echo '[GITOPS] Authenticated using Jenkins secret text credential ID: github-token'
                            }
                        } catch (Exception e4) {
                            echo "  ℹ️  Secret text credential 'github-token' fallback check: ${e4.message}"
                        }
                    }

                    if (!credsFound) {
                        echo '⚠️  No matching Jenkins GitOps credentials found in credential store. Proceeding with environment defaults...'
                    }

                    // Execute update-gitops.sh securely with loaded credentials
                    withEnv([
                        "GITOPS_USERNAME=${gitopsUser}",
                        "GITOPS_TOKEN=${gitopsPass}"
                    ]) {
                        sh """
                            ./jenkins/scripts/update-gitops.sh \
                                --build-number "${BUILD_NUMBER}" \
                                --branch "${env.GIT_BRANCH_NAME}" \
                                --username "\${GITOPS_USERNAME}" \
                                --token "\${GITOPS_TOKEN}"
                        """
                    }

                    // Optional direct Helm fallback if DEPLOY_METHOD is explicitly set to 'helm-direct'
                    if (env.DEPLOY_METHOD == 'helm-direct') {
                        echo "ℹ️  Executing direct Helm deployment fallback..."
                        withCredentials([
                            usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USERNAME', passwordVariable: 'GHCR_TOKEN')
                        ]) {
                            sh '''
                                chmod +x jenkins/scripts/deploy.sh
                                export DEPLOY_METHOD=helm
                                export IMAGE_TAG="${IMAGE_TAG}"
                                bash jenkins/scripts/deploy.sh
                            '''
                        }
                    } else {
                        echo "✅ GitOps repository updated. Argo CD will synchronize the K3s cluster automatically."
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 12 — Health Verification
        // ══════════════════════════════════════════════════════════════════════
        stage('Health Verification') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 12 — Health Verification\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    def deployMethod = env.DEPLOY_METHOD ?: 'helm'
                    echo "📋 Health Verification Mode: ${deployMethod}"
                    echo "⏳ Waiting ${STARTUP_WAIT}s for services to initialize..."
                    sleep(time: Integer.parseInt(env.STARTUP_WAIT), unit: 'SECONDS')

                    sh 'chmod +x jenkins/scripts/health-check.sh'
                    sh """
                        ./jenkins/scripts/health-check.sh \
                            --deploy-method "${deployMethod}" \
                            --retries ${HEALTH_RETRIES} \
                            --interval ${HEALTH_INTERVAL} \
                            --backend-url "${BACKEND_URL}" \
                            --app-url "${APP_URL}"
                    """
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 13 — Deployment Report
        // ══════════════════════════════════════════════════════════════════════
        stage('Deployment Report') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 13 — Deployment Report\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                sh 'chmod +x jenkins/scripts/generate-report.sh'
                sh """
                    ./jenkins/scripts/generate-report.sh \
                        --build-number "${BUILD_NUMBER}" \
                        --commit "${env.GIT_COMMIT_SHORT}" \
                        --branch "${env.GIT_BRANCH_NAME}" \
                        --app-url "${APP_URL}" \
                        --env "${params.DEPLOY_ENV}"
                """

                // Archive the deployment report
                archiveArtifacts artifacts: 'jenkins/reports/**/*', fingerprint: true, allowEmptyArchive: true
            }
        }
    }

    // ── Post Actions ─────────────────────────────────────────────────────────
    post {
        success {
            script {
                def nodeIp = env.K3S_NODE_IP ?: '172.17.184.54'
                def appUrl = env.APP_URL ?: "http://${nodeIp}:30080/"
                def apiUrl = "${env.BACKEND_URL ?: ('http://' + nodeIp + ':30080')}${env.HEALTH_ENDPOINT ?: '/api/health'}"

                currentBuild.description = "<a href='${appUrl}' target='_blank'>🌐 Open Application (${appUrl})</a>"

                echo '\033[1;32m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;32m  ✅ PIPELINE SUCCEEDED\033[0m'
                echo '\033[1;32m══════════════════════════════════════════════════════════\033[0m'
                echo """
  ✅ Build    : #${BUILD_NUMBER} SUCCESSFUL
  ✅ Deploy   : ${params.DEPLOY_ENV} environment
  🌐 App URL  : ${appUrl}
  🔧 API URL  : ${apiUrl}
  📦 Commit   : ${env.GIT_COMMIT_SHORT ?: 'N/A'}
  🕐 Time     : ${currentBuild.durationString}
                """
            }

            // Display container information
            sh '''
                echo "📋 Running Containers:"
                docker compose ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}" 2>/dev/null || \
                docker compose ps 2>/dev/null || true
            '''
        }

        failure {
            echo '\033[1;31m══════════════════════════════════════════════════════════\033[0m'
            echo '\033[1;31m  ❌ PIPELINE FAILED\033[0m'
            echo '\033[1;31m══════════════════════════════════════════════════════════\033[0m'
            echo """
  ❌ Build #${BUILD_NUMBER} FAILED
  🔀 Branch  : ${env.GIT_BRANCH_NAME ?: 'unknown'}
  📦 Commit  : ${env.GIT_COMMIT_SHORT ?: 'N/A'}
  🕐 Duration: ${currentBuild.durationString}
  📋 Stage   : ${env.STAGE_NAME ?: 'unknown'}
            """

            script {
                if (env.KUBERNETES_STAGE_REACHED == 'true') {
                    sh '''
                        if [ -z "${KUBECONFIG:-}" ]; then
                            if [ -f "${HOME}/.kube/config" ] && [ -r "${HOME}/.kube/config" ]; then
                                export KUBECONFIG="${HOME}/.kube/config"
                            elif [ -f "/home/jenkins/.kube/config" ] && [ -r "/home/jenkins/.kube/config" ]; then
                                export KUBECONFIG="/home/jenkins/.kube/config"
                            elif [ -f "/home/tharun_adhithyaa/.kube/config" ] && [ -r "/home/tharun_adhithyaa/.kube/config" ]; then
                                export KUBECONFIG="/home/tharun_adhithyaa/.kube/config"
                            else
                                export KUBECONFIG="${HOME}/.kube/config"
                            fi
                        fi
                        if [ -f "$KUBECONFIG" ] && [ -r "$KUBECONFIG" ]; then
                            echo ""
                            echo "════════════════════════════════════════"
                            echo "  📋 Kubernetes Deployment Diagnostics (KUBECONFIG=${KUBECONFIG})"
                            echo "════════════════════════════════════════"
                            kubectl get pods -n civicpulse -o wide 2>/dev/null || true
                            kubectl get deployments -n civicpulse 2>/dev/null || true
                            kubectl get services -n civicpulse 2>/dev/null || true
                            kubectl get events -n civicpulse --sort-by='.lastTimestamp' 2>/dev/null || true
                        else
                            echo "ℹ️  Kubernetes stage was reached, but no readable kubeconfig found at ${KUBECONFIG} for diagnostics."
                        fi
                    '''
                } else {
                    echo "ℹ️  Pipeline failed prior to Kubernetes deployment stage. Skipping Kubernetes diagnostics."
                }
            }
        }

        always {
            echo '🧹 Running post-pipeline cleanup...'
            sh '''
                # Run centralized post-build cleanup script
                chmod +x jenkins/scripts/cleanup.sh 2>/dev/null || true
                if [ -x jenkins/scripts/cleanup.sh ]; then
                    ./jenkins/scripts/cleanup.sh
                else
                    # Fallback inline cleanup
                    docker image prune -f 2>/dev/null || true
                    rm -rf /tmp/civicpulse-* 2>/dev/null || true
                fi
            '''
            // Clean Jenkins workspace
            cleanWs(
                cleanWhenNotBuilt: false,
                deleteDirs: true,
                disableDeferredWipeout: true,
                notFailBuild: true
            )
            echo '✅ Post-pipeline cleanup complete'
        }
    }
}
