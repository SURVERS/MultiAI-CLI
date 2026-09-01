import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureMultiAIHome, resolveConfigPath, resolveMultiAIHome } from '#/app/bootstrap/bootstrap';

describe('bootstrap path helpers', () => {
  describe('resolveMultiAIHome', () => {
    it('uses explicit homeDir when provided', () => {
      expect(resolveMultiAIHome('/tmp/kimi')).toBe('/tmp/kimi');
    });

    it('falls back to MULTIAI_HOME env', () => {
      const prev = process.env['MULTIAI_HOME'];
      process.env['MULTIAI_HOME'] = '/env/kimi';
      try {
        expect(resolveMultiAIHome()).toBe('/env/kimi');
      } finally {
        if (prev === undefined) delete process.env['MULTIAI_HOME'];
        else process.env['MULTIAI_HOME'] = prev;
      }
    });
  });

  describe('resolveConfigPath', () => {
    it('uses explicit configPath when provided', () => {
      expect(resolveConfigPath({ configPath: '/x/config.toml' })).toBe('/x/config.toml');
    });

    it('joins homeDir with config.toml', () => {
      expect(resolveConfigPath({ homeDir: '/tmp/kimi' })).toBe('/tmp/kimi/config.toml');
    });
  });

  describe('ensureMultiAIHome', () => {
    let dir: string | undefined;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    it('creates the directory with 0700 permissions', () => {
      dir = join(mkdtempSync(join(tmpdir(), 'kimi-home-')), 'nested');
      ensureMultiAIHome(dir);
      expect(existsSync(dir)).toBe(true);
    });
  });
});
