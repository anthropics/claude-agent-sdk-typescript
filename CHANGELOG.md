# Changelog

## 0.2.117

- Updated to parity with Claude Code v2.1.117

## 0.2.116

- Updated to parity with Claude Code v2.1.116

## 0.2.115

- Updated to parity with Claude Code v2.1.115

## 0.2.114

- Updated to parity with Claude Code v2.1.114

## 0.2.113

- Changed the SDK to spawn a native Claude Code binary (via a per-platform optional dependency) instead of bundled JavaScript
- Added `sessionStore` option (alpha) to `query()` and session helpers for mirroring session transcripts to external storage, with `SessionStore`/`SessionKey`/`SessionStoreEntry` types, `InMemorySessionStore` reference implementation, and `importSessionToStore()` for migrating existing sessions
- Added `deleteSession()` for removing a session from disk or a `SessionStore`
- Added `SDKMirrorErrorMessage` (`subtype: 'mirror_error'`) to the `SDKMessage` union — emitted when a `sessionStore.append()` batch fails
- **Breaking**: `options.env` once again replaces `process.env` for the CLI subprocess instead of overlaying it. To add or override individual variables, pass `env: { ...process.env, MY_VAR: "x" }`
- Added `title` option to `query()` — sets the session title and skips auto-generation
- Added OpenTelemetry trace context propagation — the caller's active trace context is forwarded to the CLI subprocess so spans parent under your distributed trace

## 0.2.112

- Updated to parity with Claude Code v2.1.112

## 0.2.111

- Opus 4.7 is now available! This version of the SDK is required to use it.
- `mcp_set_servers` control request: remote (http/sse) server entries can now carry per-tool `permission_policy` values, which are applied to the session's allow/deny rules
- `startup()` and `WarmQuery` are now part of the public TypeScript API
- Changed `options.env` to overlay the inherited `process.env` instead of replacing it

## 0.2.110

- Fixed `unstable_v2_createSession` not respecting `cwd`, `settingSources`, and `allowDangerouslySkipPermissions` options
- Added optional `shouldQuery` field to `SDKUserMessage` — set to `false` to append a user message without triggering an assistant turn; fixed `shouldQuery: false` messages incorrectly triggering auto-title generation, prompt suggestions, and `UserPromptSubmit` hooks
- Auto session-title generation now respects `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`

## 0.2.109

- Updated to parity with Claude Code v2.1.109

## 0.2.108

- `SDKStatus` now includes `'requesting'`; when `includePartialMessages` is enabled, a `{type:'system', subtype:'status', status:'requesting'}` message is emitted before each API request in the stream

## 0.2.107

- Updated to parity with Claude Code v2.1.107

## 0.2.106

- Updated to parity with Claude Code v2.1.106

## 0.2.105

- Added `system/memory_recall` event and `memory_paths` on `system/init` for SDK renderers to surface memory operations
- Fixed `error_max_structured_output_retries` being emitted when the final retry attempt succeeded, discarding valid structured output

## 0.2.102

- Updated to parity with Claude Code v2.1.102

## 0.2.101

- Security: bumped `@anthropic-ai/sdk` to `^0.81.0` and `@modelcontextprotocol/sdk` to `^1.29.0` to resolve GHSA-5474-4w2j-mq4c and transitive hono advisories
- Fixed resume-session temp directory leaking on Windows when subprocess file handles weren't released before cleanup, and on macOS/APFS when `await using` disposal raced its own cleanup callback
- Fixed `MaxListenersExceededWarning` when running 11+ concurrent `query()` calls

## 0.2.100

- Updated to parity with Claude Code v2.1.100

## 0.2.99

- Updated to parity with Claude Code v2.1.99

## 0.2.98

- Updated to parity with Claude Code v2.1.98

## 0.2.97

- Updated to parity with Claude Code v2.1.97

## 0.2.96

- Updated to parity with Claude Code v2.1.96

## 0.2.95

- Updated to parity with Claude Code v2.1.95

## 0.2.94

- Fixed `getContextUsage()` to include agents passed via `options.agents` in the `agents` breakdown
- Fixed CJK and other multibyte text being corrupted with U+FFFD in stream-json input/output when chunk boundaries split a UTF-8 sequence
- Fixed MCP server child processes not being cleaned up when an SDK `query()` session ends
- Fixed a failed error-report write crashing the SDK process with `unhandledRejection`
- Updated to parity with Claude Code v2.1.94

