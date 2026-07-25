// ============================================================================
// CivicPulseAI — Declarative Jenkins CI/CD Pipeline
// ============================================================================
// Automates: Checkout → Validate → Install → Lint → Build → Docker → Deploy
//            → Health Check → Report
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
            description: 'Skip static code validation stage'
        )
        booleanParam(
            name: 'DOCKER_PRUNE',
            defaultValue: true,
            description: 'Prune dangling Docker resources before build'
        )
        booleanParam(
            name: 'FORCE_REBUILD',
            defaultValue: false,
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
        APP_URL             = 'http://localhost'
        BACKEND_URL         = 'http://localhost:8000'
        HEALTH_ENDPOINT     = '/api/health'
        NGINX_HEALTH        = '/health'

        // Health check tuning
        HEALTH_RETRIES      = '10'
        HEALTH_INTERVAL     = '15'
        STARTUP_WAIT        = '30'

        // Build metadata (auto-populated by Jenkins)
        BUILD_TIMESTAMP     = sh(script: 'date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown"', returnStdout: true).trim()
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
                    env.GIT_BRANCH_NAME  = sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
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
                    echo "🔍 Checking environment files..."
                    for envfile in backend/.env frontend/.env; do
                        if [ -f "$envfile" ]; then
                            echo "  ✅ $envfile"
                        else
                            echo "  ⚠️  $envfile — MISSING (deployment may fail)"
                        fi
                    done

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
        // STAGE 6 — Docker Build
        // ══════════════════════════════════════════════════════════════════════
        stage('Docker Build') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 6 — Docker Build\033[0m'
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

                    // Build Docker images
                    def buildFlags = params.FORCE_REBUILD ? '--no-cache --pull' : '--pull'
                    sh """
                        echo "🐳 Building Docker images (flags: ${buildFlags})..."
                        docker compose build ${buildFlags} 2>&1
                        echo ""
                        echo "✅ Docker images built successfully"
                    """

                    // Tag images with build number for versioning
                    def services = ['mongodb', 'backend', 'frontend', 'nginx']
                    def imageMap = [
                        'mongodb' : 'civicpulse/mongodb:v1',
                        'backend' : 'civicpulse/backend:v1',
                        'frontend': 'civicpulse/frontend-dev:v1',
                        'nginx'   : 'civicpulse/nginx'
                    ]
                    for (svc in services) {
                        def src = imageMap[svc]
                        def dest = "${DOCKER_IMAGE_PREFIX}/${svc}:build-${BUILD_NUMBER}"
                        sh """
                            docker tag ${src} ${dest} || echo "⚠️  Could not tag ${src} → ${dest}"
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
        // STAGE 7 — Deployment
        // ══════════════════════════════════════════════════════════════════════
        stage('Deployment') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 7 — Deployment\033[0m'
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
        // STAGE 8 — Health Verification
        // ══════════════════════════════════════════════════════════════════════
        stage('Health Verification') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 8 — Health Verification\033[0m'
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
        // STAGE 9 — Deployment Report
        // ══════════════════════════════════════════════════════════════════════
        stage('Deployment Report') {
            steps {
                echo '\033[1;36m══════════════════════════════════════════════════════════\033[0m'
                echo '\033[1;36m  STAGE 9 — Deployment Report\033[0m'
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
                # Prune dangling Docker images (silent failures)
                docker image prune -f 2>/dev/null || true

                # Remove any temporary files created during the pipeline
                rm -rf /tmp/civicpulse-* 2>/dev/null || true
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
