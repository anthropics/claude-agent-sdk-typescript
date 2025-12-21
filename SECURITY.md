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