## 0.2.93

- Updated to parity with Claude Code v2.1.93

## 0.2.92

- Updated to parity with Claude Code v2.1.92

## 0.2.91

- Added optional `terminal_reason` field to result messages, exposing why the query loop terminated (`completed`, `aborted_tools`, `max_turns`, `blocking_limit`, etc.)
- Added `'auto'` to the public `PermissionMode` type
- Changed `sandbox` option to default `failIfUnavailable` to `true` when `enabled: true` is passed — `query()` will emit an error result and exit if sandbox dependencies are missing, instead of silently running unsandboxed. Set `failIfUnavailable: false` to allow graceful degradation.
- Updated to parity with Claude Code v2.1.91

## 0.2.90

- Updated to parity with Claude Code v2.1.90

## 0.2.89

- Added `startup()` to pre-warm the CLI subprocess before `query()`, making the first query ~20x faster when startup cost can be paid upfront
- Added `includeSystemMessages` option to `getSessionMessages()` to optionally include system messages in session history
- Added `listSubagents()` and `getSubagentMessages()` functions to retrieve subagent conversation history from sessions
- Added `includeHookEvents` option to enable hook lifecycle messages (`hook_started`, `hook_progress`, `hook_response`) for all hook event types
- Fixed `ERR_STREAM_WRITE_AFTER_END` errors when single-turn queries with SDK MCP servers or hooks have control responses arriving after the result message
- Fixed Zod v4 field `.describe()` metadata being dropped from `createSdkMcpServer` tool schemas
- Fixed `side_question` returning null on resume before the first turn completes
- Fixed `settingSources` empty array causing `--setting-sources ""` to consume the next CLI flag
- Fixed error result messages (`error_during_execution`, `error_max_turns`, `error_max_budget_usd`) to correctly set `is_error: true` with descriptive messages
- Fixed MCP servers getting permanently stuck in a failed state after a connection race — they now retry on the next message

## 0.2.87

- Updated to parity with Claude Code v2.1.87

## 0.2.86

- Added `getContextUsage()` control method to retrieve a breakdown of context window usage by category
- Made `session_id` optional in `SDKUserMessage` type — callers no longer need to provide a session ID when sending user messages, as the SDK assigns one automatically
- Fixed TypeScript types resolving to `any` by adding `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk` as dependencies
- Updated to parity with Claude Code v2.1.86

## 0.2.85

- Added `reloadPlugins()` SDK method to reload plugins and receive refreshed commands, agents, and MCP server status
- Fixed PreToolUse hooks with `permissionDecision: "ask"` being ignored in SDK mode
- Updated to parity with Claude Code v2.1.85

## 0.2.84

- Added `taskBudget` option for API-side token budget awareness, allowing the model to pace tool use within a token limit
- Added `enableChannel()` method and `capabilities` field on `McpServerStatus` for SDK-driven MCP channel activation
- Exported `EffortLevel` type (`'low' | 'medium' | 'high' | 'max'`) for consumers to reference effort values directly
- Fixed showing "[Request interrupted by user]" for errors that were not caused by user interruption
- Updated to parity with Claude Code v2.1.84

## 0.2.83

- Added `seed_read_state` control subtype to seed `readFileState` with `{path, mtime}` so `Edit` works after the originating `Read` was removed from context
- Changed `session_state_changed` events to opt-in: set `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` to receive them
- Updated to parity with Claude Code v2.1.83

## 0.2.82

- Updated to parity with Claude Code v2.1.82

## 0.2.81

- Fixed `canUseTool` not providing a working `addRules` suggestion when a write under `.claude/skills/{name}/` hits the bypass-immune safety check
- Updated to parity with Claude Code v2.1.81

## 0.2.80

- Fixed `getSessionMessages()` dropping parallel tool results — sessions with parallel tool calls now return all tool_use/tool_result pairs
- Updated to parity with Claude Code v2.1.80

## 0.2.79

- Added `'resume'` to the `ExitReason` type for distinguishing resume-triggered session ends in hooks
- Updated to parity with Claude Code v2.1.79

## 0.2.78

- Updated to parity with Claude Code v2.1.78

## 0.2.77

