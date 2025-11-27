# Security Remediation Guide

**Associated Report**: SECURITY_AUDIT_REPORT.md
**Priority**: IMMEDIATE ACTION REQUIRED

---

## Quick Fix Summary

This document provides specific code changes to address the HIGH severity findings identified in the security audit.

---

## Critical Fixes (Implement Immediately)

### Fix #1: Correct Workflow Prompt Syntax (H-03)

**File**: `.github/workflows/issue-triage.yml`
**Line**: 24
**Severity**: HIGH

**Current Code**:
```yaml
prompt: "/label-issue REPO: ${{ github.repository }} ISSUE_NUMBER${{ github.event.issue.number }}"
```

**Fixed Code**:
```yaml
prompt: "/label-issue REPO: ${{ github.repository }} ISSUE_NUMBER: ${{ github.event.issue.number }}"
```

**Change**: Add colon `:` after `ISSUE_NUMBER`

---

### Fix #2: Restrict Workflow Access (H-02)

**File**: `.github/workflows/issue-triage.yml`
**Line**: 26
**Severity**: HIGH

**Current Code**:
```yaml
allowed_non_write_users: "*" # Required for issue triage workflow, if users without repo write access create issues
```

**Option A - Most Secure** (Recommended):
```yaml
allowed_non_write_users: "" # Only allow users with write access
```

**Option B - Moderate Security**:
```yaml
allowed_non_write_users: "trusted-user1,trusted-user2" # Specific trusted users
```

**Recommendation**: Use Option A unless there's a specific business need for non-contributors to trigger workflows.

---

### Fix #3: Add Cost Controls (M-02)

**File**: `.github/workflows/issue-triage.yml`
**Lines**: 21-27
**Severity**: MEDIUM

**Current Code**:
```yaml
      - name: Run Claude Code for Issue Triage
        uses: anthropics/claude-code-action@main
        with:
          prompt: "/label-issue REPO: ${{ github.repository }} ISSUE_NUMBER${{ github.event.issue.number }}"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed_non_write_users: "*"
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Fixed Code**:
```yaml
      - name: Run Claude Code for Issue Triage
        uses: anthropics/claude-code-action@main
        with:
          prompt: "/label-issue REPO: ${{ github.repository }} ISSUE_NUMBER: ${{ github.event.issue.number }}"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed_non_write_users: "" # Only users with write access
          github_token: ${{ secrets.GITHUB_TOKEN }}
          max_budget_usd: "0.10" # Limit cost to 10 cents per execution
```

**Changes**:
- Fixed prompt syntax (colon added)
- Restricted access to write users only
- Added cost limit of $0.10 per execution

---

### Fix #4: Add Concurrency Controls (M-02)

**File**: `.github/workflows/issue-triage.yml`
**Lines**: 8-13 (add after `jobs:` declaration)
**Severity**: MEDIUM

**Add this configuration**:
```yaml
jobs:
  triage-issue:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # Add concurrency control to prevent abuse
    concurrency:
      group: issue-triage-${{ github.event.issue.number }}
      cancel-in-progress: false # Queue instead of canceling

    permissions:
      contents: read
      issues: write
```

**Benefit**: Prevents multiple simultaneous executions for the same issue, reducing DoS risk.

---

### Fix #5: Tighten Command Permissions (M-01)

**File**: `.claude/commands/label-issue.md`
**Line**: 2
**Severity**: MEDIUM

**Current Code**:
```markdown
allowed-tools: Bash(gh label list:*),Bash(gh issue view:*),Bash(gh issue edit:*),Bash(gh search:*)
```

**Fixed Code**:
```markdown
allowed-tools: Bash(gh label list),Bash(gh issue view ${{ github.event.issue.number }}),Bash(gh issue edit ${{ github.event.issue.number }}:--add-label *),Bash(gh search issues:is\:issue)
```

**Changes**:
- Remove wildcard from `gh label list` (no args needed)
- Restrict `gh issue view` to specific issue number
- Restrict `gh issue edit` to specific issue number (only allow `--add-label`)
- Limit `gh search` to issue searches only

---

## Complete Fixed Workflow File

**File**: `.github/workflows/issue-triage.yml`

```yaml
name: Claude Issue Triage
description: Run Claude Code for issue triage in GitHub Actions
on:
  issues:
    types: [opened]

jobs:
  triage-issue:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # Prevent concurrent executions for the same issue
    concurrency:
      group: issue-triage-${{ github.event.issue.number }}
      cancel-in-progress: false

    permissions:
      contents: read
      issues: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Claude Code for Issue Triage
        uses: anthropics/claude-code-action@main
        with:
          prompt: "/label-issue REPO: ${{ github.repository }} ISSUE_NUMBER: ${{ github.event.issue.number }}"
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          allowed_non_write_users: "" # Restrict to users with write access only
          github_token: ${{ secrets.GITHUB_TOKEN }}
          max_budget_usd: "0.10" # Limit cost to 10 cents per execution
