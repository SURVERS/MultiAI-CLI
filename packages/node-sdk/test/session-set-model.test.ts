import { afterEach, describe, expect, it } from 'vitest';

import { createMultiAIHarness, type MultiAIError, type MultiAIHarness } from '#/index';
import { makeTempDir, removeTempDirs, waitForAgentWireEvent } from './session-runtime-helpers';
import { TEST_IDENTITY } from './test-identity';

const tempDirs: string[] = [];

afterEach(async () => {
  await removeTempDirs(tempDirs);
});

describe('Session.setModel', () => {
  it('updates the runtime model and sends config.update with the resolved model', async () => {
    const homeDir = await makeTempDir(tempDirs, 'kimi-sdk-model-home-');
    const workDir = await makeTempDir(tempDirs, 'kimi-sdk-model-work-');
    const harness = createMultiAIHarness({ homeDir, identity: TEST_IDENTITY });

    try {
      await configureLocalProvider(harness);
      const session = await harness.createSession({
        id: 'ses_model_wire',
        workDir,
        model: 'initial-model',
      });

      await session.setModel('next-model');

      await expect(session.getStatus()).resolves.toMatchObject({ model: 'next-model' });
      const configEvent = await waitForAgentWireEvent(
        homeDir,
        session.id,
        'config.update',
        (event) => event['modelAlias'] === 'next-model',
      );
      expect(configEvent).toMatchObject({
        type: 'config.update',
        modelAlias: 'next-model',
      });
      expect(configEvent).not.toHaveProperty('provider');
    } finally {
      await harness.close();
    }
  });

  it('resolves managed OAuth aliases before updating the runtime provider', async () => {
    const homeDir = await makeTempDir(tempDirs, 'kimi-sdk-model-home-');
    const workDir = await makeTempDir(tempDirs, 'kimi-sdk-model-work-');
    const harness = createMultiAIHarness({ homeDir, identity: TEST_IDENTITY });

    try {
      await harness.setConfig({
        providers: {
          'managed:multiai': {
            type: 'openai_responses',
            baseUrl: 'https://multiai.store/v1',
            apiKey: '',
            oauth: { storage: 'keyring', key: 'oauth/multiai', issuer: 'https://multiai.store' },
          },
        },
        models: {
          'multiai/initial': {
            provider: 'managed:multiai',
            model: 'initial',
            maxContextSize: 262144,
          },
          'multiai/next': {
            provider: 'managed:multiai',
            model: 'next',
            maxContextSize: 262144,
          },
        },
        defaultModel: 'multiai/initial',
      });
      const session = await harness.createSession({
        id: 'ses_model_oauth_wire',
        workDir,
        model: 'multiai/initial',
      });

      await session.setModel('multiai/next');

      await expect(session.getStatus()).resolves.toMatchObject({
        model: 'multiai/next',
      });
      const configEvent = await waitForAgentWireEvent(
        homeDir,
        session.id,
        'config.update',
        (event) => event['modelAlias'] === 'multiai/next',
      );
      expect(configEvent).toMatchObject({
        type: 'config.update',
        modelAlias: 'multiai/next',
      });
      expect(configEvent).not.toHaveProperty('provider');
    } finally {
      await harness.close();
    }
  });

  it('rejects empty model names', async () => {
    const homeDir = await makeTempDir(tempDirs, 'kimi-sdk-model-home-');
    const workDir = await makeTempDir(tempDirs, 'kimi-sdk-model-work-');
    const harness = createMultiAIHarness({ homeDir, identity: TEST_IDENTITY });

    try {
      await configureLocalProvider(harness);
      const session = await harness.createSession({ id: 'ses_model_empty', workDir });

      await expect(session.setModel('   ')).rejects.toMatchObject({
        name: 'MultiAIError',
        code: 'session.model_empty',
      } satisfies Partial<MultiAIError>);
    } finally {
      await harness.close();
    }
  });

  it('rejects after the session is closed', async () => {
    const homeDir = await makeTempDir(tempDirs, 'kimi-sdk-model-home-');
    const workDir = await makeTempDir(tempDirs, 'kimi-sdk-model-work-');
    const harness = createMultiAIHarness({ homeDir, identity: TEST_IDENTITY });

    try {
      await configureLocalProvider(harness);
      const session = await harness.createSession({ id: 'ses_model_closed', workDir });
      await session.close();

      await expect(session.setModel('next-model')).rejects.toMatchObject({
        name: 'MultiAIError',
        code: 'session.closed',
      } satisfies Partial<MultiAIError>);
    } finally {
      await harness.close();
    }
  });
});

async function configureLocalProvider(harness: MultiAIHarness): Promise<void> {
  await harness.setConfig({
    providers: {
      local: {
        type: 'kimi',
        apiKey: 'sk-test',
      },
    },
    models: {
      'initial-model': {
        provider: 'local',
        model: 'initial-model',
        maxContextSize: 262144,
      },
      'next-model': {
        provider: 'local',
        model: 'next-model',
        maxContextSize: 262144,
      },
    },
    defaultProvider: 'local',
  });
}
