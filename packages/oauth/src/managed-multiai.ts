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
  maxContextSize?: number;
  capabilities?: readonly string[];
  supportEfforts?: readonly string[];
  defaultEffort?: string;
  protocol?: 'anthropic' | 'openai';
  betaApi?: boolean;
  adaptiveThinking?: boolean;
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

export interface ManagedMultiAIModelProfile {
  readonly capabilities: readonly string[];
  readonly supportEfforts?: readonly string[];
  readonly defaultEffort?: string;
  readonly protocol?: 'anthropic' | 'openai';
  readonly betaApi?: boolean;
  readonly adaptiveThinking?: boolean;
}

const THINKING_CAPABILITY = ['thinking'] as const;
const ALWAYS_THINKING_CAPABILITY = ['always_thinking'] as const;
const LOW_MEDIUM_HIGH = ['low', 'medium', 'high'] as const;
const LOW_MEDIUM_HIGH_MAX = ['low', 'medium', 'high', 'max'] as const;
const LOW_MEDIUM_HIGH_XHIGH = ['low', 'medium', 'high', 'xhigh'] as const;
const LOW_MEDIUM_HIGH_XHIGH_MAX = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const MINIMAL_LOW_MEDIUM_HIGH = ['minimal', 'low', 'medium', 'high'] as const;
const HIGH_MAX = ['high', 'max'] as const;

const MANAGED_MODEL_PROFILES: Readonly<Record<string, ManagedMultiAIModelProfile>> = {
  'gpt-5.4': effortProfile(LOW_MEDIUM_HIGH_XHIGH, 'high'),
  'gpt-5.4-mini': effortProfile(LOW_MEDIUM_HIGH_XHIGH, 'high'),
  'gpt-5.5': effortProfile(LOW_MEDIUM_HIGH_XHIGH, 'high'),
  'gpt-5.6-luna': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'gpt-5.6-sol': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'gpt-5.6-terra': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'gpt-oss-120b': effortProfile(LOW_MEDIUM_HIGH, 'medium'),
  'claude-haiku-4-5': effortProfile(LOW_MEDIUM_HIGH, 'high'),
  'claude-opus-4-6': effortProfile(LOW_MEDIUM_HIGH_MAX, 'high'),
  'claude-opus-4-7': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'claude-opus-4-8': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'claude-opus-5': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'claude-sonnet-4-6': effortProfile(LOW_MEDIUM_HIGH_MAX, 'high'),
  'claude-sonnet-5': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high'),
  'claude-fable-5': effortProfile(LOW_MEDIUM_HIGH_XHIGH_MAX, 'high', true),
  'gemini-3.1-pro': openAIGatewayProfile(LOW_MEDIUM_HIGH, 'high'),
  'gemini-3.5-flash': openAIGatewayProfile(MINIMAL_LOW_MEDIUM_HIGH, 'high'),
  'gemini-3.6-flash': openAIGatewayProfile(MINIMAL_LOW_MEDIUM_HIGH, 'high'),
  'deepseek-v4-flash': effortProfile(HIGH_MAX, 'high'),
  'deepseek-v4-pro': effortProfile(HIGH_MAX, 'high'),
  'glm-5.2': effortProfile(HIGH_MAX, 'high'),
  'grok-4.5': effortProfile(LOW_MEDIUM_HIGH, 'medium'),
  'minimax-m3': effortProfile(LOW_MEDIUM_HIGH_MAX, 'high'),
  'mimo-v2.5': { capabilities: THINKING_CAPABILITY },
  'mimo-v2.5-pro': { capabilities: THINKING_CAPABILITY },
  'nemotron-3-ultra': { capabilities: THINKING_CAPABILITY },
};

function effortProfile(
  supportEfforts: readonly string[],
  defaultEffort: string,
  alwaysThinking = false,
): ManagedMultiAIModelProfile {
  return {
    capabilities: alwaysThinking ? ALWAYS_THINKING_CAPABILITY : THINKING_CAPABILITY,
    supportEfforts,
    defaultEffort,
  };
}

function openAIGatewayProfile(
  supportEfforts: readonly string[],
  defaultEffort: string,
): ManagedMultiAIModelProfile {
  return {
    ...effortProfile(supportEfforts, defaultEffort, true),
    protocol: 'openai',
  };
}

