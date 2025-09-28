# Changelog

All notable changes to the Claude Agent SDK will be documented in this file.

## 0.1.0 - 2025-09-29

Introducing the Claude Agent SDK! The Claude Code SDK has been renamed to better reflect its capabilities for building AI agents across all domains, not just coding.

### Breaking Changes

#### System Prompt Changes
- **Merged prompt options**: The `customSystemPrompt` and `appendSystemPrompt` fields have been merged into a single `systemPrompt` field for simpler configuration
- **No default system prompt**: The Claude Code system prompt is no longer included by default, giving you full control over agent behavior. To use the Claude Code system prompt, explicitly set:
  ```typescript
  systemPrompt: { type: "preset", preset: "claude_code" }
  ```

#### Settings Isolation
- **No filesystem settings by default**: Settings files (`settings.json`, `CLAUDE.md`), slash commands, and subagents are no longer loaded automatically. This ensures SDK applications have predictable behavior independent of local filesystem configurations
- **Explicit settings control**: Use the new `settingSources` field to specify which settings locations to load: `["user", "project", "local"]`

For full migration instructions, see our [migration guide](https://docs.claude.com/en/docs/claude-code/sdk/migration-guide).

### New Features

- **Programmatic subagents**: Subagents can now be defined inline in code using the `agents` option, enabling dynamic agent creation without filesystem dependencies. [Learn more](https://docs.claude.com/en/api/agent-sdk/subagents)
- **Session forking**: Resume sessions with the new `forkSession` option to branch conversations and explore different approaches from the same starting point. [Learn more](https://docs.claude.com/en/api/agent-sdk/sessions)
- **Granular settings control**: The `settingSources` option gives you fine-grained control over which filesystem settings to load, improving isolation for CI/CD, testing, and production deployments

### Documentation

- Comprehensive documentation now available in the [API Guide](https://docs.claude.com/en/api/agent-sdk/overview)
- New guides for [Custom Tools](https://docs.claude.com/en/api/agent-sdk/custom-tools), [Permissions](https://docs.claude.com/en/api/agent-sdk/permissions), [Session Management](https://docs.claude.com/en/api/agent-sdk/sessions), and more
- Complete [TypeScript API reference](https://docs.claude.com/en/api/agent-sdk/typescript)

