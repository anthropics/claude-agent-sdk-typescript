/** Restores cli.js and sdk.d.ts from .bak backups */
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const sdkDir = new URL(
  import.meta.resolve("@anthropic-ai/claude-agent-sdk")
).pathname.replace(/\/sdk\.mjs$/, "");

for (const f of ["cli.js", "sdk.d.ts"]) {
  const bak = resolve(sdkDir, f + ".bak");
  if (existsSync(bak)) {
    copyFileSync(bak, resolve(sdkDir, f));
    console.log(`✅ Restored ${f}`);
  } else {
    console.log(`⚠️  No backup found for ${f}`);
  }
}
