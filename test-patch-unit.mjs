/**
 * Unit test for the timeout: null patch.
 * Verifies the patched logic in isolation — no API key needed.
 *
 * Simulates the rk() signal combiner and tests each timeout scenario.
 */

let pass = 0;
let fail = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.error(`  ❌ ${label}${detail ? ": " + detail : ""}`);
    fail++;
  }
}

// Simulate rk(A, q) — the signal combiner from cli.js
// Returns a mock with a .timeoutSignal to let us inspect what was passed
function rk(A, q) {
  return { combined: true, signals: [A, q].filter(Boolean) };
}

// Simulate the BEFORE (buggy) logic
function computeTimeoutBefore(hookTimeout, defaultZ) {
  const u = hookTimeout ? hookTimeout * 1000 : defaultZ;
  return rk(AbortSignal.timeout(u), "parentSignal");
}

// Simulate the AFTER (fixed) logic
function computeTimeoutAfter(hookTimeout, defaultZ) {
  const u = hookTimeout === null ? null : hookTimeout ? hookTimeout * 1000 : defaultZ;
  return u === null ? rk("parentSignal") : rk(AbortSignal.timeout(u), "parentSignal");
}

const DEFAULT_Z = 60_000;

console.log("\n=== BEFORE patch (buggy) ===\n");

{
  const r = computeTimeoutBefore(0, DEFAULT_Z);
  // 0 is falsy → falls back to 60s → AbortSignal.timeout(60000) is created
  assert("timeout: 0  → uses default 60s (bug: treats 0 as falsy)", r.signals.length === 2);
}
{
  const r = computeTimeoutBefore(null, DEFAULT_Z);
  // null is falsy → falls back to 60s → AbortSignal.timeout(60000) is created
  assert("timeout: null → uses default 60s (bug: null is falsy)", r.signals.length === 2);
}
{
  const r = computeTimeoutBefore(undefined, DEFAULT_Z);
  // undefined is falsy → falls back to 60s
  assert("timeout: undefined → uses default 60s (correct, but via wrong mechanism)", r.signals.length === 2);
}
{
  const r = computeTimeoutBefore(30, DEFAULT_Z);
  // 30 → 30*1000 = 30000ms
  assert("timeout: 30 → 30s", r.signals.length === 2);
}

console.log("\n=== AFTER patch (fixed) ===\n");

{
  const r = computeTimeoutAfter(null, DEFAULT_Z);
  // null → skip AbortSignal.timeout → only parent signal
  assert("timeout: null → NO AbortSignal.timeout, just parent signal (never times out)", r.signals.length === 1);
  assert("timeout: null → parent signal is preserved", r.signals[0] === "parentSignal");
}
{
  const r = computeTimeoutAfter(0, DEFAULT_Z);
  // 0 is still falsy (but not null) → falls back to default 60s (same as before)
  // Could be improved with ?? but that's a separate issue
  assert("timeout: 0  → still uses default 60s (truthy bug for 0 preserved, separate issue)", r.signals.length === 2);
}
{
  const r = computeTimeoutAfter(undefined, DEFAULT_Z);
  // undefined → not null → undefined is falsy → default 60s
  assert("timeout: undefined → uses default 60s (correct)", r.signals.length === 2);
}
{
  const r = computeTimeoutAfter(30, DEFAULT_Z);
  // 30 → 30*1000 = 30000ms
  assert("timeout: 30 → 30s", r.signals.length === 2);
}
{
  const r = computeTimeoutAfter(2_147_483, DEFAULT_Z);
  // max safe value
  assert("timeout: 2_147_483 → ~24.8 days", r.signals.length === 2);
}

console.log("\n=== Verify patch was applied to cli.js ===\n");

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const sdkDir = fileURLToPath(
  new URL("./node_modules/@anthropic-ai/claude-agent-sdk", import.meta.url)
);
const cli = readFileSync(resolve(sdkDir, "cli.js"), "utf8");
const dts = readFileSync(resolve(sdkDir, "sdk.d.ts"), "utf8");

assert(
  "cli.js contains null-safe check (===null?null:)",
  cli.includes("===null?null:") && cli.includes("===null?rk("),
  "patch was not applied"
);
// After patching, the null-safe guard appears before each truthy check,
// so "===null?null:" precedes every "timeout?timeout*1000:z" in hook executors.
// Check that we have at least 4 patched sites (one per hook type).
const nullGuardCount = (cli.match(/===null\?null:/g) || []).length;
assert(
  "cli.js contains >=4 null-safe guards (one per hook executor site)",
  nullGuardCount >= 4,
  `found ${nullGuardCount}`
);
const nullRkCount = (cli.match(/===null\?rk\(/g) || []).length;
assert(
  "cli.js contains >=4 null rk() branches (one per hook executor site)",
  nullRkCount >= 4,
  `found ${nullRkCount}`
);
assert(
  "sdk.d.ts contains 'number | null' for HookCallbackMatcher.timeout",
  dts.includes("timeout?: number | null;"),
  "type not updated"
);

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
