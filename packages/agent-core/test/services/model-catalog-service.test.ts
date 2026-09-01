import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CoreRPC,
  GetMultiAIConfigPayload,
  MultiAIConfig,
  MultiAIConfigPatch,
  SetMultiAIConfigPayload,
} from '../../src';
import { MULTIAI_PROVIDER_NAME } from '@multiai/oauth';

import {
  type ICoreProcessService,
  type IEnvironmentService,
  ModelCatalogService,
  ModelNotFoundError,
  ProviderNotFoundError,
  toProtocolModel,
  toProtocolProvider,
} from '../../src/services';
import type { ServicesAuthFacade } from '../../src/services/auth/managedAuth';
import type { IEventService } from '../../src/services/event/event';
import type { Event as ProtocolEvent } from '@multiai/protocol';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeEnv(): IEnvironmentService {
  return {
    _serviceBrand: undefined,
    homeDir: '/tmp/kimi-model-catalog-test',
    configPath: '/tmp/kimi-model-catalog-test/config.toml',
  };
}

function makeCore(configRef: { current: MultiAIConfig }): {
  core: ICoreProcessService;
  getCalls: GetMultiAIConfigPayload[];
  setCalls: MultiAIConfigPatch[];
  removeCalls: string[];
} {
  const getCalls: GetMultiAIConfigPayload[] = [];
  const setCalls: MultiAIConfigPatch[] = [];
  const removeCalls: string[] = [];
  const rpc: Partial<CoreRPC> = {
    getMultiAIConfig: vi.fn(async (payload: GetMultiAIConfigPayload) => {
      getCalls.push(payload);
      return configRef.current;
    }),
    setMultiAIConfig: vi.fn(async (payload: SetMultiAIConfigPayload) => {
      setCalls.push(payload);
      const next: MultiAIConfig = { ...configRef.current };
      if (payload.providers !== undefined) {
        next.providers = payload.providers as MultiAIConfig['providers'];
      }
      if (payload.models !== undefined) {
        next.models = payload.models as MultiAIConfig['models'];
      }
      if (payload.defaultModel !== undefined) next.defaultModel = payload.defaultModel;
      if (payload.thinking !== undefined) next.thinking = payload.thinking;
      configRef.current = next;
      return configRef.current;
    }),
    removeProvider: vi.fn(async ({ providerId }) => {
      removeCalls.push(providerId);
      const providers = { ...configRef.current.providers };
      delete providers[providerId];
      const models = Object.fromEntries(
        Object.entries(configRef.current.models ?? {}).filter(([, model]) => model.provider !== providerId),
      ) as MultiAIConfig['models'];
      configRef.current = {
        ...configRef.current,
        providers,
        models,
        defaultModel: undefined,
      };
      return configRef.current;
    }),
  };
  return {
    core: {
      _serviceBrand: undefined,
      rpc: rpc as CoreRPC,
      ready: async () => undefined,
      dispose: () => undefined,
    },
    getCalls,
    setCalls,
    removeCalls,
  };
}

function authFacade(accessToken = 'token-test'): ServicesAuthFacade {
  return {
    login: vi.fn(),
    logout: vi.fn(),
    getCachedAccessToken: vi.fn(async () => accessToken),
    resolveOAuthTokenProvider: vi.fn(() => ({
      getAccessToken: vi.fn(async () => accessToken),
    })),
  };
}

function makeEventService(): { svc: IEventService; published: ProtocolEvent[] } {
  const published: ProtocolEvent[] = [];
  const svc: IEventService = {
    _serviceBrand: undefined,
    onDidPublish: () => ({ dispose: () => undefined }),
    publish: (event) => {
      published.push(event);
    },
  };
  return { svc, published };
}

function catalogConfig(): MultiAIConfig {
  return {
    providers: {
      kimi: {
        type: 'kimi',
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.test/v1',
      },
      openai: { type: 'openai' },
    },
    defaultModel: 'k2',
    models: {
      k2: {
        provider: 'kimi',
        model: 'kimi-k2',
        maxContextSize: 131072,
        displayName: 'Kimi K2',
        capabilities: ['thinking'],
      },
      turbo: {
        provider: 'kimi',
        model: 'kimi-turbo',
        maxContextSize: 32768,
      },
      gpt4o: {
        provider: 'openai',
        model: 'gpt-4o',
        maxContextSize: 128000,
      },
    },
  };
}

