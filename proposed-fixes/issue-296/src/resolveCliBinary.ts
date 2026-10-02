/**
 * Reference fix for issue #296.
 *
 * In the published `sdk.mjs`, the bundled function (currently `N7` in
 * 0.2.119; was `W7` when the issue was filed) resolves the CLI binary on
 * Linux by trying the musl candidate first, then the glibc candidate:
 *
 *     X === "linux"
 *       ? [`...-linux-${arch}-musl`, `...-linux-${arch}`]
 *       : [...]
 *
 * Two real-world failure modes:
 *
 *   1. pnpm installs both optional packages on Linux (no `libc` field
 *      filtering at install time, see #296). require.resolve succeeds for
 *      the musl candidate first, the SDK returns it, and spawning fails
 *      with ENOENT because the musl ld-linker is missing on glibc hosts.
 *      The error message says "binary not found" even though the file is
 *      right there on disk — only the loader is missing.
 *
 *   2. npm correctly skips the musl optional dep on glibc via the `libc`
 *      filter, but the resolver may still hand back a musl-looking path
 *      (Number531's report) — likely because some intermediate package
 *      directory is left in node_modules. Either way, the path returned
 *      points at a file that does not exist on disk.
 *
 * The fix has two parts:
 *
 *   a. Probe the runtime libc and order Linux candidates accordingly.
 *      Heuristics, in priority order:
 *         1. `process.report.getReport().header.glibcVersionRuntime` —
 *            authoritative when present (Node sets it on glibc, leaves
 *            it undefined on musl).
 *         2. `ldd --version` — parses for "musl" or "GNU libc". Treat
 *            spawn failure or unrecognized output as "unknown".
 *         3. Filesystem probe for `/lib/ld-musl-*` vs the glibc loader
 *            paths.
 *      If nothing is conclusive, prefer glibc (the common case).
 *
 *   b. After candidate ordering, also verify the resolved binary path
 *      exists on disk; if not, fall through to the next candidate. This
 *      catches the npm-only case where require.resolve hands back a path
 *      that doesn't actually have the binary.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as process from 'node:process';

export type Resolver = (specifier: string) => string;

export type LibcKind = 'glibc' | 'musl' | 'unknown';

/** Detect the runtime libc on a Linux host. Cheap, synchronous, and never throws. */
export function detectLinuxLibc(env: {
  // Hooks for tests; production passes nothing and we use real syscalls.
  getReport?: () => { header?: { glibcVersionRuntime?: string } } | undefined;
  runLdd?: () => string | undefined;
  fileExists?: (path: string) => boolean;
} = {}): LibcKind {
  // 1. Node's own report — definitive when populated.
  try {
    const getReport = env.getReport ?? (() => (process as any).report?.getReport?.());
    const report = getReport();
    const glibcVersion = report?.header?.glibcVersionRuntime;
    if (typeof glibcVersion === 'string' && glibcVersion.length > 0) {
      return 'glibc';
    }
    // Node populates glibcVersionRuntime only on glibc hosts. Empty string
    // or missing key on Linux is a strong (but not definitive) hint of musl.
  } catch {
    // fall through
  }

  // 2. Shell out to `ldd --version`. Output goes to stderr on glibc, stdout
  //    on musl (which exits non-zero). execFileSync needs both captured.
  try {
    const runLdd = env.runLdd ?? (() => {
      try {
        return execFileSync('ldd', ['--version'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 1000,
        });
      } catch (err: any) {
        // musl's ldd exits 1 but still prints to stderr; capture it.
        const stderr = err?.stderr;
        if (typeof stderr === 'string' && stderr.length > 0) return stderr;
        return undefined;
      }
    });
    const out = runLdd();
    if (typeof out === 'string' && out.length > 0) {
      if (/musl/i.test(out)) return 'musl';
      if (/glibc|GNU\s+libc/i.test(out)) return 'glibc';
    }
  } catch {
    // fall through
  }

  // 3. Filesystem probe.
  const fileExists = env.fileExists ?? existsSync;
  const muslLoaders = [
    '/lib/ld-musl-x86_64.so.1',
    '/lib/ld-musl-aarch64.so.1',
    '/lib/ld-musl-armhf.so.1',
  ];
  const glibcLoaders = [
    '/lib64/ld-linux-x86-64.so.2',
    '/lib/ld-linux-x86-64.so.2',
    '/lib/ld-linux-aarch64.so.1',
    '/lib/ld-linux-armhf.so.3',
  ];
  if (muslLoaders.some(fileExists)) return 'musl';
  if (glibcLoaders.some(fileExists)) return 'glibc';

  return 'unknown';
}

/**
 * Build the ordered list of platform-package candidates. On Linux, the
 * order depends on detected libc; everywhere else the list has one entry.
 */
export function platformPackageCandidates(
  platform: NodeJS.Platform,
  arch: string,
  libc: LibcKind,
): string[] {
  if (platform !== 'linux') {
    return [`@anthropic-ai/claude-agent-sdk-${platform}-${arch}`];
  }
  const glibc = `@anthropic-ai/claude-agent-sdk-linux-${arch}`;
  const musl = `@anthropic-ai/claude-agent-sdk-linux-${arch}-musl`;
  switch (libc) {
    case 'musl':
      return [musl, glibc];
    case 'glibc':
      return [glibc, musl];
    case 'unknown':
    default:
      // Glibc is the overwhelmingly common Linux runtime; prefer it when
      // detection is inconclusive. The npm-installed musl variant is gated
      // by a `libc: ["musl"]` field, so it should not even be present on
      // glibc hosts under npm.
      return [glibc, musl];
  }
}

/**
 * Resolver replacement for the bundled `N7` in sdk.mjs. Given a `resolve`
 * (typically `createRequire(import.meta.url).resolve`), returns the
 * absolute path to the bundled `claude` binary, or null if no candidate
 * resolves AND points at a real file.
 *
 * @param resolve  module specifier resolver (require.resolve-shaped)
 * @param opts     hooks for testing; production callers pass nothing
 */
export function resolveBundledCliBinary(
  resolve: Resolver,
  opts: {
    platform?: NodeJS.Platform;
    arch?: string;
    libc?: LibcKind;
    fileExists?: (path: string) => boolean;
    detectLibc?: () => LibcKind;
  } = {},
): string | null {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const libc =
    opts.libc ??
    (platform === 'linux'
      ? (opts.detectLibc ?? detectLinuxLibc)()
      : 'unknown');
  const fileExists = opts.fileExists ?? existsSync;
  const exeSuffix = platform === 'win32' ? '.exe' : '';

  const candidates = platformPackageCandidates(platform, arch, libc).map(
    (pkg) => `${pkg}/claude${exeSuffix}`,
  );

  for (const specifier of candidates) {
    let resolved: string;
    try {
      resolved = resolve(specifier);
    } catch {
      // Package isn't installed (or doesn't resolve from this location).
      continue;
    }
    // Existence check: protects against the npm case where resolve
    // succeeds against a stub directory but the binary file isn't there.
    if (fileExists(resolved)) {
      return resolved;
    }
  }
  return null;
}
