# Changelog

## 0.1.14

- Updated to parity with Claude Code v2.0.14

## 0.1.13

- Updated to parity with Claude Code v2.0.13

## 0.1.12

- Updated to parity with Claude Code v2.0.12
- Increased SDK MCP channel closure timeout to 60s, addressing anthropics/claude-agent-sdk-typescript#15

## 0.1.11

- Updated to parity with Claude Code v2.0.11

## 0.1.10

- Updated to parity with Claude Code v2.0.10
- Added zod ^3.24.1 as peer dependency

## 0.1.9

- Fixed a bug where system prompt was sometimes not getting set correctly: anthropics/claude-agent-sdk-typescript#8

## 0.1.3

- Updated to parity with Claude Code v2.0.1

## 0.1.0

- **Merged prompt options**: The `customSystemPrompt` and `appendSystemPrompt` fields have been merged into a single `systemPrompt` field for simpler configuration
- **No default system prompt**: The Claude Code system prompt is no longer included by default, giving you full control over agent behavior. To use the Claude Code system prompt, explicitly set:
- **No filesystem settings by default**: Settings files (`settings.json`, `CLAUDE.md`), slash commands, and subagents are no longer loaded automatically. This ensures SDK applications have predictable behavior independent of local filesystem configurations
- **Explicit settings control**: Use the new `settingSources` field to specify which settings locations to load: `["user", "project", "local"]`
- **Programmatic subagents**: Subagents can now be defined inline in code using the `agents` option, enabling dynamic agent creation without filesystem dependencies. [Learn more](https://docs.claude.com/en/api/agent-sdk/subagents)
- **Session forking**: Resume sessions with the new `forkSession` option to branch conversations and explore different approaches from the same starting point. [Learn more](https://docs.claude.com/en/api/agent-sdk/sessions)
- **Granular settings control**: The `settingSources` option gives you fine-grained control over which filesystem settings to load, improving isolation for CI/CD, testing, and production deployments
- Comprehensive documentation now available in the [API Guide](https://docs.claude.com/en/api/agent-sdk/overview)
- New guides for [Custom Tools](https://docs.claude.com/en/api/agent-sdk/custom-tools), [Permissions](https://docs.claude.com/en/api/agent-sdk/permissions), [Session Management](https://docs.claude.com/en/api/agent-sdk/sessions), and more
- Complete [TypeScript API reference](https://docs.claude.com/en/api/agent-sdk/typescript)
