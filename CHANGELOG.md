# Changelog

## 0.2.25

- Updated to parity with Claude Code v2.1.25

## 0.2.23

- Fixed structured output validation errors not being reported correctly
- Updated to parity with Claude Code v2.1.23

## 0.2.22

- Fixed structured outputs to handle empty assistant messsages
- Updated to parity with Claude Code v2.1.22

## 0.2.21

- Added `config`, `scope`, and `tools` fields to `McpServerStatus` for richer server introspection
- Added `reconnectMcpServer()` and `toggleMcpServer()` methods for managing MCP server connections
- Added `disabled` status to `McpServerStatus`
- Fixed PermissionRequest hooks not being executed in SDK mode (e.g., VS Code extension)
- Updated to parity with Claude Code v2.1.21

## 0.2.20

- Added support for loading CLAUDE.md files from directories specified via `additionalDirectories` option (requires setting `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` in the `env` option)
- Added `CLAUDE_CODE_ENABLE_TASKS` env var, set to `true` to opt into the new task system
- Updated to parity with Claude Code v2.1.20

## 0.2.19

- Added `CLAUDE_CODE_ENABLE_TASKS` env var, set to `true` to opt into the new task system

## 0.2.17

- Updated to parity with Claude Code v2.1.17

## 0.2.16

- Updated to parity with Claude Code v2.1.16

## 0.2.15

- Added notification hook support
- Added `close()` method to Query interface for forcefully terminating running queries
- Updated to parity with Claude Code v2.1.15

## 0.2.14

- Updated to parity with Claude Code v2.1.14

## 0.2.12

- Updated to parity with Claude Code v2.1.12

## 0.2.11

- Updated to parity with Claude Code v2.1.11

## 0.2.10

- Added `skills` and `maxTurns` configuration options to custom agent definitions.

## 0.2.9

- Updated to parity with Claude Code v2.1.9

## 0.2.8

- Updated to parity with Claude Code v2.1.8

## 0.2.7

- Updated to parity with Claude Code v2.1.7

## 0.2.6

- Updated to parity with Claude Code v2.1.6
- Added `claudeCodeVersion` field to `package.json` for programmatically determining compatible CLI version

## 0.2.5

- Updated to parity with Claude Code v2.1.5

## 0.2.4

- Updated to parity with Claude Code v2.1.4

## 0.2.3

- Updated to parity with Claude Code v2.1.3

## 0.2.0 (2026-01-07)

- Added `error` field to `McpServerStatus` for failed MCP server connections
- Updated to parity with Claude Code v2.1.0

## 0.1.77 (2026-01-05)

- Updated to parity with Claude Code v2.0.78

## 0.1.75

- Updated to parity with Claude Code v2.0.75

## 0.1.74

- Updated to parity with Claude Code v2.0.74

## 0.1.73

- Fixed a bug where Stop hooks would not consistently run due to `Stream closed` error
- Updated to parity with Claude Code v2.0.73

## 0.1.72

- Fixed `/context` command not respecting custom system prompts
- Fixed non-streaming single-turn queries to close immediately on first result instead of waiting for inactivity timeout
- Changed V2 session API method `receive()` to `stream()` for consistency with Anthropic SDK patterns
- Updated to parity with Claude Code v2.0.72

## 0.1.71

