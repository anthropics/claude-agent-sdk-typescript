# Explicit Loom memory tools

Two native in-process MCP tools selectively save and recall facts through the
public Loom `Agent.tools(...).execute(...)` interface. The application fixes
the namespace and named user before constructing the tools. Model arguments
cannot select another identity.

This is separate from the Claude API built-in memory tool and from
`SessionStore` transcript mirroring. There is no external MCP endpoint or
automatic prompt capture. Write receipts, abstention and retrieval metadata
remain in the tool response; a completed call does not by itself prove a
fact was stored. Retrieved text is untrusted data, not instructions.

## Install and check offline

Use Node.js 20 or newer. From this directory:

```sh
npm ci
npm run check
```

The example pins the published Claude Agent SDK, Loom client and native MCP
peer versions in package.json and package-lock.json. The explicit Anthropic
peer version satisfies both SDKs without a forced or legacy peer install.
Loom is a dependency of this optional example, not of the Agent SDK package.

Tests connect the actual SDK-created MCP server to the official MCP client
through its linked in-memory transport, then traverse the real Loom client
with mocked HTTP responses. They need no model credentials, Claude process,
network server or database. These are client/dispatch checks, not live
persistence or model-behavior validation.

## Optional live command

Configure a Loom deployment, a token permitted to call `memory.set` and
`memory.search`, and `LOOM_BASE_URL`, `LOOM_API_KEY`, `LOOM_ORG`,
`LOOM_NAMESPACE` and a named `LOOM_USER_ID`. Configure normal Claude Agent
SDK authentication separately. These commands can incur model costs and
make real Loom requests; the live path must be validated separately:

```sh
npm run demo -- --live --prompt 'Remember that I prefer concise answers.'
npm run demo -- --live --prompt 'What answer style do I prefer?'
```

The same application/user scope recalls selective facts across conversations;
`sessionId` is fixed to `-`. Recall uses the client's shared-agent read scope
within that namespace and user; it does not isolate facts by writer agent. Built-in tools and filesystem settings are disabled.
Strict MCP configuration excludes ambient project, user and plugin MCP servers;
only the two configured tools are pre-approved. These options do not promise
production security, retention, erasure or access beyond the Loom token's grants.