/**
 * MultiAI's OpenAI-compatible `/v1/models` response is intentionally sparse,
 * so the native client supplies the reasoning controls that are part of the
 * public managed-model contract. `ma-` aliases route to the same underlying
 * model and therefore share its profile.
 */
export function managedMultiAIModelProfile(
  modelId: string,
): ManagedMultiAIModelProfile | undefined {
  const canonicalId = modelId.startsWith('ma-') ? modelId.slice(3) : modelId;
  return MANAGED_MODEL_PROFILES[canonicalId];
}

/**
 * Enriches sparse managed aliases already stored by an older CLI. Explicit
 * reasoning metadata normally wins; mandatory-thinking capability and the
 * tool-history transport remain authoritative for managed models.
 */
export function applyManagedMultiAIModelProfiles(config: ManagedMultiAIConfigShape): boolean {
  const models = config.models;
  if (models === undefined) return false;
  let changed = false;
  for (const [alias, rawModel] of Object.entries(models)) {
    const model = rawModel as ManagedMultiAIModelAlias;
    if (model.provider !== MULTIAI_PROVIDER_NAME) continue;
    const profile = managedMultiAIModelProfile(model.model);
    if (profile === undefined) continue;
    const next = { ...model };
    const profileAlwaysThinks = profile.capabilities.includes('always_thinking');
    const modelAlwaysThinks = model.capabilities?.some(
      (capability) => capability.trim().toLowerCase() === 'always_thinking',
    );
    if (model.capabilities === undefined) {
      next.capabilities = profile.capabilities;
    } else if (profileAlwaysThinks && modelAlwaysThinks !== true) {
      next.capabilities = [
        ...model.capabilities.filter((capability) => {
          const normalized = capability.trim().toLowerCase();
          return normalized !== 'thinking' && normalized !== 'always_thinking';
        }),
        'always_thinking',
      ];
    }
    if (model.supportEfforts === undefined && profile.supportEfforts !== undefined) {
      next.supportEfforts = profile.supportEfforts;
    }
    if (model.defaultEffort === undefined && profile.defaultEffort !== undefined) {
      next.defaultEffort = profile.defaultEffort;
    }
    if (profile.protocol !== undefined && model.protocol !== profile.protocol) {
      next.protocol = profile.protocol;
    }
    if (profile.protocol !== undefined && model.betaApi !== profile.betaApi) {
      next.betaApi = profile.betaApi;
    }
    if (profile.protocol !== undefined && model.adaptiveThinking !== profile.adaptiveThinking) {
      next.adaptiveThinking = profile.adaptiveThinking;
    }
    if (
      next.capabilities !== model.capabilities ||
      next.supportEfforts !== model.supportEfforts ||
      next.defaultEffort !== model.defaultEffort ||
      next.protocol !== model.protocol ||
      next.betaApi !== model.betaApi ||
      next.adaptiveThinking !== model.adaptiveThinking
    ) {
      models[alias] = next;
      changed = true;
    }
  }
  return changed;
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
  const previousDefaultModel = config.defaultModel;
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
    const profile = managedMultiAIModelProfile(model.id);
    nextModels[multiAIModelAlias(model.id)] = {
      provider: MULTIAI_PROVIDER_NAME,
      model: model.id,
      maxContextSize: model.contextLength,
      capabilities: model.capabilities ?? profile?.capabilities,
      supportEfforts: model.supportEfforts ?? profile?.supportEfforts,
      defaultEffort: model.defaultEffort ?? profile?.defaultEffort,
      protocol: profile?.protocol,
      betaApi: profile?.betaApi,
      adaptiveThinking: profile?.adaptiveThinking,
    };
  }
  config.models = nextModels;

  const defaultIsValid =
    config.defaultModel !== undefined && nextModels[config.defaultModel] !== undefined;
  if (!(options.preserveDefaultModel === true && defaultIsValid)) {
    config.defaultModel =
      models[0] === undefined ? Object.keys(nextModels)[0] : multiAIModelAlias(models[0].id);
  }
  if (config.defaultModel !== previousDefaultModel || config.defaultModel === undefined) {
    config.thinking = undefined;
  }

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
