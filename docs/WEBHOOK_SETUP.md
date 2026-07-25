# GitHub Webhook Setup — CivicPulseAI

Detailed guide for configuring GitHub webhooks to automatically trigger Jenkins pipeline builds on every push.

---

## Overview

When properly configured, every `git push` to the repository will:
1. GitHub sends a webhook payload to Jenkins
2. Jenkins receives the event and triggers the pipeline
3. The pipeline runs all 9 stages automatically
4. Results are reported in the Jenkins console and deployment report

---

## Prerequisites

- Jenkins is accessible from the internet (or use a tunnel for local setups)
- **GitHub Integration** plugin installed in Jenkins
- GitHub repository admin access
- Jenkins job configured as "Pipeline script from SCM"

---

## Step 1: Configure Jenkins Job

Ensure the Jenkins job has the correct build trigger:

1. Open **CivicPulseAI-Pipeline** job → **Configure**
2. Under **Build Triggers**, check:
   - ☑ **GitHub hook trigger for GITScm polling**
3. Click **Save**

---

## Step 2: Create GitHub Webhook

1. Navigate to your GitHub repository
2. Go to **Settings → Webhooks → Add webhook**
3. Configure:

| Field             | Value                                          |
|-------------------|------------------------------------------------|
| **Payload URL**   | `http://YOUR_JENKINS_URL:8080/github-webhook/` |
| **Content type**  | `application/json`                             |
| **Secret**        | *(optional, but recommended for security)*     |
| **SSL verification** | Enable if Jenkins uses HTTPS               |

### Events
Select: **Just the push event**

> For more granular control, choose "Let me select individual events" and select:
> - ☑ **Pushes**
> - ☑ **Pull requests** (optional)

4. Click **Add webhook**

---

## Step 3: Verify Webhook

After creating the webhook:

1. GitHub will send a **ping** event
2. Check the webhook delivery status:
   - Go to **Settings → Webhooks** → Click your webhook
   - Scroll to **Recent Deliveries**
   - Verify the ping event shows a **green checkmark** (HTTP 200)

### Test with a Push

```bash
# Make a small change and push
echo "# webhook test" >> README.md
git add README.md
git commit -m "test: verify GitHub webhook trigger"
git push origin main
```

Check Jenkins: The pipeline should start automatically within seconds.

---

## Branch Filtering

The Jenkinsfile uses the `BRANCH_NAME` parameter (default: `main`). To filter branches at the webhook level:

### Option A: Jenkins Branch Filtering
In the Jenkinsfile, add a `when` block to the first stage:
```groovy
stage('Checkout') {
    when {
        anyOf {
            branch 'main'
            branch 'develop'
            branch pattern: 'release/*', comparator: 'GLOB'
        }
    }
    steps { ... }
}
```

### Option B: GitHub Branch Protection
In GitHub repository settings:
- Go to **Settings → Branches → Add rule**
- Set branch name pattern: `main`
- ☑ Require status checks to pass before merging
- Select the Jenkins check as a required status check

---

## Webhook Endpoint Reference

| Endpoint                                    | Purpose                           |
|---------------------------------------------|-----------------------------------|
| `http://JENKINS_URL:8080/github-webhook/`   | GitHub push event receiver        |
| `http://JENKINS_URL:8080/git/notifyCommit`  | Git polling trigger (alternative) |

---

## Local Development (ngrok Tunnel)

If Jenkins runs locally and isn't publicly accessible:

```bash
# Install ngrok
npm install -g ngrok

# Create a tunnel to Jenkins
ngrok http 8080

# Use the generated URL as the webhook payload URL
# Example: https://abc123.ngrok.io/github-webhook/
```

> **Note**: ngrok URLs change on restart. For persistent URLs, use a paid ngrok plan or deploy Jenkins to a cloud server.

---

## Webhook Security

### Shared Secret
1. Generate a secret: `openssl rand -hex 20`
2. Set the secret in both:
   - GitHub webhook configuration
   - Jenkins: **Manage Jenkins → Configure System → GitHub → GitHub Server → Secret**

### IP Allowlisting
GitHub webhook IPs are published at: https://api.github.com/meta

Configure your firewall to only accept webhook requests from GitHub's IP ranges.

---

## Troubleshooting

### Webhook Shows "Service Timeout"
- Verify Jenkins is accessible from the internet
- Check firewall rules (port 8080 must be open)
- Try the ngrok tunnel approach for local setups

### Webhook Shows 403 Forbidden
- Ensure CSRF protection is configured correctly
- Add GitHub's IP ranges to Jenkins CSRF whitelist:
  - **Manage Jenkins → Configure Global Security → CSRF Protection**
  - Check "Enable proxy compatibility"

### Webhook Shows 404 Not Found
- Verify the **GitHub Integration** plugin is installed
- Verify URL ends with `/github-webhook/` (trailing slash required)

### Pipeline Doesn't Trigger
- Verify **GitHub hook trigger for GITScm polling** is checked in the job
- Check Jenkins system log: **Manage Jenkins → System Log**
- Verify the webhook payload shows the correct branch

### Multiple Builds Triggered
- Configure `disableConcurrentBuilds()` in the Jenkinsfile (already included)
- Use **Quiet Period** in job configuration (e.g., 5 seconds)
