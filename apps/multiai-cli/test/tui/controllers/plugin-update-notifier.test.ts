import { describe, expect, it, vi } from 'vitest';

import {
  isPluginMcpToolName,
  PluginUpdateNotifier,
} from '#/tui/controllers/plugin-update-notifier';

describe('PluginUpdateNotifier without a trusted marketplace', () => {
  it('recognizes plugin MCP tool names cheaply', () => {
    expect(isPluginMcpToolName('mcp__plugin-demo_tools__run')).toBe(true);
    expect(isPluginMcpToolName('mcp__custom__run')).toBe(false);
  });

  it('does not query plugins or notify when no marketplace is explicitly configured', async () => {
    const listPlugins = vi.fn(async () => []);
    const notify = vi.fn();
    const notifier = new PluginUpdateNotifier({
      getSession: () => ({
        listMcpServers: async () => [],
        listPlugins,
      }),
      workDir: '/workspace',
      notify,
    });

    await notifier.handlePluginCommandCompleted('demo');

    expect(listPlugins).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not trust a remote install even with an injected catalog', async () => {
    const notify = vi.fn();
    const notifier = new PluginUpdateNotifier({
      getSession: () => ({
        listMcpServers: async () => [],
        listPlugins: async () => [
          {
            id: 'demo',
            displayName: 'Demo',
            version: '1.0.0',
            source: 'zip-url',
            originalSource: 'https://plugins.example.test/demo.zip',
          } as never,
        ],
      }),
      workDir: '/workspace',
      notify,
      loadMarketplace: async () => ({
        source: 'local-test',
        plugins: [
          {
            id: 'demo',
            displayName: 'Demo',
            version: '2.0.0',
            source: 'https://example.test/demo.zip',
          },
        ],
      }),
    });

    await notifier.handlePluginCommandCompleted('demo');

    expect(notify).not.toHaveBeenCalled();
  });
});
