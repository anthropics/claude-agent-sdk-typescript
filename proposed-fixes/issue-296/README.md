# Proposed fix for issue #296

> Linux: musl binary preferred over glibc in v0.2.116 CLI auto-discovery
> https://github.com/anthropics/claude-agent-sdk-typescript/issues/296

This directory contains a self-contained reference implementation for
the libc-aware binary discovery fix requested by reporters in #296. It
is **not** a buildable change to the public repo — the SDK source lives
in the closed-source `@anthropic-ai/claude-agent-sdk` build (the public
repo here is issue-tracker-only). The intent is to give Anthropic a
drop-in TypeScript module + tests they can integrate into the bundled
`sdk.mjs` build.

## What the bug looks like in `sdk.mjs`

The current bundled resolver (function `N7` in 0.2.119; was `W7` when
the issue was filed) on Linux does:

```js
[
  `@anthropic-ai/claude-agent-sdk-linux-${arch}-musl`,  // tried first
  `@anthropic-ai/claude-agent-sdk-linux-${arch}`,
]
```

and returns the first one that `require.resolve` accepts — without
checking the host libc and without verifying the resolved path actually
exists on disk.

This breaks two real scenarios reported in the thread:

1. **pnpm both-installed** (asafmor, jasoncrawford): both optional
   packages land in `node_modules` because pnpm doesn't filter on the
   `libc` field. resolver returns the musl path, spawn fails on glibc
   hosts because the musl ld-linker is missing.
2. **npm glibc-only** (Number531): musl optional dep is correctly
   skipped by npm's `libc` filter, but the resolver still hands back a
   musl-shaped path. The error message says "binary not found" because
   the file truly isn't there.

## What this fix does

1. **Probe libc** at runtime on Linux:
   1. `process.report.getReport().header.glibcVersionRuntime` —
      authoritative on glibc (Node leaves it undefined on musl).
   2. `ldd --version` — parses for `musl` or `GNU libc`. Survives
      musl's ldd exiting non-zero.
   3. Filesystem probe for `/lib/ld-musl-*` vs glibc loader paths.
   4. Default to glibc when nothing is conclusive (it's the common
      Linux runtime).
2. **Verify file existence** after resolving each candidate. If a
   candidate resolves but its `claude` binary isn't on disk, fall
   through to the next one. Returns `null` only when nothing resolves
   AND nothing is on disk.

## Files

- `src/resolveCliBinary.ts` — drop-in replacement for the bundled
  resolver. Public API: `resolveBundledCliBinary`, `detectLinuxLibc`,
  `platformPackageCandidates`.
- `test/resolveCliBinary.test.ts` — vitest unit tests covering the
  detection heuristics, candidate ordering, existence fallback, and
  null-when-truly-missing behaviour.

## Running the tests

```sh
cd proposed-fixes/issue-296
npm install
npm test
```

## Integration sketch

In `sdk.mjs`, replace the body of the current resolver function with a
call into `resolveBundledCliBinary(resolve, ...)`. The two existing
call sites in 0.2.119 (`new Promise(...).resolve` and the `Nc(...)`
require-shim) both pass a `require.resolve`-shaped function, which is
exactly the `Resolver` type this module expects, so no call-site
changes are needed beyond renaming the function.

The error message in the spawn-ENOENT branch should also be updated to
mention that the file is on disk but cannot execute (musl-on-glibc
case), e.g. _"Claude Code native binary at <path> failed to spawn —
this typically means the binary's libc does not match the host libc"_,
so users hitting case (1) above don't get the misleading "not found"
text.