- Added zod `^4.0.0` as peer dependency option in addition to zod `^3.24.1`
- Added support for AskUserQuestion tool. If using `tools` option, enable by including `'AskUserQuestion'` in list
- Fixed visible console window appearing when spawning Claude subprocess on Windows
- Fixed spawn message being sent to stderr callback (anthropics/claude-agent-sdk-typescript#45)
- Updated to parity with Claude Code v2.0.71

## 0.1.69

- Updated to parity with Claude Code v2.0.69

## 0.1.68

- Fixed a bug where disallowed MCP tools were visible to the model
- Updated to parity with Claude Code v2.0.68

## 0.1.67

- Updated to parity with Claude Code v2.0.67

## 0.1.66

- Fixed project MCP servers from `.mcp.json` not being available when `settingSources` includes `project`
- Updated to parity with Claude Code v2.0.66

## 0.1.65

- Updated to parity with Claude Code v2.0.66

## 0.1.64

- Fixed issues where SDK MCP servers, hooks, or canUseTool callbacks could fail when stdin was closed too early after the first result
- Updated to parity with Claude Code v2.0.64

## 0.1.63

- Updated to parity with Claude Code v2.0.63

## 0.1.61

- Updated to parity with Claude Code v2.0.61

## 0.1.60

- Updated to parity with Claude Code v2.0.60

## 0.1.59

- Updated to parity with Claude Code v2.0.59

## 0.1.58

- Updated to parity with Claude Code v2.0.58
- Added `betas` option to enable beta features. Currently supports `'context-1m-2025-08-07'` for 1M token context window on Sonnet 4/4.5. See https://docs.anthropic.com/en/api/beta-headers for more details.

## 0.1.57

- Updated to parity with Claude Code v2.0.57
- Added `tools` option to specify the exact set of built-in tools available to the agent. Use `tools: ['Bash', 'Read', 'Edit']` for a strict allowlist, `tools: []` to disable all built-in tools, or `tools: { type: 'preset', preset: 'claude_code' }` for all default tools. Omitting this option preserves existing behavior where all built-in tools are available (and can be filtered with `disallowedTools`).

## 0.1.56

- Updated to parity with Claude Code v2.0.56

## 0.1.55

- Update to parity with Claude Code v2.0.55

## 0.1.54

- Updated to parity with Claude Code v2.0.54
- Added experimental v2 session APIs (`unstable_v2_createSession`, `unstable_v2_resumeSession`, `unstable_v2_prompt`) for simpler multi-turn conversations
- Fixed a bug where ExitPlanMode tool input was empty

## 0.1.53

- Updated to parity with Claude Code v2.0.53

## 0.1.52

- Updated to parity with Claude Code v2.0.52

## 0.1.51

- Updated to parity with Claude Code v2.0.51
- Added support for Opus 4.5! https://www.anthropic.com/news/claude-opus-4-5

## 0.1.50

- Updated to parity with Claude Code v2.0.50

## 0.1.49

- Updated to parity with Claude Code v2.0.49

## 0.1.47

- Updated to parity with Claude Code v2.0.47
- Add `error` field to some messages

## 0.1.46

- Updated to parity with Claude Code v2.0.46

## 0.1.45

- Add support for Microsoft Foundry! See https://code.claude.com/docs/en/azure-ai-foundry
- Structured outputs support. Agents can now return validated JSON matching your schema. See https://platform.claude.com/docs/en/agent-sdk/structured-outputs.
- Updated to parity with Claude Code v2.0.45

## 0.1.44

- Updated to parity with Claude Code v2.0.44

## 0.1.43

- Updated to parity with Claude Code v2.0.43

## 0.1.42

- Updated to parity with Claude Code v2.0.42

## 0.1.39

- Updated to parity with Claude Code v2.0.41

## 0.1.37

- Updated to parity with Claude Code v2.0.37

## 0.1.36

- Updated to parity with Claude Code v2.0.36

## 0.1.35

- Updated to parity with Claude Code v2.0.35

## 0.1.34

- Updated to parity with Claude Code v2.0.34

## 0.1.33

- Updated to parity with Claude Code v2.0.33

## 0.1.31

- Updated to parity with Claude Code v2.0.32

## 0.1.30

- Added --max-budget-usd flag
- Fixed a bug where hooks were sometimes failing in stream mode
- Updated to parity with Claude Code v2.0.31

## 0.1.29

- Updated to parity with Claude Code v2.0.29

## 0.1.28

- Updated to parity with Claude Code v2.0.28
- Fixed a bug where custom tools were timing out after 30 seconds instead of respecting `MCP_TOOL_TIMEOUT` (anthropics/claude-agent-sdk-typescript#42)

## 0.1.27

- Updated to parity with Claude Code v2.0.27
- Added `plugins` field to `Options`

## 0.1.26

- Updated to parity with Claude Code v2.0.26

## 0.1.25

- Updated to parity with Claude Code v2.0.25
- Fixed a bug where project-level skills were not loading when `'project'` settings source was specified
- Added `skills` field to `SDKSystemMessage` with list of available skills
- Fixed a bug where some exported types were not importing correctly (anthropics/claude-agent-sdk-typescript#39)

## 0.1.22

- Updated to parity with Claude Code v2.0.22

## 0.1.21

- Updated to parity with Claude Code v2.0.21

## 0.1.20

- Updated to parity with Claude Code v2.0.20

## 0.1.19

- Updated to parity with Claude Code v2.0.19

## 0.1.17

- Updated to parity with Claude Code v2.0.18

## 0.1.16

- Updated to parity with Claude Code v2.0.17

## 0.1.15

- Updated to parity with Claude Code v2.0.15
- Updated `env` type to not use Bun `Dict` type
- Startup performance improvements when using multiple SDK MCP servers

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
- **Programmatic subagents**: Subagents can now be defined inline in code using the `agents` option, enabling dynamic agent creation without filesystem dependencies. [Learn more](https://platform.claude.com/docs/en/agent-sdk/subagents)
- **Session forking**: Resume sessions with the new `forkSession` option to branch conversations and explore different approaches from the same starting point. [Learn more](https://platform.claude.com/docs/en/agent-sdk/sessions)
- **Granular settings control**: The `settingSources` option gives you fine-grained control over which filesystem settings to load, improving isolation for CI/CD, testing, and production deployments
- Comprehensive documentation now available in the [API Guide](https://platform.claude.com/docs/en/agent-sdk/overview)
- New guides for [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools), [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions), [Session Management](https://platform.claude.com/docs/en/agent-sdk/sessions), and more
- Complete [TypeScript API reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
