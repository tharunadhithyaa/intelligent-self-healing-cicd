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
     ↓
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
* **K3s (Runtime Cluster)**: Runs MongoDB, Backend API, Frontend, Nginx reverse proxy, and monitoring microservices in the `civicpulse` namespace.

---

## 2. Argo CD One-Time Installation Commands

Run these commands in your WSL Ubuntu / K3s terminal to install Argo CD into namespace `argocd`:

```bash
# 1. Create argocd namespace
kubectl create namespace argocd

# 2. Install Argo CD stable manifests
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Verify Argo CD control plane pods are Running
kubectl get pods -n argocd -w
```

---

## 3. Deploying the CivicPulse Application to Argo CD

Apply the Argo CD Application manifest from this repository:

```bash
# Apply the CivicPulse Application manifest
kubectl apply -f argocd/civicpulse-application.yaml

# Verify application status in argocd namespace
kubectl get application civicpulse -n argocd
```

---

## 4. Argo CD Web UI Access & Initial Credentials

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

## 5. Argo CD CLI Setup (WSL Ubuntu)

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

### Useful CLI Commands
```bash
# List applications
argocd app list

# Get detailed application status
argocd app get civicpulse

# Trigger manual synchronization
argocd app sync civicpulse

# View deployment revision history
argocd app history civicpulse
```

---

## 6. Rollback Procedure

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

## 7. Self-Healing Verification

Argo CD is configured with `selfHeal: true`. To safely test self-healing:

```bash
# Manually scale backend deployment down to 0 replicas
kubectl scale deployment civicpulse-backend -n civicpulse --replicas=0

# Observe Argo CD detect state drift and automatically restore replicas back to 1
kubectl get pods -n civicpulse -l app.kubernetes.io/component=backend -w
```
