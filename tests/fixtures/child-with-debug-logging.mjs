/**
 * Simulates a child process that uses an Anthropic-style logger.
 *
 * BEFORE FIX: logger defaults to `console`, so console.log() goes to stdout
 * and corrupts the JSON protocol.
 *
 * AFTER FIX: logger routes to stderr, keeping stdout clean for JSON.
 */

// The fix: when running as a subprocess that communicates via JSON on stdout,
// the logger MUST write to stderr instead of using console (which goes to stdout).
const stderrLogger = {
  log: (...args) => process.stderr.write(`[debug] ${args.join(" ")}\n`),
  warn: (...args) => process.stderr.write(`[warn] ${args.join(" ")}\n`),
  error: (...args) => process.stderr.write(`[error] ${args.join(" ")}\n`),
  info: (...args) => process.stderr.write(`[info] ${args.join(" ")}\n`),
  debug: (...args) => process.stderr.write(`[debug] ${args.join(" ")}\n`),
};

// Simulate what the Anthropic client constructor does:
//   this.logger = options.logger ?? console;
//
// BUG:  defaulting to `console` sends debug output to stdout
// FIX:  default to stderrLogger when running in subprocess mode
const logger = stderrLogger; // was: console

// Simulate debug logging that happens when ANTHROPIC_LOG=debug
if (process.env.ANTHROPIC_LOG === "debug") {
  logger.log("request: POST https://api.anthropic.com/v1/messages");
  logger.log("response: 200 OK");
  logger.debug("headers: { content-type: application/json }");
}

// Simulate the JSON protocol message on stdout (this must stay clean)
const protocolMessage = JSON.stringify({
  type: "protocol_message",
  data: { status: "ok" },
});
process.stdout.write(protocolMessage + "\n");
