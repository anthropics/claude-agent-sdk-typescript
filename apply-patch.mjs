/**
 * Applies the timeout: null fix to the locally installed claude-agent-sdk.
 * Run once before running test-timeout-bug.mjs.
 *
 * Changes:
 *   cli.js   — All hook executor sites: truthy check → null-safe check
 *   sdk.d.ts — timeout?: number → timeout?: number | null
 */

import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { resolve } from "path";

const sdkDir = new URL(
  import.meta.resolve("@anthropic-ai/claude-agent-sdk")
).pathname.replace(/\/sdk\.mjs$/, "");

console.log("SDK dir:", sdkDir);

// ── 1. Patch cli.js ───────────────────────────────────────────────────────────
const cliPath = resolve(sdkDir, "cli.js");
copyFileSync(cliPath, cliPath + ".bak");
let cli = readFileSync(cliPath, "utf8");

// Pattern: let <timeoutVar>=<hookVar>.timeout?<hookVar>.timeout*1000:z,{signal:<sig>,cleanup:<cleanup>}=rk(AbortSignal.timeout(<timeoutVar>),<parentSig>)
// Fix:     let <timeoutVar>=<hookVar>.timeout===null?null:<hookVar>.timeout?<hookVar>.timeout*1000:z,{signal:<sig>,cleanup:<cleanup>}=<timeoutVar>===null?rk(<parentSig>):rk(AbortSignal.timeout(<timeoutVar>),<parentSig>)
//
// We use a generic regex so variable names don't matter across SDK versions.
const hookTimeoutRegex = /let ([A-Za-z])=([A-Za-z])\.timeout\?\2\.timeout\*1000:z,(\{signal:[A-Za-z]+,cleanup:[A-Za-z]+\})=rk\(AbortSignal\.timeout\(\1\),([A-Z])\)/g;

let count = 0;
const patched = cli.replace(hookTimeoutRegex, (match, timeoutVar, hookVar, destructure, parentSig) => {
  count++;
  return `let ${timeoutVar}=${hookVar}.timeout===null?null:${hookVar}.timeout?${hookVar}.timeout*1000:z,${destructure}=${timeoutVar}===null?rk(${parentSig}):rk(AbortSignal.timeout(${timeoutVar}),${parentSig})`;
});

if (count === 0) {
  console.error("❌ No hook timeout patterns found in cli.js — SDK version may have changed");
  process.exit(1);
}

writeFileSync(cliPath, patched, "utf8");
console.log(`✅ cli.js patched (${count} occurrences)`);

// ── 2. Patch sdk.d.ts ─────────────────────────────────────────────────────────
const dtsPath = resolve(sdkDir, "sdk.d.ts");
copyFileSync(dtsPath, dtsPath + ".bak");
let dts = readFileSync(dtsPath, "utf8");

// sdk.d.ts uses CRLF — normalise to LF, patch, then restore CRLF
const usesCRLF = dts.includes("\r\n");
const dtsNorm = dts.replace(/\r\n/g, "\n");

const dtsBug = `    /** Timeout in seconds for all hooks in this matcher */\n    timeout?: number;`;
const dtsFix = `    /**\n     * Timeout in seconds for all hooks in this matcher.\n     * - \`undefined\` — use the default (60 seconds)\n     * - \`null\`      — wait indefinitely, never time out\n     * - \`number\`    — explicit timeout in seconds\n     */\n    timeout?: number | null;`;

const dtsNormPatched = dtsNorm.replace(dtsBug, dtsFix);
if (dtsNormPatched === dtsNorm) {
  console.error("❌ sdk.d.ts HookCallbackMatcher.timeout pattern not found");
  process.exit(1);
}
const dtsPatched = usesCRLF ? dtsNormPatched.replace(/\n/g, "\r\n") : dtsNormPatched;
if (dtsPatched === dts) {
  console.error("❌ sdk.d.ts HookCallbackMatcher.timeout pattern not found");
  process.exit(1);
}

writeFileSync(dtsPath, dtsPatched, "utf8");
console.log("✅ sdk.d.ts patched (HookCallbackMatcher.timeout type)");

console.log("\nPatch applied. Now run:\n  node test-timeout-bug.mjs");
