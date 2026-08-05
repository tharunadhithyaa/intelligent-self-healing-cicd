# Jenkins Poll SCM Build Trigger Setup — CivicPulseAI

This guide details how to configure automated build triggers for the Jenkins CI/CD pipeline using **Poll SCM** (Source Code Management Polling).

---

## Overview

**Poll SCM** allows Jenkins to periodically check your Git repository (e.g. GitHub) for new commits. If changes are detected on the monitored branch (e.g. `main`), Jenkins automatically triggers a new pipeline execution.

### Key Advantages:
- **No Public IP or Tunnel Needed**: Works seamlessly when Jenkins runs in a local environment, private cloud, or behind a firewall without needing ngrok or exposed ports.
- **Simple Setup**: Requires no GitHub Webhook secrets, payload URLs, or external network configurations.
- **Resource Efficient**: Only triggers pipeline builds when actual commit hashes differ from the previous build.

---

## Step 1: Configure Poll SCM in Jenkins Job

Follow these steps to enable automated polling in your Jenkins pipeline:

1. Open your Jenkins dashboard and select the **CivicPulseAI-Pipeline** job.
2. Click **Configure** in the sidebar menu.
3. Scroll down to the **Build Triggers** section.
4. Check the box: ☑ **Poll SCM**.
5. In the **Schedule** text box, enter a valid cron syntax expression.

---

## Step 2: Schedule Expression Reference

Jenkins uses standard `cron` syntax with hash (`H`) parameters for load balancing build triggers.

| Schedule Expression | Frequency Description | Use Case |
|---------------------|-----------------------|----------|
| `H/5 * * * *` | Every 5 minutes | Active development & frequent testing |
| `H/15 * * * *` | Every 15 minutes | Standard team workflow |
| `H/30 * * * *` | Every 30 minutes | Light polling / staging builds |
| `0 0 * * *` | Once daily at midnight | Nightly integration testing |

### Example Schedule Configuration:
```cron
# Poll SCM every 5 minutes with randomized offset
H/5 * * * *
```

---

## Step 3: Verify SCM Polling Execution

Once configured, verify that Jenkins is actively polling your Git repository:

1. Navigate to the **CivicPulseAI-Pipeline** job page in Jenkins.
2. In the left sidebar, click **Git Polling Log** (or **Poll SCM Log**).
3. The log will show timestamped polling attempts and state checks:
   ```text
   Started on Aug 3, 2026 3:45:00 PM
   Using strategy: Default
   [poll] Comparing revisions in option type ...
   > git rev-parse --is-inside-work-tree # timeout=10
   > git ls-remote -h https://github.com/YOUR_USERNAME/intelligent-self-healing-cicd.git main # timeout=10
   Done. Took 1.2 sec
   No changes
   ```

### Testing a Change:
1. Make a commit and push to your remote repository:
   ```bash
   git add .
   git commit -m "feat: trigger poll scm verification"
   git push origin main
   ```
2. Wait for the next scheduled polling interval (e.g. within 5 minutes).
3. Jenkins will detect the commit difference (`Changes found`) and initiate a pipeline build automatically.

---

## Branch Filtering & Management

By default, the pipeline polls the branch configured under **Pipeline → Definition → Branch Specifier** (e.g. `*/main`).

To monitor multiple branches or filter branch builds dynamically:
- Update **Branch Specifier** in job settings to `*/main` or `*/develop`.
- Ensure `BRANCH_NAME` parameter in `Jenkinsfile` aligns with the target environment.

---

## Troubleshooting Poll SCM

### 1. Polling Log Shows "Permission Denied" / 401 Unauthorized
- **Cause**: Git credentials in Jenkins job settings are missing or expired.
- **Fix**: Go to **Configure → Pipeline → SCM → Credentials** and select valid SSH keys or Personal Access Tokens (PAT).

### 2. High CPU or Network Usage
- **Cause**: Polling interval set too aggressively (e.g., `* * * * *` every minute).
- **Fix**: Adjust schedule to `H/5 * * * *` or `H/10 * * * *` to reduce polling frequency.

### 3. Pipeline Triggering Repeatedly Without Code Changes
- **Cause**: Workspace clean or submodules resetting files during build.
- **Fix**: Ensure `disableConcurrentBuilds()` is enabled in the [Jenkinsfile](file:///d:/Project/intelligent-self-healing-cicd/Jenkinsfile) options block.

