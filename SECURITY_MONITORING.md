# Security Monitoring and Alerting Guide

**Purpose**: This document provides guidance for monitoring the security posture of the Claude Agent SDK repository and detecting potential security incidents.

---

## Overview

After implementing security fixes, ongoing monitoring is critical to:
- Detect anomalous behavior or potential attacks
- Track API usage and costs
- Identify workflow failures or errors
- Ensure security controls remain effective

---

## What to Monitor

### 1. GitHub Actions Workflow Execution

**Metrics to Track**:
- Workflow execution frequency (issues created per hour/day)
- Workflow success/failure rate
- Execution duration (average and outliers)
- Concurrent execution count

**Normal Baseline**:
- Expected: 0-10 issues per day (adjust based on your repository)
- Success rate: >90%
- Duration: 1-3 minutes per execution
- Concurrent executions: 0-2 (with concurrency limits in place)

**Alert Thresholds**:
- 🟡 **WARNING**: >20 issues/hour (potential spam)
- 🔴 **CRITICAL**: >50 issues/hour (likely attack)
- 🟡 **WARNING**: Success rate <80% for 24 hours
- 🔴 **CRITICAL**: Success rate <50% for 1 hour

**How to Monitor**:
```bash
# View recent workflow runs
gh run list --workflow=issue-triage.yml --limit 50

# Check for failures
gh run list --workflow=issue-triage.yml --status=failure --limit 20

# View specific run details
gh run view <RUN_ID> --log
```

---

### 2. Anthropic API Usage and Costs

**Metrics to Track**:
- Daily API request count
- Daily API costs
- Average tokens per request
- Cost per workflow execution

**Normal Baseline**:
- Expected: $0.01-$0.10 per issue triage
- Daily cost: <$5 (assuming <50 issues/day)
- Tokens: 1,000-10,000 per execution

**Alert Thresholds**:
- 🟡 **WARNING**: Daily costs >$10
- 🔴 **CRITICAL**: Daily costs >$50
- 🔴 **CRITICAL**: Single execution >$0.10 (our max_budget_usd limit)
- 🟡 **WARNING**: Sudden 3x spike in token usage

**How to Monitor**:
1. Check Anthropic Console: https://console.anthropic.com/
2. Review usage under "Usage & Billing" section
3. Set up billing alerts in Anthropic console (if available)
4. Track workflow logs for cost information

**Automated Monitoring** (if Anthropic API supports it):
```bash
# Pseudocode - adjust based on Anthropic API
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/usage?date=$(date -u +%Y-%m-%d)
```

---

### 3. Issue Creation Patterns

**Metrics to Track**:
- Issues per user
- Issues per time period
- Issue author diversity
- Suspicious patterns (identical titles, rapid succession, etc.)

**Normal Baseline**:
- Different users create issues
- Issues spaced out over time
- Varied issue content

**Alert Thresholds**:
- 🟡 **WARNING**: Single user creates >5 issues in 1 hour
- 🔴 **CRITICAL**: Single user creates >20 issues in 24 hours
- 🟡 **WARNING**: >10 issues with identical or near-identical titles
- 🔴 **CRITICAL**: Issues created <10 seconds apart

**How to Monitor**:
```bash
# List recent issues
gh issue list --limit 50 --state all --json number,title,author,createdAt

# Check for issues from specific user
gh issue list --author=SUSPICIOUS_USER --limit 100

# Search for patterns
gh search issues "created:>$(date -d '1 day ago' -u +%Y-%m-%d)" --repo=OWNER/REPO
```

---

### 4. Workflow Access Control

**Metrics to Track**:
- Users triggering workflows
- Permission denied events
- Unauthorized access attempts

**Normal Baseline**:
- Only users with write access trigger workflows
- No permission denied errors

**Alert Thresholds**:
- 🔴 **CRITICAL**: Any workflow triggered by non-write user (should not happen with `allowed_non_write_users: ""`)
- 🟡 **WARNING**: Multiple permission denied errors

**How to Monitor**:
```bash
# Check workflow logs for permission errors
gh run list --workflow=issue-triage.yml --limit 20
# Then inspect logs of each run
gh run view <RUN_ID> --log | grep -i "permission\|denied\|unauthorized"
```

---

### 5. Security-Relevant Events

**Events to Track**:
- Changes to workflow files (`.github/workflows/`)
- Changes to command definitions (`.claude/commands/`)
- Changes to security configuration
- New collaborators added to repository

**Alert Thresholds**:
- 🔴 **CRITICAL**: Unauthorized modification to `issue-triage.yml`
- 🔴 **CRITICAL**: Unauthorized modification to `label-issue.md`
- 🟡 **WARNING**: New collaborator added
- 🟡 **WARNING**: Repository settings changed

**How to Monitor**:
```bash
# Monitor commits to security-sensitive files
git log --oneline --follow .github/workflows/issue-triage.yml
git log --oneline --follow .claude/commands/label-issue.md

# Check repository audit log (requires admin access)
# View at: https://github.com/OWNER/REPO/settings/audit-log
```

