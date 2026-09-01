import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { MultiAIConfig } from '@multiai/agent-core';
import { createMultiAIDefaultHeaders, MULTIAI_PLATFORM } from '@multiai/oauth';

import { ProviderManager } from '../../agent-core/src/session/provider-manager';
import { SDKRpcClient } from '#/index';
import { TEST_IDENTITY } from './test-identity';

const tempDirs: string[] = [];

function resolveRuntimeProvider(options: {
  readonly config: MultiAIConfig;
  readonly model?: string;
  readonly multiAIRequestHeaders?: Record<string, string>;
}) {
  const manager = new ProviderManager({
    config: options.config,
    multiAIRequestHeaders: options.multiAIRequestHeaders,
  });
  const model = options.model ?? options.config.defaultModel;
  if (model === undefined) {
    throw new Error('No model selected');
  }
  return manager.resolveProviderConfig(model);
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-sdk-provider-identity-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('runtime provider identity headers', () => {
  it('preserves the host user agent suffix in SDK RPC headers', async () => {
    const homeDir = await makeTempDir();
    const client = new SDKRpcClient({
      homeDir,
      identity: {
        ...TEST_IDENTITY,
        userAgentSuffix: 'web-runtime',
      },
    });
    const core = client.core as unknown as {
      readonly multiAIRequestHeaders?: Record<string, string>;
    };

    try {
      expect(core.multiAIRequestHeaders).toMatchObject({
        'User-Agent': 'multiai-cli/0.0.0-test (web-runtime)',
        'X-MultiAI-Version': '0.0.0-test',
      });
    } finally {
      await client.close();
    }
  });

  it('adds the full MultiAI identity only to the managed MultiAI provider', async () => {
    const homeDir = await makeTempDir();
    const multiAIRequestHeaders = createMultiAIDefaultHeaders({ homeDir, ...TEST_IDENTITY });
    const resolved = resolveRuntimeProvider({
      config: {
        defaultModel: 'multiai/model-a',
        providers: {
          'managed:multiai': {
            type: 'openai_responses',
            apiKey: '',
            baseUrl: 'https://multiai.example.test/v1',
          },
        },
        models: {
          'multiai/model-a': {
            provider: 'managed:multiai',
            model: 'model-a',
          },
        },
      },
      multiAIRequestHeaders,
    });

    expect(resolved.provider).toMatchObject({
      type: 'openai_responses',
      defaultHeaders: expect.objectContaining({
        'User-Agent': 'multiai-cli/0.0.0-test',
        'X-MultiAI-Platform': MULTIAI_PLATFORM,
        'X-MultiAI-Version': '0.0.0-test',
        'X-MultiAI-Device-Name': expect.any(String),
        'X-MultiAI-Device-Model': expect.any(String),
        'X-MultiAI-Os-Version': expect.any(String),
        'X-MultiAI-Device-Id': expect.stringMatching(/^[0-9a-f-]+$/),
      }),
    });
  });

  it('lets managed MultiAI customHeaders override default identity headers', async () => {
    const homeDir = await makeTempDir();
    const multiAIRequestHeaders = createMultiAIDefaultHeaders({ homeDir, ...TEST_IDENTITY });
    const config: MultiAIConfig = {
      providers: {
        'managed:multiai': {
          type: 'openai_responses',
          apiKey: '',
          baseUrl: 'https://multiai.example.test/v1',
          customHeaders: {
            'User-Agent': 'Custom/1',
            'X-MultiAI-Version': 'override-version',
          },
        },
      },
      defaultProvider: 'managed:multiai',
      defaultModel: 'multiai/model-a',
      models: {
        'multiai/model-a': {
          provider: 'managed:multiai',
          model: 'model-a',
        },
      },
    };

    const resolved = resolveRuntimeProvider({
      config,
      multiAIRequestHeaders,
    });

    expect(resolved.provider).toMatchObject({
      type: 'openai_responses',
      defaultHeaders: expect.objectContaining({
        'User-Agent': 'Custom/1',
        'X-MultiAI-Version': 'override-version',
        'X-MultiAI-Platform': MULTIAI_PLATFORM,
      }),
    });
  });

  it('applies only the User-Agent to external Kimi providers', async () => {
    const homeDir = await makeTempDir();
    const multiAIRequestHeaders = createMultiAIDefaultHeaders({ homeDir, ...TEST_IDENTITY });
    const resolved = resolveRuntimeProvider({
      config: {
        providers: {
          kimi: {
            type: 'kimi',
            apiKey: 'test-key',
          },
        },
        defaultModel: 'kimi-model',
        models: {
          'kimi-model': {
            provider: 'kimi',
            model: 'kimi-model',
          },
        },
      },
      multiAIRequestHeaders,
    });

    expect(resolved.provider).toMatchObject({
      type: 'kimi',
      defaultHeaders: {
        'User-Agent': `multiai-cli/${TEST_IDENTITY.version}`,
      },
    });
  });

  it('applies only the User-Agent to other external providers', async () => {
    const homeDir = await makeTempDir();
    const multiAIRequestHeaders = createMultiAIDefaultHeaders({ homeDir, ...TEST_IDENTITY });
    const config: MultiAIConfig = {
      providers: {
        openai: {
          type: 'openai',
          baseUrl: 'https://example.test/v1',
          apiKey: 'sk-test',
        },
      },
      defaultProvider: 'openai',
      defaultModel: 'gpt-test',
      models: {
        'gpt-test': {
          provider: 'openai',
          model: 'gpt-test',
          maxContextSize: 1000,
        },
      },
    };

    const resolved = resolveRuntimeProvider({
      config,
      multiAIRequestHeaders,
    });

    expect(resolved.provider).toMatchObject({
      type: 'openai',
      model: 'gpt-test',
      defaultHeaders: {
        'User-Agent': `multiai-cli/${TEST_IDENTITY.version}`,
      },
    });
    // Device identity headers stay first-party-only.
    const headers = (resolved.provider as { defaultHeaders?: Record<string, string> })
      .defaultHeaders;
    expect(headers).toBeDefined();
    expect(headers).not.toHaveProperty('X-MultiAI-Platform');
  });
});