- Added `api_retry` system messages when retrying transient API errors, exposing attempt count, max retries, delay, and error status
- Updated to parity with Claude Code v2.1.77

## 0.2.76

- Added `forkSession(sessionId, opts?)` for branching conversations from a point
- Added `cancel_async_message` control subtype to drop a queued user message by UUID before execution
- Added `planFilePath` field to `ExitPlanMode` tool input for hooks and SDK consumers
- Added MCP elicitation hook types and `SDKElicitationCompleteMessage` system message for handling MCP server input requests programmatically
- Updated to parity with Claude Code v2.1.76

## 0.2.75

- Added `tag` and `createdAt` fields to `SDKSessionInfo`
- Added `getSessionInfo(sessionId, opts?)` for single-session metadata lookup
- Added `offset` option to `listSessions` for pagination
- Added `tagSession(sessionId, tag, opts?)` for tagging session files
- Added `queued_to_running` status to `AgentToolOutput` — returned when `Agent({resume})` targets a still-running agent
- Improved error messages when the Claude Code subprocess returns an error result — the SDK now surfaces the actual error text instead of a generic "process exited with code 1"
- Updated to parity with Claude Code v2.1.75

## 0.2.74

- Added `renameSession(sessionId, title, opts?)` for renaming session files
- Fixed `import type` from `@anthropic-ai/claude-agent-sdk/sdk-tools` failing under NodeNext/Bundler module resolution (missing exports map entry since v0.2.69)
- Fixed skills with `user-invocable: false` being included in `supportedCommands()` and the `system:init` message's `slash_commands` / `skills` lists
- Updated to parity with Claude Code v2.1.74

## 0.2.73

- Fixed `options.env` being overridden by the `~/.claude/settings.json` env block when not using `user` as a `settingSources` option
- Updated to parity with Claude Code v2.1.73

## 0.2.72

- Added `agentProgressSummaries` option to enable periodic AI-generated progress summaries for running subagents (foreground and background), emitted on `task_progress` events via the new `summary` field
- Added `getSettings()` `applied` section with runtime-resolved `model` and `effort` values
- Fixed `toggleMcpServer` and `reconnectMcpServer` failing with "Server not found" for servers passed via `query({mcpServers})`
- Updated to parity with Claude Code v2.1.72

## 0.2.71

- Updated to parity with Claude Code v2.1.71

## 0.2.70

- Fixed `type: "http"` MCP servers failing with HTTP 406 "Not Acceptable" on Streamable HTTP servers that strictly enforce the `Accept: application/json, text/event-stream` header
- Changed `AgentToolInput.subagent_type` to optional — defaults to the `general-purpose` agent when omitted
- Updated to parity with Claude Code v2.1.70

## 0.2.69

- Added `toolConfig.askUserQuestion.previewFormat` option to configure the content format (`'markdown'` or `'html'`) for the `preview` field on AskUserQuestion tool options. The `preview` field and `annotations` output are now exposed in the public SDK types.
- Added `supportsFastMode` field to `ModelInfo` indicating whether a model supports fast mode
- Added `agent_id` (for subagents) and `agent_type` (for subagents and `--agent`) fields to hook events
- Fixed SDK-mode MCP servers (registered via `sdkMcpServers` in the `initialize` control request) getting disconnected when background plugin installation refreshes project MCP config
- Fixed breaking change: `system:init` and `result` events now emit `'Task'` as the Agent tool name again (reverted from `'Agent'`, which was an unintentional breaking change in a patch release). The wire name will migrate to `'Agent'` in the next minor release.
- Fixed control responses with malformed `updatedPermissions` from SDK hosts blocking tool calls with a ZodError; the invalid field is now stripped and a warning is logged instead.
- Improved memory usage of `getSessionMessages()` for large sessions with compacted history

## 0.2.68

- Updated to parity with Claude Code v2.1.68

## 0.2.66

- Updated to parity with Claude Code v2.1.66

## 0.2.63

- SDK: Fixed `pathToClaudeCodeExecutable` failing when set to a bare command name (e.g., `"claude"`) that should resolve via PATH
- Added `supportedAgents()` method to the Query interface to view available subagents
- Fixed MCP replacement tools being incorrectly denied in subagents when using unprefixed MCP tool names

## 0.2.61

- Updated to parity with Claude Code v2.1.61

## 0.2.59