describe('model catalog adapters', () => {
  it('maps model aliases to selectable wire ids', () => {
    const alias = catalogConfig().models!['k2']!;
    expect(toProtocolModel('k2', alias)).toEqual({
      provider: 'kimi',
      model: 'k2',
      display_name: 'Kimi K2',
      max_context_size: 131072,
      capabilities: ['thinking'],
    });
  });

  it('uses the provider model name as display fallback', () => {
    const alias = catalogConfig().models!['turbo']!;
    expect(toProtocolModel('turbo', alias).display_name).toBe('kimi-turbo');
  });

  it('projects official Anthropic effort metadata inferred from the model name', () => {
    expect(
      toProtocolModel('opus', {
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        maxContextSize: 200000,
      }),
    ).toMatchObject({
      capabilities: ['thinking'],
      support_efforts: ['low', 'medium', 'high', 'max'],
      default_effort: 'high',
    });
  });

  it('maps provider model ids and global default', () => {
    const config = catalogConfig();
    expect(
      toProtocolProvider('kimi', config.providers['kimi']!, config, {
        hasApiKey: true,
        hasOAuthToken: false,
      }),
    ).toEqual({
      id: 'kimi',
      type: 'kimi',
      base_url: 'https://api.example.test/v1',
      default_model: 'k2',
      has_api_key: true,
      status: 'connected',
      models: ['k2', 'turbo'],
    });
  });
});

