# CivicPulse AI — Argo CD GitOps Architecture & Operation Guide

This guide details the **Argo CD GitOps Continuous Deployment** architecture integrated into the **Intelligent Self-Healing CI/CD Platform / CivicPulse AI** project.

---

## 1. Architecture Overview

```text
Developer Push
     ↓
GitHub main branch
     ↓
Jenkins Poll SCM (monitors main branch ONLY)
  ├── Checkout & Validate
  ├── Unit Testing (Backend & Frontend)
  ├── SonarQube & Quality Gate
  ├── Trivy Filesystem Scan
  ├── Docker Build (Tag: ${BUILD_NUMBER})
  ├── Trivy Container Image Scan
  ├── Push Images to GHCR (ghcr.io/tharunadhithyaa/civicpulse-*:BUILD_NUMBER)
  └── Apply Argo CD Parameter Override (update-gitops.sh --build-number ${BUILD_NUMBER}) [Zero-Commit Design]
     ↓ (Optionally monitored by Argo CD Image Updater via write-back-method: argocd)
Argo CD Application Live Parameters Updated in K3s (argocd/civicpulse)
     ↓
Argo CD Engine (argocd/civicpulse-application.yaml, targetRevision: main)
     ↓
K3s Cluster (namespace: civicpulse)
  ├── State Sync & Self-Healing
  ├── Workload Rollout:
  │    ├── civicpulse-mongodb (StatefulSet)
  │    ├── civicpulse-backend (Deployment)
  │    ├── civicpulse-frontend (Deployment)
  │    └── civicpulse-nginx (Deployment & NodePort 30080)
  └── Automatic Health Monitoring
```

### Responsibility Split

* **Jenkins (CI Engine)**: Source checkout from `main`, unit testing, SonarQube quality gate, Trivy security scanning, Docker image building, pushing images to GHCR, and executing Stage 11 (`update-gitops.sh --build-number ${BUILD_NUMBER}`) immediately after GHCR push to patch live parameter overrides (`backend.image.tag`, `frontend.image.tag`) directly on the Argo CD Custom Resource without creating Git commits.
* **Argo CD (CD Engine)**: Monitors GitHub repository on branch `main` (`helm/civicpulse`), applies live parameter overrides, renders Helm manifests, synchronizes K3s workloads, enforces self-healing, and reports cluster health.
* **Argo CD Image Updater (Automated Container Tracking)**: Optionally watches GHCR image registries for new tags and writes parameters back directly to the live Argo CD `Application` CR using `write-back-method: argocd` (zero-commit pattern).
* **K3s (Runtime Cluster)**: Runs MongoDB, Backend API, Frontend, Nginx reverse proxy, and monitoring microservices in the `civicpulse` namespace.

---

## 2. Preventing Apply-vs-Patch Race Conditions & Git Drift

### Race Condition Root Cause & Fix
In naive GitOps setups, calling `kubectl apply -f argocd/civicpulse-application.yaml` on every build re-applies the base Application manifest from Git, which lacks live parameters. This wipes out `.spec.source.helm.parameters` before a subsequent `kubectl patch` can run, creating a race condition with Argo CD reconciliation (causing Argo CD to fall back to default `values.yaml` tags).

**CivicPulse AI Resolution**:
1. **Conditional Application Creation**: `update-gitops.sh` checks if `civicpulse` Application exists. If present, it **skips** `kubectl apply` completely and executes a pure strategic merge patch (`kubectl patch application civicpulse -n argocd --type merge`).
2. **Ignore Differences Rule**: `argocd/civicpulse-application.yaml` includes `ignoreDifferences` for `/spec/source/helm/parameters` so Argo CD's self-healing engine never treats parameter overrides as Git drift:
   ```yaml
   ignoreDifferences:
     - group: argoproj.io
       kind: Application
       jsonPointers:
         - /spec/source/helm/parameters
   ```

---

## 3. Argo CD & Image Updater Installation

Run these commands in your WSL Ubuntu / K3s terminal:

```bash
# 1. Create argocd namespace
kubectl create namespace argocd

# 2. Install Argo CD stable manifests
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Deploy Argo CD Image Updater (Zero-Commit Automated Image Tracking)
kubectl apply -f argocd/argocd-image-updater.yaml

# 4. Verify Argo CD control plane pods are Running
kubectl get pods -n argocd -w
```

---

## 4. Deploying the CivicPulse Application to Argo CD

Apply the Argo CD Application manifest from this repository:

```bash
# Apply the CivicPulse Application manifest
kubectl apply -f argocd/civicpulse-application.yaml

# Verify application status in argocd namespace
kubectl get application civicpulse -n argocd
```

---

## 5. Argo CD Web UI Access & Initial Credentials

### Port Forwarding
Access the Argo CD Web UI on your local machine by forwarding port 8081:

```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

Open your browser to: **https://localhost:8081** (accept self-signed TLS certificate).

### Retrieve Initial Admin Password
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
```
* **Username**: `admin`
* **Password**: Output from command above.

---

## 6. Argo CD CLI Setup (WSL Ubuntu)

Install the Argo CD CLI binary:

```bash
# Download latest stable Argo CD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Test CLI version
argocd version --client
```

### Logging into Argo CD via CLI
```bash
# Login to local Argo CD server
ARGOCD_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
argocd login localhost:8081 --username admin --password "$ARGOCD_PASS" --insecure
```

---

## 7. Rollback Procedure

To roll back the deployment to a previous known-good Jenkins build number (e.g. from build `228` back to build `227`):

### Method 1: Zero-Commit Argo CD Parameter Override Patch (Recommended)
Run the GitOps update script specifying the desired target build number:

```bash
./jenkins/scripts/update-gitops.sh --build-number 227
```

Alternatively, apply the parameter override patch directly using `kubectl`:

```bash
kubectl patch application civicpulse -n argocd --type merge -p '{
  "spec": {
    "source": {
      "helm": {
        "parameters": [
          {"name": "frontend.image.tag", "value": "227"},
          {"name": "backend.image.tag", "value": "227"}
        ]
      }
    }
  }
}'
```

Argo CD will immediately reconcile and roll back the running containers in K3s without creating Git commits!

### Method 2: Argo CD CLI Rollback
```bash
# View revision history
argocd app history civicpulse

# Rollback to revision number (e.g. revision 1)
argocd app rollback civicpulse 1
```

---

## 8. Self-Healing Verification

Argo CD is configured with `selfHeal: true`. To safely test self-healing:

```bash
# Manually scale backend deployment down to 0 replicas
kubectl scale deployment civicpulse-backend -n civicpulse --replicas=0

# Observe Argo CD detect state drift and automatically restore replicas back to 1
kubectl get pods -n civicpulse -l app.kubernetes.io/component=backend -w
```

