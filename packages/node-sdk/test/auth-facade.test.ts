/**
 * MultiAI SDK auth facade contract: managed catalog refresh updates the public
 * config while the OAuth toolkit is the only stubbed remote boundary.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readConfigFile, writeConfigFile, type MultiAIConfig } from '@multiai/agent-core';
import { MULTIAI_PROVIDER_NAME } from '@multiai/oauth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MultiAIAuthFacade } from '../src/auth';

const getModels = vi.hoisted(() => vi.fn());

vi.mock('@multiai/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@multiai/oauth')>();
  return {
    ...actual,
    MultiAIOAuthToolkit: class {
      getModels(): ReturnType<typeof getModels> {
        return getModels();
      }
    },
  };
});

const tempDirs: string[] = [];

beforeEach(() => {
  getModels.mockReset();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function authRig(config: MultiAIConfig) {
  const homeDir = await mkdtemp(join(tmpdir(), 'multiai-auth-facade-'));
  tempDirs.push(homeDir);
  const configPath = join(homeDir, 'config.toml');
  await writeConfigFile(configPath, config);
  return {
    auth: new MultiAIAuthFacade({ homeDir, configPath }),
    configPath,
  };
}

function managedConfig(): MultiAIConfig {
  return {
    providers: {
      [MULTIAI_PROVIDER_NAME]: {
        type: 'openai_responses',
        baseUrl: 'https://multiai.example.test/v1',
        apiKey: '',
        oauth: { storage: 'keyring', key: 'oauth/multiai' },
      },
    },
    models: {
      'multiai/old-model': { provider: MULTIAI_PROVIDER_NAME, model: 'old-model' },
      'multiai/kept-model': { provider: MULTIAI_PROVIDER_NAME, model: 'kept-model' },
    },
    defaultModel: 'multiai/old-model',
    thinking: { enabled: true, effort: 'max' },
  };
}

describe('MultiAIAuthFacade', () => {
  it('exposes login, logout, account, status, model refresh, and OAuth token resolution', () => {
    const auth = new MultiAIAuthFacade({
      homeDir: 'C:\\example\\.multiai',
      configPath: 'C:\\example\\.multiai\\config.toml',
    });
    expect(MultiAIAuthFacade.prototype.login).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.logout).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.getAccount).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.status).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.refreshModels).toBeTypeOf('function');
    expect(auth.resolveOAuthTokenProvider).toBeTypeOf('function');
  });

  it('persists the current production catalog when managed models change', async () => {
    const { auth, configPath } = await authRig(managedConfig());
    getModels.mockResolvedValue([{ id: 'kept-model' }, { id: 'new-model' }]);

    const result = await auth.refreshModels();

    expect(result).toEqual({
      changed: [
        {
          providerId: 'managed:multiai',
          providerName: 'MultiAI',
          added: 1,
          removed: 1,
        },
      ],
      unchanged: [],
      failed: [],
    });
    const config = readConfigFile(configPath);
    expect(config.models?.['multiai/old-model']).toBeUndefined();
    expect(config.models?.['multiai/new-model']).toMatchObject({
      provider: 'managed:multiai',
      model: 'new-model',
    });
    expect(config.defaultModel).toBe('multiai/kept-model');
    expect(config.thinking).toBeUndefined();
  });

  it('keeps the previous catalog when the production request fails', async () => {
    const { auth, configPath } = await authRig(managedConfig());
    const before = await readFile(configPath, 'utf8');
    getModels.mockRejectedValue(new Error('network unavailable'));

    const result = await auth.refreshModels();

    expect(result.failed).toEqual([
      { provider: 'managed:multiai', reason: 'network unavailable' },
    ]);
    expect(await readFile(configPath, 'utf8')).toBe(before);
  });
});