- Added `getSessionMessages()` function for reading a session's conversation history from its transcript file, with support for pagination via `limit` and `offset` options

## 0.2.58

- Updated to parity with Claude Code v2.1.58

## 0.2.56

- Updated to parity with Claude Code v2.1.56

## 0.2.55

- Updated to parity with Claude Code v2.1.55

## 0.2.54

- Updated to parity with Claude Code v2.1.54

## 0.2.53

- Added `listSessions()` for discovering and listing past sessions with light metadata

## 0.2.52

- Updated to parity with Claude Code v2.1.52

## 0.2.51

- Updated to parity with Claude Code v2.1.51
- Fixed SDK crashing with `ReferenceError` when used inside compiled Bun binaries (`bun build --compile`)
- Fixed unbounded memory growth in long-running SDK sessions caused by message UUID tracking never evicting old entries
- Fixed local slash command output not being returned to SDK clients
- Added `task_progress` events for real-time background agent progress reporting with cumulative usage metrics, tool counts, and duration
- Fixed `session.close()` in the v2 session API killing the subprocess before it could persist session data, which broke `resumeSession()`

## 0.2.50

- Updated to parity with Claude Code v2.1.50

## 0.2.49

- Updated to parity with Claude Code v2.1.49
- SDK model info now includes `supportsEffort`, `supportedEffortLevels`, and `supportsAdaptiveThinking` fields so consumers can discover model capabilities.
- Permission suggestions are now populated when safety checks trigger an ask response, enabling SDK consumers to display permission options.
- Added `ConfigChange` hook event that fires when configuration files change during a session, enabling enterprise security auditing and optional blocking of settings changes.

## 0.2.47

- Updated to parity with Claude Code v2.1.47
- Added `promptSuggestion()` method on `Query` to request prompt suggestions based on the current conversation context
- Added `tool_use_id` field to `task_notification` events for correlating task completions with originating tool calls

## 0.2.46

- Updated to parity with Claude Code v2.1.46

## 0.2.45

- Added support for Claude Sonnet 4.6
- Added `task_started` system message to the SDK stream, emitted when subagent tasks are registered
- Fixed `Session.stream()` returning prematurely when background subagents are still running, by holding back intermediate result messages until all tasks complete
- Improved memory usage for shell commands that produce large output — RSS no longer grows unboundedly with command output size

## 0.2.44

- Updated to parity with Claude Code v2.1.44

## 0.2.43

- Updated to parity with Claude Code v2.1.43

## 0.2.42

- Updated to parity with Claude Code v2.1.42

## 0.2.41

- Updated to parity with Claude Code v2.1.41

## 0.2.40

- Updated to parity with Claude Code v2.1.40

## 0.2.39

- Updated to parity with Claude Code v2.1.39

## 0.2.38

- Updated to parity with Claude Code v2.1.38

## 0.2.37

- Updated to parity with Claude Code v2.1.37

## 0.2.36

- Updated to parity with Claude Code v2.1.36

## 0.2.35

- Updated to parity with Claude Code v2.1.35

## 0.2.34

- Updated to parity with Claude Code v2.1.34

## 0.2.33

- Added `TeammateIdle` and `TaskCompleted` hook events with corresponding `TeammateIdleHookInput` and `TaskCompletedHookInput` types
- Added `sessionId` option to specify a custom UUID for conversations instead of auto-generated ones
- Updated to parity with Claude Code v2.1.33

## 0.2.32

- Updated to parity with Claude Code v2.1.32

## 0.2.31

- Added `stop_reason` field to `SDKResultSuccess` and `SDKResultError` to indicate why the model stopped generating

## 0.2.30

- Added `debug` and `debugFile` options for programmatic control of debug logging
- Added optional `pages` field to `FileReadToolInput` for reading specific PDF page ranges
- Added `parts` output type to `FileReadToolOutput` for page-extracted PDF results
- Fixed "(no content)" placeholder messages being included in SDK output

## 0.2.29

- Updated to parity with Claude Code v2.1.29

## 0.2.27

- Added optional `annotations` support to the `tool()` helper function for specifying MCP tool hints (readOnlyHint, destructiveHint, openWorldHint, idempotentHint)
- Fixed `mcpServerStatus()` to include tools from SDK and dynamically-added MCP servers
- Updated to parity with Claude Code v2.1.27

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
