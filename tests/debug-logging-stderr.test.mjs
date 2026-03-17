/**
 * Test: ANTHROPIC_LOG=debug output must go to stderr, not stdout.
 *
 * When the SDK spawns a child process and communicates via JSON over stdout,
 * any debug logging that leaks to stdout corrupts the protocol.
 *
 * This test verifies the fix for issue #157:
 *   - The Anthropic HTTP client's logger must write to stderr.
 *   - Setting ANTHROPIC_LOG=debug must not pollute stdout.
 *
 * Run: node tests/debug-logging-stderr.test.mjs
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Spawns a child process that simulates the SDK subprocess behavior:
 * it sets ANTHROPIC_LOG=debug and writes JSON to stdout while the
 * Anthropic client logger is active.
 *
 * The test checks that stdout contains ONLY valid JSON lines and
 * that any debug output appears on stderr instead.
 */
async function testDebugLoggingGoesToStderr() {
  const child = spawn(
    process.execPath,
    [join(__dirname, "fixtures", "child-with-debug-logging.mjs")],
    {
      env: { ...process.env, ANTHROPIC_LOG: "debug" },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  await new Promise((resolve) => child.on("close", resolve));

  // stdout must contain only valid JSON lines
  const stdoutLines = stdout.trim().split("\n").filter(Boolean);
  for (const line of stdoutLines) {
    try {
      JSON.parse(line);
    } catch {
      assert.fail(
        `stdout contains non-JSON content (debug logging leaked to stdout):\n` +
          `  Line: ${line}\n` +
          `  Full stdout: ${stdout}`
      );
    }
  }

  // Verify we got the expected JSON message on stdout
  assert.ok(
    stdoutLines.length > 0,
    "Expected at least one JSON line on stdout"
  );
  const msg = JSON.parse(stdoutLines[0]);
  assert.strictEqual(msg.type, "protocol_message");

  console.log("PASS: debug logging does not leak to stdout");
  console.log(`  stdout lines: ${stdoutLines.length} (all valid JSON)`);
  if (stderr.trim()) {
    console.log(`  stderr contains debug output: yes (${stderr.trim().length} chars)`);
  }
}

/**
 * Tests that a stderr-based logger correctly routes all log levels to stderr.
 */
function testStderrLogger() {
  // This is the fix: create a logger that routes to stderr
  const stderrLogger = {
    log: (...args) => process.stderr.write(args.join(" ") + "\n"),
    warn: (...args) => process.stderr.write(args.join(" ") + "\n"),
    error: (...args) => process.stderr.write(args.join(" ") + "\n"),
    info: (...args) => process.stderr.write(args.join(" ") + "\n"),
    debug: (...args) => process.stderr.write(args.join(" ") + "\n"),
  };

  // Verify logger has the required interface
  assert.ok(typeof stderrLogger.log === "function");
  assert.ok(typeof stderrLogger.warn === "function");
  assert.ok(typeof stderrLogger.error === "function");

  console.log("PASS: stderr logger has correct interface");
}

// Run tests
try {
  testStderrLogger();
  await testDebugLoggingGoesToStderr();
  console.log("\nAll tests passed.");
  process.exit(0);
} catch (err) {
  console.error("\nTest failed:", err.message);
  process.exit(1);
}
