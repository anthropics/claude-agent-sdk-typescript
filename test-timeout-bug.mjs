/**
 * Reproduction test for the HookCallbackMatcher timeout bug.
 *
 * BUG: Setting `timeout: 0` on a PreToolUse hook silently falls back to the
 * 60-second default because the CLI uses a truthy check (`Z.timeout ? ...`)
 * rather than a null-safe check. There is also no way to express "wait forever"
 * since `timeout?: number` has no `null` option.
 *
 * EXPECTED: `timeout: null` should mean "wait indefinitely".
 * ACTUAL:   There is no way to express this; the SDK always times out after
 *           at most 60 seconds regardless of what value you pass.
 *
 * Usage:
 *   node test-timeout-bug.mjs          # shows bug (hook times out at ~60s)
 *   PATCHED=1 node test-timeout-bug.mjs  # shows fix (hook waits forever)
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const TIMEOUT_SECONDS = process.env.TIMEOUT_SECONDS
  ? parseInt(process.env.TIMEOUT_SECONDS)
  : undefined;

console.log("=== HookCallbackMatcher timeout bug reproduction ===\n");
if (TIMEOUT_SECONDS !== undefined) {
  console.log(`Testing with timeout: ${TIMEOUT_SECONDS} (${TIMEOUT_SECONDS === 0 ? "should bug: uses 60s default" : TIMEOUT_SECONDS + "s"})`);
} else {
  console.log("Testing with timeout: null (should wait forever — currently impossible without patch)");
}
console.log("Prompt: will trigger AskUserQuestion immediately");
console.log("We will NOT answer. Watch when the hook times out...\n");

const hookCalled = { at: null, timedOutAt: null };
const start = Date.now();

let settled = false;

const hookPromise = (async () => {
  for await (const event of query({
    prompt: 'Use the AskUserQuestion tool right now to ask me "What is your name?"',
    options: {
      permissionMode: "bypassPermissions",
      hooks: {
        PreToolUse: [
          {
            matcher: "AskUserQuestion",
            timeout: TIMEOUT_SECONDS !== undefined ? TIMEOUT_SECONDS : null,
            hooks: [
              async (input, toolUseID, { signal }) => {
                const elapsed = ((Date.now() - start) / 1000).toFixed(1);
                hookCalled.at = elapsed;
                console.log(`[${elapsed}s] Hook called! Waiting indefinitely for user input...`);
                console.log(`         signal.aborted = ${signal.aborted}`);

                // Wait forever (until signal aborts)
                await new Promise((resolve) => {
                  signal.addEventListener("abort", () => {
                    const elapsedNow = ((Date.now() - start) / 1000).toFixed(1);
                    hookCalled.timedOutAt = elapsedNow;
                    console.log(`\n[${elapsedNow}s] Signal aborted! Hook was cancelled after ${elapsedNow}s`);
                    resolve();
                  });
                });

                return { hookSpecificOutput: { permissionDecision: "deny" } };
              },
            ],
          },
        ],
      },
    },
  })) {
    if (event.type === "system") continue;
  }
})();

// Race: did the hook time out within 70s?
const timeoutCheck = new Promise((resolve) => setTimeout(resolve, 70_000, "check"));

const result = await Promise.race([hookPromise.then(() => "done"), timeoutCheck]);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log("\n=== Results ===");
console.log(`Hook called at:     ${hookCalled.at}s`);
console.log(`Hook timed out at:  ${hookCalled.timedOutAt ?? "never (still waiting)"}s`);
console.log(`Total elapsed:      ${elapsed}s`);
console.log(`Outcome:            ${result}`);

if (hookCalled.timedOutAt !== null && parseFloat(hookCalled.timedOutAt) < 65) {
  console.log("\n❌ BUG CONFIRMED: Hook timed out after ~60s despite timeout: null/0");
  console.log("   The SDK used the 60s default due to a falsy check in cli.js:");
  console.log("   Z.timeout ? Z.timeout*1000 : z   (treats 0 and null as falsy)");
  process.exit(1);
} else if (result === "check") {
  console.log("\n✅ FIX CONFIRMED: Hook waited >70s without timing out");
  console.log("   With timeout: null, no AbortSignal.timeout is created.");
  process.exit(0);
}
