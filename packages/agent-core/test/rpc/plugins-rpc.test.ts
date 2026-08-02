/**
 * Scenario: managing local plugins through the public core RPC surface.
 * Responsibilities: preserve plugin behavior without leaking managed account endpoints or tokens.
 * Wiring: MultiAICore installs real temporary plugin manifests and MCP definitions.
 * Run: pnpm exec vitest run packages/agent-core/test/rpc/plugins-rpc.test.ts
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MultiAICore } from '../../src/rpc/core-impl';

describe('MultiAICore plugin RPCs', () => {
  it('install → list → setEnabled → remove round trip', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    const pluginRoot = await mkdtemp(path.join(tmpdir(), 'plugin-'));
    await writeFile(
      path.join(pluginRoot, 'kimi.plugin.json'),
      JSON.stringify({ name: 'demo', version: '1.0.0' }),
      'utf8',
    );

    const core = new MultiAICore(async () => ({}) as never, { homeDir: home });
    await new Promise((r) => setImmediate(r));

    const installed = await core.installPlugin({ source: pluginRoot });
    expect(installed.id).toBe('demo');
    expect(installed.version).toBe('1.0.0');

    const list = await core.listPlugins({});
    expect(list).toHaveLength(1);

    await core.setPluginEnabled({ id: 'demo', enabled: false });
    const after = await core.listPlugins({});
    expect(after[0]?.enabled).toBe(false);

    await core.removePlugin({ id: 'demo' });
    await expect(core.listPlugins({})).resolves.toEqual([]);
  });

  it('installPlugin ignores forged marketplace context from public RPC callers', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    const pluginRoot = await mkdtemp(path.join(tmpdir(), 'plugin-'));
    await writeFile(
      path.join(pluginRoot, 'kimi.plugin.json'),
      JSON.stringify({ name: 'demo', version: '1.0.0' }),
      'utf8',
    );

    const core = new MultiAICore(async () => ({}) as never, { homeDir: home });
    await new Promise((r) => setImmediate(r));

    const installed = await core.installPlugin({
      source: pluginRoot,
      marketplace: { id: 'demo', tier: 'official' },
    } as never);

    expect((installed as { marketplace?: unknown }).marketplace).toBeUndefined();
  });

  it('setPluginMcpServerEnabled toggles plugin MCP state', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    const pluginRoot = await mkdtemp(path.join(tmpdir(), 'plugin-'));
    await writeFile(
      path.join(pluginRoot, 'kimi.plugin.json'),
      JSON.stringify({
        name: 'demo',
        mcpServers: {
          finance: { command: 'finance-mcp' },
        },
      }),
      'utf8',
    );

    const core = new MultiAICore(async () => ({}) as never, { homeDir: home });
    await new Promise((r) => setImmediate(r));

    await core.installPlugin({ source: pluginRoot });
    await core.setPluginMcpServerEnabled({ id: 'demo', server: 'finance', enabled: true });

    await expect(core.getPluginInfo({ id: 'demo' })).resolves.toEqual(
      expect.objectContaining({
        mcpServers: expect.arrayContaining([
          expect.objectContaining({ name: 'finance', enabled: true }),
        ]),
      }),
    );
  });

  it('does not inject managed account endpoints into plugin MCP servers', async () => {
    const previousBaseUrl = process.env['MULTIAI_BASE_URL'];
    const previousOAuthHost = process.env['MULTIAI_OAUTH_HOST'];
    delete process.env['MULTIAI_BASE_URL'];
    delete process.env['MULTIAI_OAUTH_HOST'];

    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    const pluginRoot = await mkdtemp(path.join(tmpdir(), 'plugin-'));
    try {
      await writeFile(
        path.join(home, 'config.toml'),
        `
[providers."managed:multiai"]
type = "kimi"
base_url = "https://api.dev.example.test/coding/v1"
api_key = ""
oauth = { storage = "keyring", key = "oauth/multiai-env-1234", oauth_host = "https://auth.dev.example.test" }
`,
        'utf8',
      );
      await writeFile(
        path.join(pluginRoot, 'kimi.plugin.json'),
        JSON.stringify({
          name: 'kimi-datasource',
          mcpServers: {
            data: { command: 'node', args: ['./bin/kimi-datasource.mjs'] },
          },
        }),
        'utf8',
      );

      const core = new MultiAICore(async () => ({}) as never, { homeDir: home });
      await new Promise((r) => setImmediate(r));
      await core.installPlugin({ source: pluginRoot });

      const mcpConfig = (
        core as unknown as {
          mergePluginMcpConfig(base: undefined): {
            servers: Record<string, { env?: Record<string, string> }>;
          };
        }
      ).mergePluginMcpConfig(undefined);

      const env = mcpConfig.servers['plugin-kimi-datasource:data']?.env;
      expect(env).toEqual(
        expect.objectContaining({
          MULTIAI_HOME: home,
          MULTIAI_PLUGIN_ROOT: expect.any(String),
        }),
      );
      expect(env).not.toHaveProperty('MULTIAI_BASE_URL');
      expect(env).not.toHaveProperty('MULTIAI_OAUTH_HOST');
    } finally {
      restoreEnv('MULTIAI_BASE_URL', previousBaseUrl);
      restoreEnv('MULTIAI_OAUTH_HOST', previousOAuthHost);
    }
  });

  it('throws PLUGIN_LOAD_FAILED on every RPC when installed.json is corrupt', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    await mkdir(path.join(home, 'plugins'), { recursive: true });
    await writeFile(path.join(home, 'plugins', 'installed.json'), '{ not json', 'utf8');

    const core = new MultiAICore(async () => ({}) as never, { homeDir: home });

    // Driving an awaiting RPC first ensures the load promise has settled
    // and captured pluginsLoadError before the read RPCs run.
    await expect(core.installPlugin({ source: '/tmp/nonexistent' })).rejects.toThrow(/load/i);
    await expect(core.listPlugins({})).rejects.toThrow(/load/i);
    await expect(core.getPluginInfo({ id: 'demo' })).rejects.toThrow(/load/i);
    await expect(core.setPluginEnabled({ id: 'demo', enabled: false })).rejects.toThrow(/load/i);
    await expect(
      core.setPluginMcpServerEnabled({ id: 'demo', server: 'finance', enabled: true }),
    ).rejects.toThrow(/load/i);
    await expect(core.removePlugin({ id: 'demo' })).rejects.toThrow(/load/i);

    // installed.json must NOT have been overwritten by the failed install.
    const { readFile } = await import('node:fs/promises');
    const onDisk = await readFile(path.join(home, 'plugins', 'installed.json'), 'utf8');
    expect(onDisk).toBe('{ not json');

    // Fixing the file and calling reload clears the error state.
    await writeFile(
      path.join(home, 'plugins', 'installed.json'),
      JSON.stringify({ version: 1, plugins: [] }),
      'utf8',
    );
    await core.reloadPlugins({});
    await expect(core.listPlugins({})).resolves.toEqual([]);
  });

  it('listPlugins waits for initial plugin load', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'kimi-home-'));
    const pluginRoot = await mkdtemp(path.join(tmpdir(), 'plugin-'));
    await writeFile(
      path.join(pluginRoot, 'kimi.plugin.json'),
      JSON.stringify({ name: 'demo' }),
      'utf8',
    );
    await mkdir(path.join(home, 'plugins'), { recursive: true });
    await writeFile(
      path.join(home, 'plugins', 'installed.json'),
      JSON.stringify({
        version: 1,
        plugins: [
          {
            id: 'demo',
            root: pluginRoot,
            source: 'local-path',
            enabled: true,
            installedAt: '2026-05-25T09:00:00Z',
          },
        ],
      }),
      'utf8',
    );

    const core = new MultiAICore(async () => ({}) as never, { homeDir: home });

    await expect(core.listPlugins({})).resolves.toContainEqual(
      expect.objectContaining({ id: 'demo' }),
    );
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