---

## Automated Monitoring Setup

### Option 1: GitHub Actions Workflow for Monitoring

Create `.github/workflows/security-monitoring.yml`:

```yaml
name: Security Monitoring
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: read
      actions: read

    steps:
      - name: Check workflow execution rate
        run: |
          # Get workflow runs in last 24 hours
          RUNS=$(gh run list \
            --workflow=issue-triage.yml \
            --created ">=\$(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%SZ)" \
            --json databaseId \
            --jq 'length')

          echo "Workflow executions in last 24h: \$RUNS"

          if [ \$RUNS -gt 50 ]; then
            echo "::warning::HIGH workflow execution rate detected: \$RUNS runs in 24h"
          fi

      - name: Check for failed workflows
        run: |
          FAILURES=$(gh run list \
            --workflow=issue-triage.yml \
            --status=failure \
            --limit 10 \
            --json databaseId \
            --jq 'length')

          echo "Recent failures: $FAILURES"

          if [ \$FAILURES -gt 5 ]; then
            echo "::warning::Multiple workflow failures detected: \$FAILURES recent failures"
          fi

      - name: Check for suspicious issue patterns
        run: |
          # Check for rapid issue creation
          RECENT_ISSUES=$(gh issue list \
            --state all \
            --limit 100 \
            --json number,createdAt \
            --jq 'length')

          echo "Recent issues: $RECENT_ISSUES"

          if [ \$RECENT_ISSUES -gt 30 ]; then
            echo "::warning::High issue creation rate: \$RECENT_ISSUES issues"
          fi
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
```

### Option 2: External Monitoring Service

Integrate with services like:
- **Datadog**: Monitor GitHub Actions via GitHub integration
- **New Relic**: Track workflow metrics and API usage
- **Grafana**: Visualize workflow execution patterns
- **PagerDuty**: Alert on critical security events

### Option 3: Custom Monitoring Script

Create `scripts/security-monitor.sh`:

```bash
#!/bin/bash

# Configuration
THRESHOLD_DAILY_RUNS=50
THRESHOLD_HOURLY_RUNS=10

# Check workflow execution rate
echo "Checking workflow execution patterns..."

RUNS_24H=$(gh run list --workflow=issue-triage.yml \
  --created ">=\$(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%SZ)" \
  --json databaseId --jq 'length')

RUNS_1H=$(gh run list --workflow=issue-triage.yml \
  --created ">=\$(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ)" \
  --json databaseId --jq 'length')

echo "Workflow runs in last 24h: \$RUNS_24H"
echo "Workflow runs in last 1h: \$RUNS_1H"

# Alert if thresholds exceeded
if [ \$RUNS_24H -gt \$THRESHOLD_DAILY_RUNS ]; then
  echo "ALERT: High workflow execution rate in 24h"
  # Send alert (email, Slack, etc.)
fi

if [ \$RUNS_1H -gt \$THRESHOLD_HOURLY_RUNS ]; then
  echo "ALERT: High workflow execution rate in 1h - possible attack"
  # Send critical alert
fi

# Check for failures
FAILURES=$(gh run list --workflow=issue-triage.yml \
  --status=failure --limit 20 --json databaseId --jq 'length')

if [ \$FAILURES -gt 5 ]; then
  echo "ALERT: Multiple workflow failures detected: \$FAILURES"
fi

echo "Monitoring check complete."
```

Run this script via cron:
```bash
# Run every hour
0 * * * * /path/to/scripts/security-monitor.sh >> /var/log/security-monitor.log 2>&1
```

---

## Incident Response Procedures

### Scenario 1: Suspected Prompt Injection Attack

**Indicators**:
- Issues with suspicious content (commands, override instructions)
- Labels applied incorrectly or maliciously
- Unusual workflow behavior

**Response Steps**:
1. **Immediately disable the workflow**:
   - Go to Actions → Issue Triage workflow → Disable workflow
   - Or delete `.github/workflows/issue-triage.yml` temporarily

2. **Investigate the suspicious issue**:
   ```bash
   gh issue view <ISSUE_NUMBER>
   gh run view <RUN_ID> --log
   ```

3. **Review what labels were applied**:
   ```bash
   gh issue view <ISSUE_NUMBER> --json labels
   ```

4. **Revert malicious changes**:
   ```bash
   gh issue edit <ISSUE_NUMBER> --remove-label "malicious-label"
   ```

5. **Analyze the attack**:
   - Document the prompt injection payload
   - Determine if defenses failed
   - Update prompt injection defenses in `label-issue.md`

6. **Re-enable workflow** after fixes applied

### Scenario 2: Cost Spike / API Abuse

**Indicators**:
- Anthropic API costs suddenly spike
- Many workflow executions in short time
- Bulk issue creation

