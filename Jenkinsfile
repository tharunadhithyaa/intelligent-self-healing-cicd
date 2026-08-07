// ============================================================================
// CivicPulseAI — Declarative Jenkins CI/CD Pipeline
// ============================================================================
// Automates: Checkout → Validate → Install → Lint → Build → SonarQube Scan
//            → Quality Gate →Trivy FS Scan →Docker Build →Trivy Image Scan → Deploy → Health Check → Report
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
        // STAGE 1 — Checkout Source Code
        // ══════════════════════════════════════════════════════════════════════
        stage('Checkout Source Code') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 1 — Checkout Source Code\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                // Clean workspace before checkout
                cleanWs()

                // Checkout from SCM (configured in Jenkins job)
                checkout scm

                // Display commit information for traceability
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.GIT_COMMIT_FULL  = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.GIT_AUTHOR       = sh(script: 'git log -1 --pretty=format:"%an"', returnStdout: true).trim()
                    env.GIT_MESSAGE      = sh(script: 'git log -1 --pretty=format:"%s"', returnStdout: true).trim()
                    env.GIT_BRANCH_NAME  = env.BRANCH_NAME ?: env.GIT_BRANCH ?: params.BRANCH_NAME ?: sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
                    env.BUILD_TIMESTAMP  = sh(script: 'date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown"', returnStdout: true).trim()
                }

                echo "✅ Repository cloned successfully"
                echo "   Branch : ${env.GIT_BRANCH_NAME}"
                echo "   Commit : ${env.GIT_COMMIT_SHORT} — ${env.GIT_MESSAGE}"
                echo "   Author : ${env.GIT_AUTHOR}"

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
                    // Create Trivy reports directory (OS agnostic)
                    if (isUnix()) {
                        sh 'mkdir -p jenkins/reports/trivy'
                    } else {
                        bat 'if not exist jenkins\\reports\\trivy mkdir jenkins\\reports\\trivy'
                    }

                    echo '🔎 Running Trivy filesystem vulnerability scan...'

                    if (isUnix()) {
                        // Generate JSON, SARIF, and HTML reports for filesystem scan
                        sh '''
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-fs-report.json . || true
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-fs-report.sarif . || true
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-fs-report.html . || true
                        '''
                        // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                        sh "trivy fs --severity ${env.TRIVY_SEVERITY ?: 'HIGH,CRITICAL'} --ignore-unfixed --ignorefile .trivyignore --exit-code 1 ."
                    } else {
                        // Windows agent execution
                        bat '''
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-fs-report.json . || exit 0
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-fs-report.sarif . || exit 0
                            trivy fs --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-fs-report.html . || exit 0
                        '''
                        // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                        bat "trivy fs --severity %TRIVY_SEVERITY% --ignore-unfixed --ignorefile .trivyignore --exit-code 1 ."
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

                    // Build Docker images (statically tagged as v1 in docker-compose.yml)
                    def buildFlags = params.FORCE_REBUILD ? '--no-cache --pull' : '--no-cache --pull'
                    sh """
                        echo "🐳 Building Docker images statically tagged as v1 (flags: ${buildFlags})..."
                        docker compose build ${buildFlags} 2>&1
                        echo ""
                        echo "✅ Docker images built successfully"
                    """

                    // Prune old overwritten build images immediately to free disk space
                    sh '''
                        echo "🧹 Cleaning up old overwritten/dangling images..."
                        docker image prune -f 2>/dev/null || true
                        echo "  ✅ Cleanup complete"
                    '''

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
                    // Container images generated by Docker Compose build
                    def imagesToScan = [
                        'civicpulse/backend:v1',
                        'civicpulse/frontend:v1',
                        'civicpulse/nginx:v1',
                        'civicpulse/mongodb:v1'
                    ]

                    imagesToScan.each { img ->
                        def cleanName = img.replace('/', '-').replace(':', '-')
                        echo "🛡️ Scanning image: ${img}..."

                        if (isUnix()) {
                            // Generate JSON, SARIF, and HTML reports for each container image
                            sh """
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-${cleanName}-report.json ${img} || true
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-${cleanName}-report.sarif ${img} || true
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format template --template "@jenkins/templates/html.tpl" --output jenkins/reports/trivy/trivy-${cleanName}-report.html ${img} || true
                            """
                            // Quality Gate enforcement: Fail pipeline if HIGH or CRITICAL vulnerabilities are found
                            sh "trivy image --severity ${env.TRIVY_SEVERITY ?: 'HIGH,CRITICAL'} --ignore-unfixed --ignorefile .trivyignore --exit-code 1 ${img}"
                        } else {
                            // Windows agent execution
                            bat """
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format json --output jenkins/reports/trivy/trivy-${cleanName}-report.json ${img} || exit 0
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format sarif --output jenkins/reports/trivy/trivy-${cleanName}-report.sarif ${img} || exit 0
                                trivy image --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore --format template --template "@contrib/html.tpl" --output jenkins/reports/trivy/trivy-${cleanName}-report.html ${img} || exit 0
                            """
                            bat "trivy image --severity %TRIVY_SEVERITY% --ignore-unfixed --ignorefile .trivyignore --exit-code 1 ${img}"
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
        // STAGE 11 — Deployment
        // ══════════════════════════════════════════════════════════════════════
        stage('Deployment') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 11 — Deployment\033[0m'
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'

                script {
                    // Make deployment script executable and run it
                    sh 'chmod +x jenkins/scripts/deploy.sh'
                    def exitCode = sh(script: './jenkins/scripts/deploy.sh', returnStatus: true)
                    if (exitCode != 0) {
                        echo "⚠️  First deployment attempt failed (exit code: ${exitCode}). Retrying..."
                        sleep(time: 10, unit: 'SECONDS')
                        sh './jenkins/scripts/deploy.sh'
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

                // Wait for containers to initialize
                echo "⏳ Waiting ${STARTUP_WAIT}s for services to initialize..."
                sleep(time: Integer.parseInt(env.STARTUP_WAIT), unit: 'SECONDS')

                // Run health checks
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

            // Dump container logs for debugging
            sh '''
                echo ""
                echo "════════════════════════════════════════"
                echo "  📋 Docker Container Logs (last 50 lines each)"
                echo "════════════════════════════════════════"
                for container in civicpulse-backend civicpulse-frontend civicpulse-mongodb civicpulse-nginx; do
                    echo ""
                    echo "── $container ──"
                    docker logs --tail 50 "$container" 2>&1 || echo "  (container not running)"
                done
            '''

            // Dump docker compose status
            sh '''
                echo ""
                echo "════════════════════════════════════════"
                echo "  📋 Docker Compose Status"
                echo "════════════════════════════════════════"
                docker compose ps 2>/dev/null || true
                echo ""
                docker compose logs --tail 20 2>/dev/null || true
            '''
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
