import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildMultiAIDefaultHeaders,
  createMultiAICliUserAgent,
  getHostPackageJsonPath,
  getHostPackageRoot,
  getVersion,
} from '#/cli/version';

describe('cli version helpers', () => {
  it('resolves the host package manifest near apps/multiai-cli and reads its version', () => {
    const pkgPath = getHostPackageJsonPath();
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

    expect(pkgPath.endsWith(join('apps', 'multiai-cli', 'package.json'))).toBe(true);
    expect(getHostPackageRoot()).toBe(dirname(pkgPath));
    expect(getVersion()).toBe(pkg.version);
  });

  it('builds default headers with the multiai-cli user-agent', () => {
    const headers = buildMultiAIDefaultHeaders('1.2.3');

    expect(headers['User-Agent']).toBe('multiai-cli/1.2.3');
  });

  it('builds the product user-agent for ad-hoc fetches', () => {
    expect(createMultiAICliUserAgent('1.2.3')).toBe('multiai-cli/1.2.3');
  });
});