describe('ModelCatalogService', () => {
  it('lists models and providers from live config', async () => {
    const configRef = { current: catalogConfig() };
    const { core, getCalls } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    expect(await svc.listModels()).toHaveLength(3);
    expect(await svc.listProviders()).toHaveLength(2);
    expect(getCalls).toEqual([{ reload: true }, { reload: true }]);
  });

  it('projects latest Opus efforts for unknown Claude-marked Anthropic-compatible models', async () => {
    const configRef = { current: catalogConfig() };
    configRef.current.providers['custom'] = { type: 'anthropic' };
    configRef.current.models!['compatible'] = {
      provider: 'custom',
      model: 'custom-claude-model',
      maxContextSize: 128000,
    };
    const { core } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    const compatible = (await svc.listModels()).find((model) => model.model === 'compatible');
    expect(compatible).toMatchObject({
      capabilities: ['thinking'],
      support_efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      default_effort: 'high',
    });
  });

  it('does not project fallback efforts for clearly non-Claude Anthropic-compatible models', async () => {
    const configRef = { current: catalogConfig() };
    configRef.current.providers['custom'] = { type: 'anthropic' };
    configRef.current.models!['compatible'] = {
      provider: 'custom',
      model: 'compatible-model',
      maxContextSize: 128000,
    };
    const { core } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    const compatible = (await svc.listModels()).find((model) => model.model === 'compatible');
    expect(compatible?.capabilities).toBeUndefined();
    expect(compatible?.support_efforts).toBeUndefined();
    expect(compatible?.default_effort).toBeUndefined();
  });

  it('does not project fallback efforts for a Kimi provider routed through the Anthropic protocol', async () => {
    const configRef = { current: catalogConfig() };
    configRef.current.models!['compatible'] = {
      provider: 'kimi',
      protocol: 'anthropic',
      model: 'compatible-model',
      maxContextSize: 128000,
    };
    const { core } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    const compatible = (await svc.listModels()).find((model) => model.model === 'compatible');
    expect(compatible).toMatchObject({
      provider: 'kimi',
      model: 'compatible',
    });
    expect(compatible?.capabilities).toBeUndefined();
    expect(compatible?.support_efforts).toBeUndefined();
    expect(compatible?.default_effort).toBeUndefined();
  });

  it('gets one provider or throws ProviderNotFoundError', async () => {
    const configRef = { current: catalogConfig() };
    const { core } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    await expect(svc.getProvider('kimi')).resolves.toMatchObject({ id: 'kimi' });
    await expect(svc.getProvider('missing')).rejects.toBeInstanceOf(
      ProviderNotFoundError,
    );
  });

  it('sets defaultModel through core config patch', async () => {
    const configRef = { current: catalogConfig() };
    const { core, setCalls } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    await expect(svc.setDefaultModel('turbo')).resolves.toEqual({
      default_model: 'turbo',
      model: {
        provider: 'kimi',
        model: 'turbo',
        display_name: 'kimi-turbo',
        max_context_size: 32768,
      },
    });
    expect(setCalls).toEqual([{ defaultModel: 'turbo' }]);
  });

  it('rejects unknown model ids', async () => {
    const configRef = { current: catalogConfig() };
    const { core } = makeCore(configRef);
    const svc = new ModelCatalogService(makeEnv(), core, makeEventService().svc);

    await expect(svc.setDefaultModel('missing')).rejects.toBeInstanceOf(
      ModelNotFoundError,
    );
  });

  it('delegates managed MultiAI OAuth model refreshes to the auth service', async () => {
    const configRef: { current: MultiAIConfig } = {
      current: {
        providers: {
          [MULTIAI_PROVIDER_NAME]: {
            type: 'openai_responses',
            apiKey: '',
            baseUrl: 'https://multiai.example.test/v1',
            oauth: {
              storage: 'keyring',
              key: 'oauth/multiai',
              issuer: 'https://multiai.example.test',
            },
          },
        },
        defaultModel: 'multiai/model-a',
        models: {
          'multiai/model-a': {
            provider: MULTIAI_PROVIDER_NAME,
            model: 'model-a',
          },
        },
      },
    };
    const { core, removeCalls, setCalls } = makeCore(configRef);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const svc = ModelCatalogService._createForTest(makeEnv(), core, authFacade());

    await expect(svc.refreshOAuthProviderModels()).resolves.toEqual({
      changed: [],
      unchanged: [],
      failed: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(removeCalls).toEqual([]);
    expect(setCalls).toEqual([]);
  });

  it('does not publish catalog events for managed MultiAI during generic refresh', async () => {
    const configRef: { current: MultiAIConfig } = {
      current: {
        providers: {
          [MULTIAI_PROVIDER_NAME]: {
            type: 'openai_responses',
            apiKey: '',
            baseUrl: 'https://multiai.example.test/v1',
            oauth: {
              storage: 'keyring',
              key: 'oauth/multiai',
              issuer: 'https://multiai.example.test',
            },
          },
        },
        models: {
          'multiai/model-a': {
            provider: MULTIAI_PROVIDER_NAME,
            model: 'model-a',
          },
        },
      },
    };
    const { core, removeCalls, setCalls } = makeCore(configRef);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { svc: eventService, published } = makeEventService();
    const svc = ModelCatalogService._createForTest(makeEnv(), core, authFacade(), eventService);

    const result = await svc.refreshProviderModels();

    expect(result).toEqual({ changed: [], unchanged: [], failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(removeCalls).toEqual([]);
    expect(setCalls).toEqual([]);
    expect(published).toEqual([]);
  });

  it('sends the host User-Agent on custom-registry fetches', async () => {
    const configRef: { current: MultiAIConfig } = {
      current: {
        providers: {
          acme: {
            type: 'openai',
            apiKey: 'sk-acme',
            source: {
              kind: 'apiJson',
              url: 'https://registry.example.test/api.json',
              apiKey: 'sk-registry',
            },
          },
        },
        models: {},
      },
    };
    const { core } = makeCore(configRef);
    (core as { multiAIRequestHeaders?: Record<string, string> }).multiAIRequestHeaders = {
      'User-Agent': 'multiai-cli/test',
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            acme: {
              id: 'acme',
              name: 'Acme',
              api: 'https://acme.example.test/v1',
              type: 'openai',
              models: { m1: { id: 'm1', name: 'M1' } },
            },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const svc = ModelCatalogService._createForTest(makeEnv(), core, authFacade());

    await svc.refreshProviderModels();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.example.test/api.json',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'multiai-cli/test' }),
      }),
    );
  });
});