**Response Steps**:
1. **Check current API usage**:
   - Visit Anthropic Console
   - Review usage for unusual patterns

2. **Identify the source**:
   ```bash
   gh run list --workflow=issue-triage.yml --limit 100
   gh issue list --state all --limit 100 --json number,author,createdAt
   ```

3. **Stop the abuse**:
   - Disable the workflow temporarily
   - Close/lock spam issues
   - Block abusive users if necessary

4. **Verify cost controls**:
   - Confirm `max_budget_usd: "0.10"` is in place
   - Check if budget was exceeded

5. **Implement additional controls**:
   - Lower `max_budget_usd` if needed
   - Add rate limiting via concurrency groups
   - Consider requiring issue templates

### Scenario 3: Workflow Tampering

**Indicators**:
- Unauthorized commits to workflow files
- Security settings changed
- Unexpected behavior

**Response Steps**:
1. **Immediately revert the changes**:
   ```bash
   git log --oneline .github/workflows/issue-triage.yml
   git revert <BAD_COMMIT>
   git push
   ```

2. **Investigate who made the change**:
   ```bash
   git log --format="%H %an %ae %ad" .github/workflows/issue-triage.yml
   ```

3. **Check for other tampering**:
   ```bash
   git log --since="24 hours ago" --oneline
   ```

4. **Review collaborator access**:
   - Check repository settings → Collaborators
   - Remove unauthorized access

5. **Implement branch protection**:
   - Require pull request reviews for main branch
   - Enable CODEOWNERS for security-sensitive files

---

## Alerting Channels

### Recommended Alert Destinations

1. **GitHub Issues** (low priority alerts)
   - Create issues for monitoring reports
   - Good for tracking trends

2. **Email** (medium priority)
   - Send summary reports daily/weekly
   - Alert on threshold violations

3. **Slack/Discord** (medium-high priority)
   - Real-time notifications for suspicious activity
   - Integrate via webhooks

4. **PagerDuty/OpsGenie** (critical alerts only)
   - 24/7 on-call for critical security events
   - Use for cost spikes >$50, confirmed attacks

### Example Slack Alert

```bash
# Send alert to Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "⚠️ Security Alert: High workflow execution rate detected",
    "attachments": [{
      "color": "danger",
      "fields": [
        {"title": "Workflow Runs (24h)", "value": "75", "short": true},
        {"title": "Threshold", "value": "50", "short": true},
        {"title": "Repository", "value": "owner/repo", "short": true}
      ]
    }]
  }'
```

---

## Regular Security Reviews

### Daily Checks (5 minutes)
- [ ] Review workflow execution count
- [ ] Check for failed workflows
- [ ] Scan for obviously malicious issues

### Weekly Reviews (30 minutes)
- [ ] Analyze workflow execution trends
- [ ] Review Anthropic API usage and costs
- [ ] Check for unusual issue patterns
- [ ] Review workflow logs for errors

### Monthly Reviews (2 hours)
- [ ] Comprehensive security audit
- [ ] Review and update alert thresholds
- [ ] Test incident response procedures
- [ ] Update monitoring dashboards
- [ ] Review access control settings

### Quarterly Reviews (4 hours)
- [ ] Full security assessment
- [ ] Penetration testing (controlled prompt injection tests)
- [ ] Update security documentation
- [ ] Review and update monitoring tools
- [ ] Compliance verification

---

## Metrics Dashboard

### Key Performance Indicators (KPIs)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Workflow Success Rate | >95% | - | Track |
| Average Cost Per Execution | <$0.05 | - | Track |
| Daily API Spend | <$5 | - | Track |
| Mean Time to Detect (MTTD) | <1 hour | - | Track |
| Mean Time to Respond (MTTR) | <4 hours | - | Track |

### Visualization Tools

**Option 1: GitHub Insights**
- Use GitHub's built-in Actions insights
- View at: `https://github.com/OWNER/REPO/actions/workflows/issue-triage.yml`

**Option 2: Custom Dashboard**
```bash
# Generate daily report
echo "=== Security Monitoring Report ===" > report.txt
echo "Date: $(date)" >> report.txt
echo "" >> report.txt
echo "Workflow Executions (24h):" >> report.txt
gh run list --workflow=issue-triage.yml --limit 100 --json status | jq -r '.[] | .status' | sort | uniq -c >> report.txt
echo "" >> report.txt
echo "Recent Issues:" >> report.txt
gh issue list --limit 20 --json number,title,author,createdAt --jq '.[] | "\(.number): \(.title) by \(.author.login)"' >> report.txt
```

---

## Contact and Escalation

**Security Issues**: security@anthropic.com
**Monitoring Questions**: Refer to SECURITY_AUDIT_REPORT.md
**Incident Response**: Follow procedures in this document

---

**Last Updated**: {{LAST_UPDATED}}
**Next Review**: {{NEXT_REVIEW}}
**Document Owner**: Security Team
