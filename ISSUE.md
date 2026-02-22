# Bug: `HookCallbackMatcher.timeout` has no "wait forever" option; `timeout: 0` silently uses 60s default

## Summary

There is no way to configure a `PreToolUse` hook to wait indefinitely for a response.
The SDK always times out after at most 60 seconds, regardless of what value you pass for
`timeout`. Additionally, `timeout: 0` silently falls back to the 60-second default due to
a truthy check in the hook executor.

## Background

This matters for interactive hooks like `AskUserQuestion` and `ExitPlanMode`, where a
human must respond before the agent continues. If the user doesn't see the prompt within
60 seconds, the hook times out and the agent proceeds with empty/default answers.

The Python SDK has `timeout=None` to mean "wait forever". The TypeScript SDK offers no
equivalent.

## Root cause

In `cli.js`, each hook executor site uses a **truthy** check instead of a null-safe check:

```js
// Current code (4 occurrences in cli.js):
let u = N.timeout ? N.timeout * 1000 : z,  // z = default 60_000ms
    {signal, cleanup} = rk(AbortSignal.timeout(u), parentSignal);
```

This means:
- `timeout: undefined` → falsy → 60s ✓ (correct default)
- `timeout: null`      → falsy → 60s ✗ (no way to express "no timeout")
- `timeout: 0`         → falsy → 60s ✗ (0 is silently ignored)
- `timeout: 30`        → 30s  ✓

The type definition reinforces this by only allowing `number`:

```ts
// sdk.d.ts (current):
interface HookCallbackMatcher {
    /** Timeout in seconds for all hooks in this matcher */
    timeout?: number;
}
```

## Proposed fix

### `sdk.d.ts` — add `null` as a valid value

```ts
interface HookCallbackMatcher {
    /**
     * Timeout in seconds for all hooks in this matcher.
     * - `undefined` — use the default (60 seconds)
     * - `null`      — wait indefinitely, never time out
     * - `number`    — explicit timeout in seconds
     */
    timeout?: number | null;
}
```

### `cli.js` source — null-safe check at each hook executor site

```js
// Proposed fix (same pattern at all 4 sites):
let u = N.timeout === null ? null
      : N.timeout ? N.timeout * 1000 : z,
    {signal, cleanup} = u === null
      ? rk(parentSignal)                   // no timeout signal at all
      : rk(AbortSignal.timeout(u), parentSignal);
```

When `timeout === null`:
- We skip `AbortSignal.timeout()` entirely
- `rk(parentSignal)` works because `rk(A, q)` takes `q` as optional (uses `q?.aborted`)
- The hook can still be cancelled by the parent session signal

## Verification

A local patch and unit test are available at:
https://github.com/anthropics/claude-agent-sdk-typescript/... *(this PR)*

```
node apply-patch.mjs   # patches local node_modules
node test-patch-unit.mjs  # 14/14 pass
```

The logic test verifies:
- `timeout: null` → `rk(parentSignal)` only (no AbortSignal.timeout)
- `timeout: 0` → still 60s default (truthy check for 0, separate issue)
- `timeout: 30` → 30s as expected
- `timeout: undefined` → 60s default as expected

## Python SDK parity

The Python SDK already supports this:

```python
HookMatcher(
    matcher="AskUserQuestion|ExitPlanMode",
    hooks=[my_hook],
    timeout=None,  # wait forever
)
```

The TypeScript SDK should offer the same capability.

## Impact

Anyone building interactive applications with `AskUserQuestion` (chat interfaces, approval
flows, human-in-the-loop workflows) is silently affected: the agent will proceed without
waiting after 60 seconds, even if the developer intends for the hook to wait forever.
