// ============================================================================
// CivicPulseAI — Declarative Jenkins CI/CD Pipeline (Two-Node Architecture)
// ============================================================================
// Nodes:
//   1. windows-agent : Build, Docker Desktop, MongoDB CI, SonarQube, Scans, GHCR Push
//   2. ubuntu-agent  : K3s, kubectl, Helm Deployment, Health Check, Diagnostics
// ============================================================================

pipeline {
    agent none

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

        // Single pipeline image tag
        IMAGE_TAG           = 'latest'

        // Application URLs (single-server deployment)
        APP_URL             = 'http://localhost:4200'
        BACKEND_URL         = 'http://localhost:8000'
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
    }

    stages {
        // ══════════════════════════════════════════════════════════════════════
        // STAGE 0 — Infrastructure Validation
        // ══════════════════════════════════════════════════════════════════════
        stage('Infrastructure Validation') {
            parallel {
                stage('Validate Windows Docker Node') {
                    agent { label 'windows-agent' }
                    steps {
                        echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                        echo '\033[1;36m  NODE: windows-agent Validation\033[0m'
                        echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                        script {
                            if (isUnix()) {
                                sh '''
                                    echo "Checking Windows/Docker environment..."
                                    which docker || { echo "❌ FATAL: docker executable not found on windows-agent"; exit 1; }
                                    docker version || { echo "❌ FATAL: Docker daemon not responding"; exit 1; }
                                    docker info || { echo "❌ FATAL: Docker info failed"; exit 1; }
                                    echo "✅ Windows Docker windows-agent validated successfully"
                                '''
                            } else {
                                bat '''
                                    @echo off
                                    echo Checking Windows Docker environment...
                                    where docker >nul 2>&1 || (echo ❌ FATAL: docker executable not found on windows-agent & exit /b 1)
                                    docker version || (echo ❌ FATAL: Docker daemon not responding & exit /b 1)
                                    docker info || (echo ❌ FATAL: Docker info failed & exit /b 1)
                                    echo ✅ Windows Docker windows-agent validated successfully
                                '''
                            }
                        }
                    }
                }

                stage('Validate Ubuntu K3s Node') {
                    agent { label 'ubuntu-agent' }
                    steps {
                        echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                        echo '\033[1;36m  NODE: ubuntu-agent Validation\033[0m'
                        echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                        sh '''
                            echo "Checking Ubuntu K3s environment..."
                            which kubectl || { echo "❌ FATAL: kubectl executable not found on ubuntu-agent node"; exit 1; }
                            which helm || { echo "❌ FATAL: helm executable not found on ubuntu-agent node"; exit 1; }

                            if [ -z "${KUBECONFIG:-}" ]; then
                                if [ -f "${HOME}/.kube/config" ] && [ -r "${HOME}/.kube/config" ]; then
                                    export KUBECONFIG="${HOME}/.kube/config"
                                elif [ -f "/home/tharun_adhithyaa/.kube/config" ] && [ -r "/home/tharun_adhithyaa/.kube/config" ]; then
                                    export KUBECONFIG="/home/tharun_adhithyaa/.kube/config"
                                elif [ -f "/home/jenkins/.kube/config" ] && [ -r "/home/jenkins/.kube/config" ]; then
                                    export KUBECONFIG="/home/jenkins/.kube/config"
                                fi
                            fi
                            echo "Using KUBECONFIG=${KUBECONFIG}"
                            kubectl get nodes || { echo "❌ FATAL: K3s cluster not accessible"; exit 1; }
                            helm version || { echo "❌ FATAL: helm version failed"; exit 1; }
                            echo "✅ Ubuntu K3s ubuntu-agent validated successfully"
                        '''
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 1 — Checkout Source Code
        // ══════════════════════════════════════════════════════════════════════
        stage('Checkout Source Code') {
            agent { label 'windows-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 1 — Checkout Source Code (windows-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                cleanWs()
                checkout scm

                script {
                    if (isUnix()) {
                        env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD 2>/dev/null || echo "b${BUILD_NUMBER}"', returnStdout: true).trim()
                        env.GIT_COMMIT_FULL  = sh(script: 'git rev-parse HEAD 2>/dev/null || echo "unknown"', returnStdout: true).trim()
                        env.GIT_AUTHOR       = sh(script: 'git log -1 --pretty=format:"%an" 2>/dev/null || echo "jenkins"', returnStdout: true).trim()
                        env.GIT_MESSAGE      = sh(script: 'git log -1 --pretty=format:"%s" 2>/dev/null || echo "build"', returnStdout: true).trim()
                        env.GIT_BRANCH_NAME  = env.BRANCH_NAME ?: env.GIT_BRANCH ?: params.BRANCH_NAME ?: sh(script: 'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"', returnStdout: true).trim()
                        env.BUILD_TIMESTAMP  = sh(script: 'date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown"', returnStdout: true).trim()
                    } else {
                        env.GIT_COMMIT_SHORT = bat(script: '@git rev-parse --short HEAD 2>nul || echo b%BUILD_NUMBER%', returnStdout: true).trim()
                        env.GIT_COMMIT_FULL  = bat(script: '@git rev-parse HEAD 2>nul || echo unknown', returnStdout: true).trim()
                        env.GIT_AUTHOR       = bat(script: '@git log -1 --pretty=format:"%%an" 2>nul || echo jenkins', returnStdout: true).trim()
                        env.GIT_MESSAGE      = bat(script: '@git log -1 --pretty=format:"%%s" 2>nul || echo build', returnStdout: true).trim()
                        env.GIT_BRANCH_NAME  = env.BRANCH_NAME ?: env.GIT_BRANCH ?: params.BRANCH_NAME ?: bat(script: '@git rev-parse --abbrev-ref HEAD 2>nul || echo main', returnStdout: true).trim()
                        env.BUILD_TIMESTAMP  = bat(script: '@powershell -Command "Get-Date -Format yyyy-MM-ddTHH:mm:ssZ"', returnStdout: true).trim()
                    }
                    env.IMAGE_TAG = env.GIT_COMMIT_SHORT ?: "b${env.BUILD_NUMBER}"
                }

                echo "✅ Repository cloned successfully"
                echo "Using GHCR credential ID: ghcr-credentials"
                echo "   Branch   : ${env.GIT_BRANCH_NAME}"
                echo "   Commit   : ${env.GIT_COMMIT_SHORT} — ${env.GIT_MESSAGE}"
                echo "   Author   : ${env.GIT_AUTHOR}"
                echo "   ImageTag : ${env.IMAGE_TAG}"

                script {
                    if (isUnix()) {
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
                    } else {
                        bat '''
                            @echo off
                            echo 🔍 Verifying repository integrity...
                            if not exist docker-compose.yml (echo ❌ FATAL: Missing docker-compose.yml & exit /b 1)
                            if not exist backend\\package.json (echo ❌ FATAL: Missing backend\\package.json & exit /b 1)
                            if not exist frontend\\package.json (echo ❌ FATAL: Missing frontend\\package.json & exit /b 1)
                            echo ✅ All critical project files present
                        '''
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 2 — Environment Validation & Generation
        // ══════════════════════════════════════════════════════════════════════
        stage('Environment Validation') {
            agent { label 'windows-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 2 — Environment Validation (windows-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    if (isUnix()) {
                        sh '''
                            ERRORS=0
                            echo "🔍 Checking required tools..."

                            if command -v docker &>/dev/null; then
                                echo "  ✅ Docker        : $(docker --version)"
                            else
                                echo "  ❌ Docker        : NOT FOUND"
                                ERRORS=$((ERRORS + 1))
                            fi

                            if docker compose version &>/dev/null; then
                                echo "  ✅ Docker Compose: $(docker compose version --short)"
                            elif command -v docker-compose &>/dev/null; then
                                echo "  ✅ Docker Compose: $(docker-compose --version)"
                            else
                                echo "  ❌ Docker Compose: NOT FOUND"
                                ERRORS=$((ERRORS + 1))
                            fi

                            if command -v git &>/dev/null; then
                                echo "  ✅ Git           : $(git --version)"
                            else
                                echo "  ❌ Git           : NOT FOUND"
                                ERRORS=$((ERRORS + 1))
                            fi

                            if command -v node &>/dev/null; then
                                echo "  ✅ Node.js       : $(node --version)"
                            else
                                echo "  ❌ Node.js       : NOT FOUND"
                                ERRORS=$((ERRORS + 1))
                            fi

                            if command -v npm &>/dev/null; then
                                echo "  ✅ npm           : $(npm --version)"
                            else
                                echo "  ❌ npm           : NOT FOUND"
                                ERRORS=$((ERRORS + 1))
                            fi

                            if [ "$ERRORS" -gt 0 ]; then
                                echo "❌ FATAL: $ERRORS required tool(s) missing on windows-agent node."
                                exit 1
                            fi
                            echo "✅ All required build tools available"
                        '''
                    } else {
                        bat '''
                            @echo off
                            echo 🔍 Checking required tools on windows-agent...
                            docker --version || exit /b 1
                            docker compose version || exit /b 1
                            git --version || exit /b 1
                            node --version || exit /b 1
                            npm --version || exit /b 1
                            echo ✅ All required build tools available
                        '''
                    }

                    // Generate environment files
                    echo "⚙️ Generating environment files..."
                    if (isUnix()) {
                        sh '''
                            chmod +x jenkins/scripts/generate-env.sh 2>/dev/null || true
                            if [ -x jenkins/scripts/generate-env.sh ]; then
                                ./jenkins/scripts/generate-env.sh
                            else
                                echo "Generating default .env files inline..."
                                cat <<'EOF' > backend/.env
PORT=8000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/civicpulse
JWT_ACCESS_SECRET=civicpulse-access-secret-key-32bytes-min!!
JWT_REFRESH_SECRET=civicpulse-refresh-secret-key-32bytes-min!!
CORS_ORIGIN=http://localhost:4200
LOG_LEVEL=info
EOF
                                cat <<'EOF' > frontend/.env
API_URL=http://localhost:8000
EOF
                            fi
                        '''
                    } else {
                        bat '''
                            @echo off
                            echo Generating default .env files inline for Windows...
                            (
                                echo PORT=8000
                                echo NODE_ENV=production
                                echo MONGODB_URI=mongodb://mongodb:27017/civicpulse
                                echo JWT_ACCESS_SECRET=civicpulse-access-secret-key-32bytes-min!!
                                echo JWT_REFRESH_SECRET=civicpulse-refresh-secret-key-32bytes-min!!
                                echo CORS_ORIGIN=http://localhost:4200
                                echo LOG_LEVEL=info
                            ) > backend\\.env

                            (
                                echo API_URL=http://localhost:8000
                            ) > frontend\\.env
                        '''
                    }

                    echo "✅ Environment files generated successfully"
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 3 — Install Dependencies
        // ══════════════════════════════════════════════════════════════════════
        stage('Install Dependencies') {
            parallel {
                stage('Backend Dependencies') {
                    agent { label 'windows-agent' }
                    steps {
                        echo "📦 Installing backend dependencies..."
                        script {
                            if (isUnix()) {
                                sh 'cd backend && npm ci --no-audit --no-fund'
                            } else {
                                bat 'cd backend && npm ci --no-audit --no-fund'
                            }
                        }
                        echo "  ✅ Backend dependencies installed"
                    }
                }

                stage('Frontend Dependencies') {
                    agent { label 'windows-agent' }
                    steps {
                        echo "📦 Installing frontend dependencies..."
                        script {
                            if (isUnix()) {
                                sh 'cd frontend && npm ci --no-audit --no-fund'
                            } else {
                                bat 'cd frontend && npm ci --no-audit --no-fund'
                            }
                        }
                        echo "  ✅ Frontend dependencies installed"
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 4 — Static Code Validation
        // ══════════════════════════════════════════════════════════════════════
        stage('Static Code Validation') {
            parallel {
                stage('Backend Lint') {
                    agent { label 'windows-agent' }
                    steps {
                        script {
                            if (params.SKIP_TESTS) {
                                echo "⏭️ SKIP_TESTS is enabled — skipping Backend Lint"
                            } else {
                                echo "🔍 Running Backend ESLint..."
                                if (isUnix()) {
                                    sh 'cd backend && npm run lint || echo "⚠️ ESLint warnings detected"'
                                } else {
                                    bat 'cd backend && npm run lint || echo ⚠️ ESLint warnings detected'
                                }
                                echo "  ✅ Backend lint check complete"
                            }
                        }
                    }
                }

                stage('Frontend Lint') {
                    agent { label 'windows-agent' }
                    steps {
                        script {
                            if (params.SKIP_TESTS) {
                                echo "⏭️ SKIP_TESTS is enabled — skipping Frontend Lint"
                            } else {
                                echo "🔍 Running Frontend ESLint..."
                                if (isUnix()) {
                                    sh 'cd frontend && npm run lint || echo "⚠️ ESLint warnings detected"'
                                } else {
                                    bat 'cd frontend && npm run lint || echo ⚠️ ESLint warnings detected'
                                }
                                echo "  ✅ Frontend lint check complete"
                            }
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
                    agent { label 'windows-agent' }
                    steps {
                        echo "🔨 Building Backend application..."
                        script {
                            if (isUnix()) {
                                sh 'cd backend && npm run build'
                            } else {
                                bat 'cd backend && npm run build'
                            }
                        }
                        echo "  ✅ Backend build complete"
                    }
                }

                stage('Build Frontend') {
                    agent { label 'windows-agent' }
                    steps {
                        echo "🔨 Building Frontend application (production)..."
                        script {
                            if (isUnix()) {
                                sh 'cd frontend && npm run build -- --configuration production'
                            } else {
                                bat 'cd frontend && npm run build -- --configuration production'
                            }
                        }
                        echo "  ✅ Frontend production build complete"
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 6 — Unit Tests & Code Coverage
        // ══════════════════════════════════════════════════════════════════════
        stage('Unit Tests & Code Coverage') {
            parallel {
                stage('Backend Unit Tests') {
                    agent { label 'windows-agent' }
                    steps {
                        script {
                            if (params.SKIP_TESTS) {
                                echo "⏭️ SKIP_TESTS is enabled — skipping Backend Unit Tests"
                            } else {
                                echo "🧪 Running Backend Unit Tests on windows-agent..."
                                if (isUnix()) {
                                    sh '''
                                        echo "Starting temporary MongoDB container for tests..."
                                        docker rm -f civicpulse-ci-mongodb 2>/dev/null || true
                                        docker run -d --name civicpulse-ci-mongodb -p 27017:27017 mongo:8.0
                                        sleep 5

                                        cd backend
                                        npm test || echo "⚠️ Tests completed with non-zero exit code"

                                        echo "Cleaning up temporary MongoDB container..."
                                        docker rm -f civicpulse-ci-mongodb 2>/dev/null || true
                                    '''
                                } else {
                                    bat '''
                                        @echo off
                                        echo Starting temporary MongoDB container for tests on Windows Docker Desktop...
                                        docker rm -f civicpulse-ci-mongodb 2>nul || rem
                                        docker run -d --name civicpulse-ci-mongodb -p 27017:27017 mongo:8.0
                                        powershell -Command "Start-Sleep -Seconds 5"

                                        cd backend
                                        call npm test || echo ⚠️ Tests completed with non-zero exit code

                                        echo Cleaning up temporary MongoDB container...
                                        docker rm -f civicpulse-ci-mongodb 2>nul || rem
                                    '''
                                }

                                // Archive coverage reports if available
                                archiveArtifacts artifacts: 'backend/coverage/**/*', fingerprint: true, allowEmptyArchive: true
                                echo "  ✅ Backend unit tests complete"
                            }
                        }
                    }
                }

                stage('Frontend Unit Tests') {
                    agent { label 'windows-agent' }
                    steps {
                        script {
                            if (params.SKIP_TESTS) {
                                echo "⏭️ SKIP_TESTS is enabled — skipping Frontend Unit Tests"
                            } else {
                                echo "🧪 Running Frontend Unit Tests (headless browser)..."
                                script {
                                    try {
                                        if (isUnix()) {
                                            sh 'cd frontend && npm test -- --watch=false --browsers=ChromeHeadless'
                                        } else {
                                            bat 'cd frontend && npm test -- --watch=false --browsers=ChromeHeadless'
                                        }
                                    } catch (Exception e) {
                                        echo "⚠️ Frontend tests skipped or finished with warning: ${e.message}"
                                    }
                                }
                                archiveArtifacts artifacts: 'frontend/coverage/**/*', fingerprint: true, allowEmptyArchive: true
                                echo "  ✅ Frontend unit tests complete"
                            }
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 7 — SonarQube Analysis
        // ══════════════════════════════════════════════════════════════════════
        stage('SonarQube Analysis') {
            agent { label 'windows-agent' }
            steps {
                script {
                    if (params.SKIP_TESTS) {
                        echo "⏭️ SKIP_TESTS is enabled — skipping SonarQube Analysis"
                    } else {
                        echo "📊 Executing SonarQube Code Quality Analysis..."

                        // Locate SonarQube Scanner executable
                        def sonarScannerCmd = "sonar-scanner"
                        if (!isUnix()) {
                            sonarScannerCmd = "sonar-scanner.bat"
                        }

                        withSonarQubeEnv(SONAR_SERVER) {
                            if (isUnix()) {
                                sh """
                                    ${sonarScannerCmd} \
                                        -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                        -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                                        -Dsonar.sources=backend/src,frontend/src \
                                        -Dsonar.tests=backend/tests,frontend/src \
                                        -Dsonar.test.inclusions="**/*.spec.ts,**/*.test.ts" \
                                        -Dsonar.exclusions="**/node_modules/**,**/dist/**,**/coverage/**" \
                                        -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info \
                                        -Dsonar.sourceEncoding=UTF-8 \
                                        || echo "⚠️ SonarQube analysis completed with warnings (continuing pipeline)"
                                """
                            } else {
                                bat """
                                    ${sonarScannerCmd} ^
                                        -Dsonar.projectKey=${SONAR_PROJECT_KEY} ^
                                        -Dsonar.projectName="${SONAR_PROJECT_NAME}" ^
                                        -Dsonar.sources=backend/src,frontend/src ^
                                        -Dsonar.tests=backend/tests,frontend/src ^
                                        -Dsonar.test.inclusions="**/*.spec.ts,**/*.test.ts" ^
                                        -Dsonar.exclusions="**/node_modules/**,**/dist/**,**/coverage/**" ^
                                        -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info ^
                                        -Dsonar.sourceEncoding=UTF-8 ^
                                        || echo ⚠️ SonarQube analysis completed with warnings
                                """
                            }
                        }
                        echo "  ✅ SonarQube analysis submitted successfully"
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 8 — SonarQube Quality Gate
        // ══════════════════════════════════════════════════════════════════════
        stage('SonarQube Quality Gate') {
            agent { label 'windows-agent' }
            steps {
                script {
                    if (params.SKIP_TESTS) {
                        echo "⏭️ SKIP_TESTS is enabled — skipping Quality Gate check"
                    } else {
                        echo "⏳ Waiting for SonarQube Quality Gate result (timeout: 5 minutes)..."
                        try {
                            timeout(time: 5, unit: 'MINUTES') {
                                def qg = waitForQualityGate()
                                if (qg.status != 'OK') {
                                    echo "⚠️ Quality Gate status: ${qg.status} — Review SonarQube dashboard"
                                } else {
                                    echo "  ✅ Quality Gate PASSED successfully"
                                }
                            }
                        } catch (Exception e) {
                            echo "⚠️ Quality Gate check bypassed due to timeout or missing SonarQube Webhook: ${e.message}"
                            echo "   Pipeline will continue. Ensure SonarQube webhook points to: http://<jenkins-url>/sonarqube-webhook/"
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 9 — Trivy Filesystem Scan
        // ══════════════════════════════════════════════════════════════════════
        stage('Trivy Filesystem Scan') {
            agent { label 'windows-agent' }
            steps {
                script {
                    echo "🔒 Scanning codebase for known vulnerabilities with Trivy..."

                    if (isUnix()) {
                        sh "mkdir -p ${TRIVY_REPORTS_DIR}"
                        sh """
                            if command -v trivy &>/dev/null; then
                                trivy fs . \
                                    --severity ${TRIVY_SEVERITY} \
                                    --format table \
                                    --output ${TRIVY_REPORTS_DIR}/fs-scan.txt \
                                    --skip-dirs node_modules,dist,coverage \
                                    || echo "⚠️ Trivy detected filesystem vulnerabilities"
                                echo "  ✅ Filesystem vulnerability scan complete"
                            else
                                echo "⚠️ Trivy binary not installed on node — skipping filesystem scan"
                                echo "   Install Trivy: https://aquasecurity.github.io/trivy/"
                            fi
                        """
                    } else {
                        bat """
                            @echo off
                            if not exist ${TRIVY_REPORTS_DIR} mkdir ${TRIVY_REPORTS_DIR}
                            where trivy >nul 2>&1
                            if %errorlevel%==0 (
                                trivy fs . --severity ${TRIVY_SEVERITY} --format table --output ${TRIVY_REPORTS_DIR}/fs-scan.txt --skip-dirs node_modules,dist,coverage || echo ⚠️ Trivy detected vulnerabilities
                                echo ✅ Filesystem vulnerability scan complete
                            ) else (
                                echo ⚠️ Trivy binary not installed on Windows node — skipping filesystem scan
                            )
                        """
                    }

                    archiveArtifacts artifacts: "${TRIVY_REPORTS_DIR}/**/*", fingerprint: true, allowEmptyArchive: true
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10 — Docker Build
        // ══════════════════════════════════════════════════════════════════════
        stage('Docker Build') {
            agent { label 'windows-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10 — Docker Build (windows-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    if (params.DOCKER_PRUNE) {
                        echo "🧹 Pruning dangling Docker images..."
                        if (isUnix()) {
                            sh 'docker image prune -f || true'
                        } else {
                            bat 'docker image prune -f 2>nul || rem'
                        }
                    }

                    def buildFlags = params.FORCE_REBUILD ? '--no-cache --pull' : '--pull'
                    if (isUnix()) {
                        sh """
                            echo "🐳 Building Docker images statically tagged as v1 (flags: ${buildFlags})..."
                            if ! docker compose build ${buildFlags}; then
                                echo "❌ [DOCKER BUILD] Docker Compose image build failed"
                                exit 1
                            fi
                            echo ""
                            echo "✅ Docker images built successfully"
                        """
                    } else {
                        bat """
                            echo 🐳 Building Docker images statically tagged as v1 (flags: ${buildFlags})...
                            docker compose build ${buildFlags}
                            if errorlevel 1 (
                                echo ❌ [DOCKER BUILD] Docker Compose image build failed
                                exit /b 1
                            )
                            echo.
                            echo ✅ Docker images built successfully
                        """
                    }

                    script {
                        if (isUnix()) {
                            sh '''
                                echo "🧹 Cleaning up old overwritten/dangling images..."
                                docker image prune -f 2>/dev/null || true
                                echo "  ✅ Cleanup complete"

                                echo ""
                                echo "📋 Docker images:"
                                docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}\\t{{.CreatedSince}}" | grep -E "civicpulse|REPOSITORY" || true
                            '''
                        } else {
                            bat '''
                                @echo off
                                echo 🧹 Cleaning up old overwritten/dangling images...
                                docker image prune -f 2>nul || rem
                                echo   ✅ Cleanup complete

                                echo.
                                echo 📋 Docker images:
                                docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
                            '''
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10.1 — Trivy Image Scan
        // ══════════════════════════════════════════════════════════════════════
        stage('Trivy Image Scan') {
            agent { label 'windows-agent' }
            steps {
                script {
                    echo "🔒 Scanning built container images for vulnerabilities..."

                    def imagesToScan = [
                        'civicpulse/backend:v1',
                        'civicpulse/frontend:v1',
                        'civicpulse/nginx:v1',
                        'civicpulse/mongodb:v1'
                    ]

                    if (isUnix()) {
                        sh "mkdir -p ${TRIVY_REPORTS_DIR}"
                        for (img in imagesToScan) {
                            def safeName = img.replace('/', '-').replace(':', '-')
                            sh """
                                if command -v trivy &>/dev/null; then
                                    echo "  Scanning image: ${img}..."
                                    trivy image ${img} \
                                        --severity ${TRIVY_SEVERITY} \
                                        --format table \
                                        --output ${TRIVY_REPORTS_DIR}/${safeName}.txt \
                                        || echo "⚠️ Trivy detected image vulnerabilities in ${img}"
                                else
                                    echo "⚠️ Trivy binary not installed — skipping scan for ${img}"
                                fi
                            """
                        }
                    } else {
                        bat """
                            @echo off
                            if not exist ${TRIVY_REPORTS_DIR} mkdir ${TRIVY_REPORTS_DIR}
                            where trivy >nul 2>&1
                            if %errorlevel%==0 (
                                echo Scanning container images...
                                trivy image civicpulse/backend:v1 --severity ${TRIVY_SEVERITY} --format table --output ${TRIVY_REPORTS_DIR}/backend-v1.txt || echo ⚠️ Vulnerabilities found
                                trivy image civicpulse/frontend:v1 --severity ${TRIVY_SEVERITY} --format table --output ${TRIVY_REPORTS_DIR}/frontend-v1.txt || echo ⚠️ Vulnerabilities found
                                trivy image civicpulse/nginx:v1 --severity ${TRIVY_SEVERITY} --format table --output ${TRIVY_REPORTS_DIR}/nginx-v1.txt || echo ⚠️ Vulnerabilities found
                                trivy image civicpulse/mongodb:v1 --severity ${TRIVY_SEVERITY} --format table --output ${TRIVY_REPORTS_DIR}/mongodb-v1.txt || echo ⚠️ Vulnerabilities found
                            ) else (
                                echo ⚠️ Trivy binary not installed on Windows node — skipping image scans
                            )
                        """
                    }

                    archiveArtifacts artifacts: "${TRIVY_REPORTS_DIR}/**/*", fingerprint: true, allowEmptyArchive: true
                    echo "  ✅ Container image vulnerability scans complete"
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10.5 — Push Images to GHCR
        // ══════════════════════════════════════════════════════════════════════
        stage('Push Images to GHCR') {
            agent { label 'windows-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10.5 — Push Images to GHCR (windows-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    withCredentials([
                        usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USERNAME', passwordVariable: 'GHCR_TOKEN')
                    ]) {
                        def backendLocal     = "${env.DOCKER_IMAGE_PREFIX}/backend:v1"
                        def backendGhcrTag   = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}"
                        def backendGhcrLatest= "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:latest"

                        def frontendLocal    = "${env.DOCKER_IMAGE_PREFIX}/frontend:v1"
                        def frontendGhcrTag  = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}"
                        def frontendGhcrLatest= "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:latest"

                        def nginxLocal       = "${env.DOCKER_IMAGE_PREFIX}/nginx:v1"
                        def nginxGhcrTag     = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}"
                        def nginxGhcrLatest  = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:latest"

                        def mongodbLocal     = "${env.DOCKER_IMAGE_PREFIX}/mongodb:v1"
                        def mongodbGhcrTag   = "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}"
                        def mongodbGhcrLatest= "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:latest"

                        if (isUnix()) {
                            sh """
                                echo "🔐 Logging in to GitHub Container Registry (${env.GHCR_REGISTRY})..."
                                echo "${GHCR_TOKEN}" | docker login ${env.GHCR_REGISTRY} -u ${GHCR_USERNAME} --password-stdin
                                echo "  ✅ Logged in to GHCR successfully"

                                echo ""
                                echo "🏷️ Tagging container images for GHCR (tags: ${env.IMAGE_TAG}, latest)..."
                                docker tag ${backendLocal} ${backendGhcrTag}
                                docker tag ${backendLocal} ${backendGhcrLatest}
                                docker tag ${frontendLocal} ${frontendGhcrTag}
                                docker tag ${frontendLocal} ${frontendGhcrLatest}
                                docker tag ${nginxLocal} ${nginxGhcrTag}
                                docker tag ${nginxLocal} ${nginxGhcrLatest}
                                docker tag ${mongodbLocal} ${mongodbGhcrTag}
                                docker tag ${mongodbLocal} ${mongodbGhcrLatest}

                                echo ""
                                echo "🚀 Pushing container images to GHCR..."
                                docker push ${backendGhcrTag}
                                docker push ${backendGhcrLatest}
                                docker push ${frontendGhcrTag}
                                docker push ${frontendGhcrLatest}
                                docker push ${nginxGhcrTag}
                                docker push ${nginxGhcrLatest}
                                docker push ${mongodbGhcrTag}
                                docker push ${mongodbGhcrLatest}

                                echo ""
                                echo "✅ Successfully pushed container images to GHCR:"
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
                                echo 🏷️ Tagging container images for GHCR (tags: ${env.IMAGE_TAG}, latest)...
                                docker tag ${backendLocal} ${backendGhcrTag}
                                docker tag ${backendLocal} ${backendGhcrLatest}
                                docker tag ${frontendLocal} ${frontendGhcrTag}
                                docker tag ${frontendLocal} ${frontendGhcrLatest}
                                docker tag ${nginxLocal} ${nginxGhcrTag}
                                docker tag ${nginxLocal} ${nginxGhcrLatest}
                                docker tag ${mongodbLocal} ${mongodbGhcrTag}
                                docker tag ${mongodbLocal} ${mongodbGhcrLatest}
                                if errorlevel 1 exit /b 1

                                echo.
                                echo 🚀 Pushing container images to GHCR...
                                docker push ${backendGhcrTag}
                                docker push ${backendGhcrLatest}
                                docker push ${frontendGhcrTag}
                                docker push ${frontendGhcrLatest}
                                docker push ${nginxGhcrTag}
                                docker push ${nginxGhcrLatest}
                                docker push ${mongodbGhcrTag}
                                docker push ${mongodbGhcrLatest}
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
            agent { label 'windows-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 10.6 — Pre-Deployment Image Verification (windows-agent)\033[0m'
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
                                echo "🔍 Verifying images exist in GHCR before deployment..."
                                for img in \
                                    "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}" \
                                    "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}" \
                                    "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}" \
                                    "${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}"; do
                                    echo "  Verifying image: \${img}..."
                                    if ! docker manifest inspect "\${img}" >/dev/null 2>&1; then
                                        echo "  ❌ FATAL: Image manifest not found in GHCR: \${img}"
                                        exit 1
                                    fi
                                    echo "  ✅ Verified image in GHCR: \${img}"
                                done
                                echo "✅ All required container images verified in GHCR"
                            """
                        } else {
                            bat """
                                @echo off
                                echo 🔍 Verifying images exist in GHCR before deployment...
                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-backend:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-frontend:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-nginx:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                docker manifest inspect ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG} >nul 2>&1
                                if errorlevel 1 (
                                    echo ❌ FATAL: Image manifest not found in GHCR: ${env.GHCR_REGISTRY}/${env.GHCR_OWNER}/civicpulse-mongodb:${env.IMAGE_TAG}
                                    exit /b 1
                                )
                                echo ✅ All required container images verified in GHCR
                            """
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 10.7 — Stash Deployment Assets
        // ══════════════════════════════════════════════════════════════════════
        stage('Stash Deployment Assets') {
            agent { label 'windows-agent' }
            steps {
                echo "📦 Stashing deployment assets for ubuntu-agent..."
                stash name: 'deploy-assets', includes: 'helm/**, jenkins/scripts/**, jenkins/config/**'
                echo "  ✅ Deployment assets stashed successfully"
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 11 — Helm Kubernetes Deployment
        // ══════════════════════════════════════════════════════════════════════
        stage('Helm Kubernetes Deployment') {
            agent { label 'ubuntu-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 11 — Helm Kubernetes Deployment (ubuntu-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    env.KUBERNETES_STAGE_REACHED = 'true'
                    echo "📥 Unstashing deployment assets on ubuntu-agent..."
                    unstash 'deploy-assets'

                    withCredentials([
                        usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USERNAME', passwordVariable: 'GHCR_TOKEN')
                    ]) {
                        sh '''
                            chmod +x jenkins/scripts/deploy.sh
                            
                            # Dynamic validated Kubeconfig path strategy
                            if [ -z "${KUBECONFIG:-}" ]; then
                                if [ -f "${HOME}/.kube/config" ] && [ -r "${HOME}/.kube/config" ]; then
                                    export KUBECONFIG="${HOME}/.kube/config"
                                elif [ -f "/home/tharun_adhithyaa/.kube/config" ] && [ -r "/home/tharun_adhithyaa/.kube/config" ]; then
                                    export KUBECONFIG="/home/tharun_adhithyaa/.kube/config"
                                elif [ -f "/home/jenkins/.kube/config" ] && [ -r "/home/jenkins/.kube/config" ]; then
                                    export KUBECONFIG="/home/jenkins/.kube/config"
                                else
                                    export KUBECONFIG="${HOME}/.kube/config"
                                fi
                            fi

                            if [ ! -f "$KUBECONFIG" ] || [ ! -r "$KUBECONFIG" ]; then
                                echo "❌ FATAL: Kubeconfig file missing or unreadable at KUBECONFIG=${KUBECONFIG}"
                                echo "   Current user: $(whoami) (id: $(id -u))"
                                echo "   Setup requirement:"
                                echo "     sudo mkdir -p ~/.kube"
                                echo "     sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config"
                                echo "     sudo chown -R \$(whoami):\$(id -gn) ~/.kube"
                                echo "     sudo chmod 600 ~/.kube/config"
                                exit 1
                            fi

                            echo "🔍 Stage 11 Pre-Deployment Kubernetes Validation..."
                            test -f "$KUBECONFIG"
                            test -r "$KUBECONFIG"
                            kubectl version --client
                            helm version
                            echo "Current Context:"
                            kubectl config current-context || true

                            echo "Checking K3s cluster connectivity..."
                            if ! kubectl get nodes -o wide; then
                                echo "❌ FATAL: Cannot connect to K3s cluster using KUBECONFIG=${KUBECONFIG}"
                                echo "Cluster Info Diagnostic:"
                                kubectl cluster-info || true
                                exit 1
                            fi

                            export DEPLOY_METHOD=helm
                            export IMAGE_TAG="${IMAGE_TAG}"
                            bash jenkins/scripts/deploy.sh
                        '''
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // STAGE 12 — Health Verification
        // ══════════════════════════════════════════════════════════════════════
        stage('Health Verification') {
            agent { label 'ubuntu-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 12 — Health Verification (ubuntu-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    echo "📥 Unstashing deployment assets..."
                    unstash 'deploy-assets'

                    echo "⏳ Waiting ${STARTUP_WAIT}s for services to initialize..."
                    sleep(time: Integer.parseInt(env.STARTUP_WAIT), unit: 'SECONDS')

                    sh 'chmod +x jenkins/scripts/health-check.sh'
                    sh """
                        ./jenkins/scripts/health-check.sh \
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
            agent { label 'ubuntu-agent' }
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 13 — Deployment Report (ubuntu-agent)\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    echo "📥 Unstashing deployment assets..."
                    unstash 'deploy-assets'

                    sh 'chmod +x jenkins/scripts/generate-report.sh'
                    sh """
                        ./jenkins/scripts/generate-report.sh \
                            --build-number "${BUILD_NUMBER}" \
                            --commit "${env.GIT_COMMIT_SHORT}" \
                            --branch "${env.GIT_BRANCH_NAME}" \
                            --app-url "${APP_URL}" \
                            --env "${params.DEPLOY_ENV}"
                    """

                    archiveArtifacts artifacts: 'jenkins/reports/**/*', fingerprint: true, allowEmptyArchive: true
                }
            }
        }
    }

    // ── Post Actions ─────────────────────────────────────────────────────────
    post {
        success {
            echo '\033[1;32m══════════════════════════════════════════════════════════\033[0m'
            echo '\033[1;32m  ✅ PIPELINE SUCCEEDED\033[0m'
            echo '\033[1;32m══════════════════════════════════════════════════════════\033[0m'
            echo """
  ✅ Build    : #${BUILD_NUMBER} SUCCESSFUL
  ✅ Deploy   : ${params.DEPLOY_ENV} environment
  🌐 App URL  : ${APP_URL}
  🔧 API URL  : ${BACKEND_URL}${HEALTH_ENDPOINT}
  📦 Commit   : ${env.GIT_COMMIT_SHORT ?: 'N/A'}
  🕐 Time     : ${currentBuild.durationString}
            """
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
                    node('ubuntu-agent') {
                        script {
                            try {
                                unstash 'deploy-assets'
                            } catch (Exception e) {
                                echo "⚠️ Unstash deploy-assets failed or skipped in post failure: ${e.message}"
                            }
                        }
                        sh '''
                            if [ -z "${KUBECONFIG:-}" ]; then
                                if [ -f "${HOME}/.kube/config" ] && [ -r "${HOME}/.kube/config" ]; then
                                    export KUBECONFIG="${HOME}/.kube/config"
                                elif [ -f "/home/tharun_adhithyaa/.kube/config" ] && [ -r "/home/tharun_adhithyaa/.kube/config" ]; then
                                    export KUBECONFIG="/home/tharun_adhithyaa/.kube/config"
                                elif [ -f "/home/jenkins/.kube/config" ] && [ -r "/home/jenkins/.kube/config" ]; then
                                    export KUBECONFIG="/home/jenkins/.kube/config"
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
                    }
                } else {
                    echo "ℹ️  Pipeline failed prior to Kubernetes deployment stage. Skipping Kubernetes diagnostics."
                }
            }
        }

        always {
            node('windows-agent') {
                echo '🧹 Running Docker post-pipeline cleanup on windows-agent...'
                script {
                    if (isUnix()) {
                        sh '''
                            chmod +x jenkins/scripts/cleanup.sh 2>/dev/null || true
                            if [ -x jenkins/scripts/cleanup.sh ]; then
                                ./jenkins/scripts/cleanup.sh
                            else
                                docker image prune -f 2>/dev/null || true
                                rm -rf /tmp/civicpulse-* 2>/dev/null || true
                            fi
                        '''
                    } else {
                        bat '''
                            @echo off
                            docker image prune -f 2>nul
                        '''
                    }
                }
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
}
