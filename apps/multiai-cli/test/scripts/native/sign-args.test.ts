/**
 * Scenario: constructing macOS signing arguments.
 * Responsibilities: select ad-hoc or identity-based codesign options without losing the target path.
 * Wiring: signing argument construction is exercised as a pure function.
 * Run: pnpm --filter @multiai/cli exec vitest run test/scripts/native/sign-args.test.ts
 */
import { describe, expect, it } from 'vitest';

import { buildCodesignArgs } from '../../../scripts/native/04-sign.mjs';

describe('buildCodesignArgs', () => {
  it('returns ad-hoc args for identity "-"', () => {
    const args = buildCodesignArgs({
      identity: '-',
      executable: '/path/multiai',
      entitlementsPath: '/path/entitlements.plist',
      keychainPath: null,
    });
    expect(args).toEqual(['--sign', '-', '/path/multiai']);
  });

  it('returns hardened-runtime args for Developer ID identity', () => {
    const args = buildCodesignArgs({
      identity: 'Developer ID Application: Example Developer (ABCD1234)',
      executable: '/path/multiai',
      entitlementsPath: '/path/entitlements.plist',
      keychainPath: '/tmp/sign.keychain-db',
    });
    expect(args).toEqual([
      '--sign',
      'Developer ID Application: Example Developer (ABCD1234)',
      '--options',
      'runtime',
      '--entitlements',
      '/path/entitlements.plist',
      '--timestamp',
      '--keychain',
      '/tmp/sign.keychain-db',
      '--force',
      '/path/multiai',
    ]);
  });

  it('omits --keychain when keychainPath is null but uses Developer ID otherwise', () => {
    const args = buildCodesignArgs({
      identity: 'Developer ID Application: Example Developer (ABCD1234)',
      executable: '/path/multiai',
      entitlementsPath: '/path/entitlements.plist',
      keychainPath: null,
    });
    expect(args).toContain('--entitlements');
    expect(args).not.toContain('--keychain');
  });
});
