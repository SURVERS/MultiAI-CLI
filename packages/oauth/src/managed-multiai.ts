import {
  MULTIAI_API_BASE_URL,
  MULTIAI_OAUTH_ISSUER,
  MULTIAI_OAUTH_KEY,
  MULTIAI_PROVIDER_NAME,
} from './multiai-constants';
import type { MultiAIModelInfo } from './multiai-types';

export interface ManagedMultiAIOAuthRef {
  readonly storage: 'keyring';
  readonly key: string;
  readonly issuer?: string;
}

export interface ManagedMultiAIProviderConfig {
  type: 'multiai' | 'openai_responses';
  baseUrl: string;
  apiKey: '';
  oauth: ManagedMultiAIOAuthRef;
  readonly [key: string]: unknown;
}

export interface ManagedMultiAIModelAlias {
  provider: typeof MULTIAI_PROVIDER_NAME;
  model: string;
  readonly [key: string]: unknown;
}

export interface ManagedMultiAIConfigShape {
  providers: Record<string, Record<string, unknown> | ManagedMultiAIProviderConfig>;
  models?: Record<string, Record<string, unknown> | ManagedMultiAIModelAlias>;
  defaultModel?: string;
  thinking?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ManagedMultiAIApplyResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly modelAliases: readonly string[];
  readonly defaultModel?: string;
}

export interface ManagedMultiAICleanupResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly removedProvider: boolean;
  readonly removedModels: readonly string[];
  readonly defaultModelCleared: boolean;
}

export function multiAIModelAlias(modelId: string): string {
  return `multiai/${modelId}`;
}

export function applyManagedMultiAIConfig(
  config: ManagedMultiAIConfigShape,
  models: readonly MultiAIModelInfo[],
  options: {
    readonly baseUrl?: string;
    readonly issuer?: string;
    readonly preserveDefaultModel?: boolean;
    readonly providerType?: ManagedMultiAIProviderConfig['type'];
  } = {},
): ManagedMultiAIApplyResult {
  const baseUrl = (options.baseUrl ?? MULTIAI_API_BASE_URL).replace(/\/+$/, '');
  const issuer = (options.issuer ?? MULTIAI_OAUTH_ISSUER).replace(/\/+$/, '');
  config.providers[MULTIAI_PROVIDER_NAME] = {
    type: options.providerType ?? 'multiai',
    baseUrl,
    apiKey: '',
    oauth: {
      storage: 'keyring',
      key: MULTIAI_OAUTH_KEY,
      issuer: issuer === MULTIAI_OAUTH_ISSUER ? undefined : issuer,
    },
  };

  const nextModels = { ...config.models };
  const incomingAliases = new Set(models.map(({ id }) => multiAIModelAlias(id)));
  for (const [alias, model] of Object.entries(nextModels)) {
    if (
      alias.startsWith('multiai/') &&
      (model as { provider?: unknown }).provider === MULTIAI_PROVIDER_NAME &&
      !incomingAliases.has(alias)
    ) {
      delete nextModels[alias];
    }
  }
  for (const model of models) {
    nextModels[multiAIModelAlias(model.id)] = {
      provider: MULTIAI_PROVIDER_NAME,
      model: model.id,
    };
  }
  config.models = nextModels;

  const defaultIsValid =
    config.defaultModel !== undefined && nextModels[config.defaultModel] !== undefined;
  if (!(options.preserveDefaultModel === true && defaultIsValid)) {
    config.defaultModel = models[0] === undefined ? undefined : multiAIModelAlias(models[0].id);
  }
  if (config.defaultModel === undefined) config.thinking = undefined;

  return {
    providerName: MULTIAI_PROVIDER_NAME,
    modelAliases: [...incomingAliases],
    defaultModel: config.defaultModel,
  };
}

export function clearManagedMultiAIConfig(
  config: ManagedMultiAIConfigShape,
): ManagedMultiAICleanupResult {
  const removedProvider = Object.hasOwn(config.providers, MULTIAI_PROVIDER_NAME);
  delete config.providers[MULTIAI_PROVIDER_NAME];
  const removedModels: string[] = [];
  for (const [alias, model] of Object.entries(config.models ?? {})) {
    if ((model as { provider?: unknown }).provider !== MULTIAI_PROVIDER_NAME) continue;
    delete config.models?.[alias];
    removedModels.push(alias);
  }
  const defaultModelCleared =
    config.defaultModel !== undefined && removedModels.includes(config.defaultModel);
  if (defaultModelCleared) {
    config.defaultModel = undefined;
    config.thinking = undefined;
  }
  return {
    providerName: MULTIAI_PROVIDER_NAME,
    removedProvider,
    removedModels,
    defaultModelCleared,
  };
}