```

---

## Additional Security Enhancements

### Enhancement #1: Add SECURITY.md

**File**: `SECURITY.md` (create new file)

```markdown
# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

**DO NOT** open public GitHub issues for security vulnerabilities.

Please report security vulnerabilities to: **security@anthropic.com**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies based on severity (Critical: 7 days, High: 30 days, Medium: 90 days)

### Disclosure Policy

We follow coordinated disclosure practices:
1. We acknowledge your report within 48 hours
2. We investigate and develop a fix
3. We release the fix and credit you (if desired)
4. Public disclosure occurs after fix is widely available

## Security Best Practices for SDK Users

When using the Claude Agent SDK:

1. **Never commit API keys** - Use environment variables or secret management
2. **Validate all inputs** - Sanitize user-provided data before passing to prompts
3. **Use least privilege** - Set `settingSources` explicitly, don't auto-load
4. **Implement cost controls** - Use `--max-budget-usd` flag
5. **Monitor API usage** - Set up alerts for unusual consumption
6. **Keep dependencies updated** - Regularly update the SDK to latest version

## Known Security Considerations

The Claude Agent SDK has powerful capabilities including:
- Arbitrary command execution
- File system read/write access
- Network requests

These capabilities are intentional but require responsible use. Always:
- Run SDK agents in sandboxed/isolated environments
- Implement access controls for production deployments
- Audit all custom tools and subagents before use
- Review conversation logs for suspicious activity

For more information, see our [documentation](https://docs.claude.com/en/api/agent-sdk/overview).
```

---

### Enhancement #2: Add GitHub Issue Template for Security Reports

**File**: `.github/ISSUE_TEMPLATE/security.md` (create new file)

```markdown
---
name: Security Vulnerability Report
about: Report a security vulnerability (DO NOT use for actual vulnerabilities - email security@anthropic.com instead)
title: '[SECURITY] '
labels: 'security'
assignees: ''
---

⚠️ **STOP** ⚠️

**DO NOT** report actual security vulnerabilities using this GitHub issue template.

For security vulnerabilities, please email: **security@anthropic.com**

This template is only for:
- Security-related questions
- Security feature requests
- General security discussions

For vulnerability reports, use email to ensure coordinated disclosure.

---

## Security Question/Feature Request

**Type**: [Question / Feature Request / Discussion]

**Description**:
[Describe your security-related question or feature request]

**Use Case**:
[Explain the use case or scenario]

**Additional Context**:
[Any other relevant information]
```

---

## Testing the Fixes

### Test #1: Verify Workflow Syntax

```bash
# Install act (GitHub Actions local runner)
# https://github.com/nektos/act

# Test the workflow locally
act issues --workflows .github/workflows/issue-triage.yml --dry-run
```

### Test #2: Verify Prompt Formatting

Create a test issue and check workflow logs to ensure prompt is correctly formatted:
```
Expected: "/label-issue REPO: owner/repo ISSUE_NUMBER: 123"
Not: "/label-issue REPO: owner/repo ISSUE_NUMBER123"
```

### Test #3: Verify Access Restrictions

1. With `allowed_non_write_users: ""`, create issue as non-contributor
2. Workflow should not trigger or should fail with permission error

### Test #4: Verify Cost Controls

Check workflow logs for evidence that `max_budget_usd` is respected:
- Execution should stop if budget exceeded
- Logs should show budget limit

---

## Rollout Plan

### Phase 1: Immediate (Day 1)
1. Apply Fix #1 (syntax correction) - **Zero risk**
2. Apply Fix #3 (add cost controls) - **Low risk**
3. Test workflow with synthetic issue

### Phase 2: Short-term (Week 1)
4. Apply Fix #2 (restrict access) - **Requires user impact analysis**
   - Document who currently uses auto-triage
   - Communicate change to users
   - Apply restriction
5. Apply Fix #4 (concurrency controls) - **Low risk**
6. Create SECURITY.md (Enhancement #1)

### Phase 3: Medium-term (Month 1)
7. Apply Fix #5 (tighten commands) - **Requires testing**
   - Test with various label scenarios
   - Ensure functionality maintained
   - Deploy to production
8. Implement monitoring and alerting
9. Security audit review and sign-off

---

## Monitoring and Validation

After deploying fixes, monitor:

1. **GitHub Actions Logs**: Check for errors in workflow execution
2. **Anthropic API Usage**: Monitor for cost spikes or unusual patterns
3. **Issue Label Quality**: Verify auto-labeling still works correctly
4. **User Reports**: Watch for complaints about workflow not triggering

Set up alerts for:
- Workflow failures (> 10% failure rate)
- API costs (> $10/day unexpected)
- Multiple failed authentication attempts

---

## Questions?

For questions about these fixes, please:
- Open a GitHub issue with label "security-question"
- Email security@anthropic.com for vulnerability-related questions
- Consult the full audit report: SECURITY_AUDIT_REPORT.md

---

**Last Updated**: 2025-11-19
**Audit Reference**: SECURITY_AUDIT_REPORT.md
