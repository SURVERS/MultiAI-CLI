export type ProviderDiscoveryProtocol = 'kimi' | 'anthropic';

export type ProviderDiscoveryThinkingSupport = 'only' | 'no' | 'both';

export interface ProviderDiscoveryModelInfo {
  readonly id: string;
  readonly contextLength: number;
  readonly supportsReasoning: boolean;
  readonly supportsImageIn: boolean;
  readonly supportsVideoIn: boolean;
  readonly supportsToolUse?: boolean;
  readonly supportsThinkingType?: ProviderDiscoveryThinkingSupport;
  readonly supportEfforts?: readonly string[];
  readonly defaultEffort?: string;
  readonly displayName?: string;
  readonly protocol?: ProviderDiscoveryProtocol;
}

export interface ProviderDiscoveryOAuthRef {
  readonly storage: 'keyring';
  readonly key: string;
  readonly issuer?: string;
}

export interface ProviderDiscoveryProviderConfig {
  type?: string;
  baseUrl?: string;
  apiKey?: string;
  oauth?: ProviderDiscoveryOAuthRef;
  env?: Record<string, string>;
  source?: unknown;
  readonly [key: string]: unknown;
}

export interface ProviderDiscoveryModelAliasOverrides {
  maxContextSize?: number;
  maxOutputSize?: number;
  capabilities?: string[];
  displayName?: string;
  reasoningKey?: string;
  adaptiveThinking?: boolean;
  supportEfforts?: readonly string[];
  defaultEffort?: string;
  readonly [key: string]: unknown;
}

export interface ProviderDiscoveryModelAlias {
  provider: string;
  model: string;
  maxContextSize: number;
  capabilities?: string[];
  supportEfforts?: readonly string[];
  defaultEffort?: string;
  displayName?: string;
  protocol?: ProviderDiscoveryProtocol;
  betaApi?: boolean;
  adaptiveThinking?: boolean;
  overrides?: ProviderDiscoveryModelAliasOverrides;
  readonly [key: string]: unknown;
}

export interface ProviderDiscoveryConfigShape {
  providers: Record<string, ProviderDiscoveryProviderConfig | Record<string, unknown>>;
  models?: Record<string, ProviderDiscoveryModelAlias | Record<string, unknown>>;
  defaultModel?: string;
  defaultProvider?: string;
  thinking?: {
    enabled?: boolean;
    effort?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function parseSupportsThinkingType(
  value: unknown,
): ProviderDiscoveryThinkingSupport | undefined {
  return value === 'only' || value === 'no' || value === 'both' ? value : undefined;
}

export function parseThinkEfforts(value: unknown): {
  supportEfforts: readonly string[] | undefined;
  defaultEffort: string | undefined;
} {
  if (value === null || typeof value !== 'object') {
    return { supportEfforts: undefined, defaultEffort: undefined };
  }
  const record = value as Record<string, unknown>;
  if (record['support'] !== true) {
    return { supportEfforts: undefined, defaultEffort: undefined };
  }
  const rawEfforts = record['valid_efforts'];
  const supportEfforts = Array.isArray(rawEfforts)
    ? rawEfforts.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.length > 0,
      )
    : undefined;
  const rawDefault = record['default_effort'];
  return {
    supportEfforts:
      supportEfforts !== undefined && supportEfforts.length > 0 ? supportEfforts : undefined,
    defaultEffort:
      typeof rawDefault === 'string' && rawDefault.length > 0 ? rawDefault : undefined,
  };
}
