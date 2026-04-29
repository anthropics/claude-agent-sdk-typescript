import { describe, it, expect } from 'vitest';
import {
  detectLinuxLibc,
  platformPackageCandidates,
  resolveBundledCliBinary,
} from '../src/resolveCliBinary.js';

describe('detectLinuxLibc', () => {
  it('returns "glibc" when process.report exposes a glibc runtime version', () => {
    expect(
      detectLinuxLibc({
        getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }),
      }),
    ).toBe('glibc');
  });

  it('falls through to ldd when process.report is empty, returns "musl" on musl ldd output', () => {
    expect(
      detectLinuxLibc({
        getReport: () => ({ header: {} }),
        runLdd: () => 'musl libc (x86_64)\nVersion 1.2.4\n',
      }),
    ).toBe('musl');
  });

  it('returns "glibc" on GNU libc ldd output', () => {
    expect(
      detectLinuxLibc({
        getReport: () => ({ header: {} }),
        runLdd: () =>
          'ldd (Ubuntu GLIBC 2.39-0ubuntu8.4) 2.39\nCopyright (C) 2024 Free Software Foundation\n',
      }),
    ).toBe('glibc');
  });

  it('falls through to filesystem probe and detects musl loader', () => {
    expect(
      detectLinuxLibc({
        getReport: () => undefined,
        runLdd: () => undefined,
        fileExists: (p) => p === '/lib/ld-musl-x86_64.so.1',
      }),
    ).toBe('musl');
  });

  it('falls through to filesystem probe and detects glibc loader', () => {
    expect(
      detectLinuxLibc({
        getReport: () => undefined,
        runLdd: () => undefined,
        fileExists: (p) => p === '/lib64/ld-linux-x86-64.so.2',
      }),
    ).toBe('glibc');
  });

  it('returns "unknown" when nothing is conclusive', () => {
    expect(
      detectLinuxLibc({
        getReport: () => undefined,
        runLdd: () => '',
        fileExists: () => false,
      }),
    ).toBe('unknown');
  });

  it('does not throw when getReport itself throws', () => {
    expect(() =>
      detectLinuxLibc({
        getReport: () => {
          throw new Error('boom');
        },
        runLdd: () => undefined,
        fileExists: () => false,
      }),
    ).not.toThrow();
  });
});

describe('platformPackageCandidates', () => {
  it('returns glibc-first ordering when libc is glibc', () => {
    expect(platformPackageCandidates('linux', 'x64', 'glibc')).toEqual([
      '@anthropic-ai/claude-agent-sdk-linux-x64',
      '@anthropic-ai/claude-agent-sdk-linux-x64-musl',
    ]);
  });

  it('returns musl-first ordering when libc is musl', () => {
    expect(platformPackageCandidates('linux', 'x64', 'musl')).toEqual([
      '@anthropic-ai/claude-agent-sdk-linux-x64-musl',
      '@anthropic-ai/claude-agent-sdk-linux-x64',
    ]);
  });

  it('defaults to glibc-first when libc is unknown', () => {
    expect(platformPackageCandidates('linux', 'arm64', 'unknown')).toEqual([
      '@anthropic-ai/claude-agent-sdk-linux-arm64',
      '@anthropic-ai/claude-agent-sdk-linux-arm64-musl',
    ]);
  });

  it('returns single entry on darwin', () => {
    expect(platformPackageCandidates('darwin', 'arm64', 'unknown')).toEqual([
      '@anthropic-ai/claude-agent-sdk-darwin-arm64',
    ]);
  });

  it('returns single entry on win32', () => {
    expect(platformPackageCandidates('win32', 'x64', 'unknown')).toEqual([
      '@anthropic-ai/claude-agent-sdk-win32-x64',
    ]);
  });
});

describe('resolveBundledCliBinary', () => {
  it('returns the glibc path when libc is glibc and the file exists', () => {
    const result = resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc',
        fileExists: (p) =>
          p === '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
      },
    );
    expect(result).toBe(
      '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
    );
  });

  it('returns the musl path when libc is musl and the file exists', () => {
    const result = resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'musl',
        fileExists: (p) =>
          p ===
          '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude',
      },
    );
    expect(result).toBe(
      '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude',
    );
  });

  it('falls back to glibc when libc is musl but the musl binary is missing on disk', () => {
    // Models the npm-only case: package directory is gone (resolve throws)
    // or stub remains (resolve succeeds but fileExists returns false).
    const result = resolveBundledCliBinary(
      (spec) => {
        if (spec.includes('-musl')) throw new Error('not installed');
        return `/node_modules/${spec}`;
      },
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'musl',
        fileExists: (p) =>
          p === '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
      },
    );
    expect(result).toBe(
      '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude',
    );
  });

  it('falls back when resolve succeeds but file is not on disk', () => {
    // pnpm/npm edge case: directory resolves but the actual claude binary
    // was npm-stripped.
    const result = resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc',
        fileExists: (p) =>
          p ===
          '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude',
      },
    );
    expect(result).toBe(
      '/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude',
    );
  });

  it('returns null when neither candidate exists', () => {
    const result = resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc',
        fileExists: () => false,
      },
    );
    expect(result).toBeNull();
  });

  it('returns null when neither candidate resolves', () => {
    const result = resolveBundledCliBinary(
      () => {
        throw new Error('not installed');
      },
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc',
        fileExists: () => true,
      },
    );
    expect(result).toBeNull();
  });

  it('appends .exe on win32', () => {
    const seen: string[] = [];
    resolveBundledCliBinary(
      (spec) => {
        seen.push(spec);
        return `/node_modules/${spec}`;
      },
      {
        platform: 'win32',
        arch: 'x64',
        libc: 'unknown',
        fileExists: () => true,
      },
    );
    expect(seen).toEqual([
      '@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe',
    ]);
  });

  it('does not run libc detection on non-Linux platforms', () => {
    let detected = false;
    resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'darwin',
        arch: 'arm64',
        detectLibc: () => {
          detected = true;
          return 'unknown';
        },
        fileExists: () => true,
      },
    );
    expect(detected).toBe(false);
  });

  it('runs libc detection on Linux when not explicitly provided', () => {
    let detected = false;
    resolveBundledCliBinary(
      (spec) => `/node_modules/${spec}`,
      {
        platform: 'linux',
        arch: 'x64',
        detectLibc: () => {
          detected = true;
          return 'glibc';
        },
        fileExists: () => true,
      },
    );
    expect(detected).toBe(true);
  });
});
