import {
  readConfigFile,
  readConfigFileForUpdate,
  writeConfigFile,
  type MultiAIConfig,
  type OAuthRef,
} from '@multiai/agent-core';
import {
  MULTIAI_API_BASE_URL,
  MULTIAI_OAUTH_ISSUER,
  MULTIAI_OAUTH_KEY,
  MULTIAI_PROVIDER_NAME,
  MultiAIAccountUnavailableError,
  MultiAIOAuthLoginRequiredError,
  MultiAIOAuthToolkit,
  applyManagedMultiAIConfig,
  clearManagedMultiAIConfig,
  type ManagedMultiAIConfigShape,
  type MultiAIAccountSnapshot,
  type MultiAIAuthStatus,
  type MultiAIBearerTokenProvider,
  type MultiAILoginOptions,
  type MultiAIOAuthTokenRef,
} from '@multiai/oauth';

import { mapOAuthTokenError } from '#/oauth-error';

export type MultiAIAuthLoginOptions = MultiAILoginOptions;

export interface MultiAIAuthLoginResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly ok: true;
  readonly defaultModel?: string;
  readonly configPath: string;
  readonly persistence: 'keyring' | 'session';
}

export interface MultiAIAuthLogoutResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly ok: true;
}

/** @deprecated MultiAI CLI does not expose the legacy feedback backend. */
export interface MultiAIAuthSubmitFeedbackInput {
  readonly content: string;
  readonly sessionId: string;
  readonly version: string;
  readonly os: string;
  readonly model: string | null;
}

/** @deprecated MultiAI CLI does not expose the legacy feedback backend. */
export interface MultiAIAuthCreateFeedbackUploadUrlInput {
  readonly feedbackId: number;
  readonly filename: string;
  readonly size: number;
  readonly sha256: string;
}

/** @deprecated MultiAI CLI does not expose the legacy feedback backend. */
export interface MultiAIAuthCompleteFeedbackUploadInput {
  readonly uploadId: number;
  readonly parts: readonly { readonly partNumber: number; readonly etag: string }[];
}

export type DisabledFeedbackResult =
  | { readonly kind: 'ok'; readonly feedbackId: number }
  | { readonly kind: 'error'; readonly status?: number; readonly message: string };

export type DisabledFeedbackUploadResult =
  | {
      readonly kind: 'ok';
      readonly uploadId: number;
      readonly parts: readonly {
        readonly partNumber: number;
        readonly url: string;
        readonly method: string;
        readonly size: number;
      }[];
    }
  | { readonly kind: 'error'; readonly status?: number; readonly message: string };

export type DisabledFeedbackCompleteResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'error'; readonly status?: number; readonly message: string };

export interface MultiAIAuthFacadeOptions {
  readonly homeDir: string;
  readonly configPath: string;
  readonly onConfigUpdated?: (config: MultiAIConfig) => void;
}

type SDKManagedConfig = MultiAIConfig & ManagedMultiAIConfigShape;

export class MultiAIAuthFacade {
  private readonly toolkit: MultiAIOAuthToolkit;

  constructor(private readonly options: MultiAIAuthFacadeOptions) {
    this.toolkit = new MultiAIOAuthToolkit({ homeDir: options.homeDir });
  }

  status(): Promise<MultiAIAuthStatus> {
    return this.toolkit.status();
  }

  async login(options: MultiAIAuthLoginOptions = {}): Promise<MultiAIAuthLoginResult> {
    const result = await this.toolkit.login(options);
    const models = await this.toolkit.getModels();
    const config = readConfigFileForUpdate(this.options.configPath) as SDKManagedConfig;
    const applied = applyManagedMultiAIConfig(config, models, {
      baseUrl: MULTIAI_API_BASE_URL,
      issuer: MULTIAI_OAUTH_ISSUER,
      preserveDefaultModel: true,
      providerType: 'openai_responses',
    });
    await writeConfigFile(this.options.configPath, config);
    this.options.onConfigUpdated?.(readConfigFile(this.options.configPath));
    return {
      providerName: MULTIAI_PROVIDER_NAME,
      ok: true,
      defaultModel: applied.defaultModel,
      configPath: this.options.configPath,
      persistence: result.persistence,
    };
  }

  async logout(): Promise<MultiAIAuthLogoutResult> {
    await this.toolkit.logout(this.tokenRef());
    const config = readConfigFileForUpdate(this.options.configPath) as SDKManagedConfig;
    clearManagedMultiAIConfig(config);
    await writeConfigFile(this.options.configPath, config);
    this.options.onConfigUpdated?.(readConfigFile(this.options.configPath));
    return { providerName: MULTIAI_PROVIDER_NAME, ok: true };
  }

  getAccount(): Promise<MultiAIAccountSnapshot> {
    return this.toolkit.getAccountSnapshot().catch(async (error: unknown) => {
      if (isSignedOutError(error)) await this.deprovision();
      throw error;
    });
  }

  /** @deprecated The in-product feedback integration is disabled. */
  async submitFeedback(
    _input: MultiAIAuthSubmitFeedbackInput,
  ): Promise<DisabledFeedbackResult> {
    return { kind: 'error', message: 'In-product feedback is disabled.' };
  }

  /** @deprecated The in-product feedback integration is disabled. */
  async createFeedbackUploadUrl(
    _input: MultiAIAuthCreateFeedbackUploadUrlInput,
  ): Promise<DisabledFeedbackUploadResult> {
    return { kind: 'error', message: 'In-product feedback is disabled.' };
  }

  /** @deprecated The in-product feedback integration is disabled. */
  async completeFeedbackUpload(
    _input: MultiAIAuthCompleteFeedbackUploadInput,
  ): Promise<DisabledFeedbackCompleteResult> {
    return { kind: 'error', message: 'In-product feedback is disabled.' };
  }

  async getCachedAccessToken(
    providerName?: string,
    _oauthRef?: OAuthRef,
  ): Promise<string | undefined> {
    if ((providerName ?? MULTIAI_PROVIDER_NAME) !== MULTIAI_PROVIDER_NAME) return undefined;
    const cached = this.toolkit.getCachedAccessToken();
    if (cached !== undefined) return cached;
    try {
      return await this.toolkit.getAccessToken();
    } catch (error) {
      if (isSignedOutError(error)) await this.deprovision();
      return undefined;
    }
  }

  readonly resolveOAuthTokenProvider = (
    providerName: string,
    oauthRef?: OAuthRef,
  ): MultiAIBearerTokenProvider => {
    if (providerName !== MULTIAI_PROVIDER_NAME) {
      return {
        getAccessToken: async () => {
          const error = new Error('OAuth provider is not supported.');
          throw mapOAuthTokenError(error, providerName) ?? error;
        },
      };
    }
    const provider = this.toolkit.tokenProvider(toTokenRef(oauthRef));
    return {
      getAccessToken: async (options) => {
        try {
          return await provider.getAccessToken(options);
        } catch (error) {
          if (isSignedOutError(error)) await this.deprovision();
          throw mapOAuthTokenError(error, providerName) ?? error;
        }
      },
      invalidate: async () => {
        await this.toolkit.invalidate();
        await this.deprovision();
      },
    };
  };

  private async deprovision(): Promise<void> {
    const config = readConfigFileForUpdate(this.options.configPath) as SDKManagedConfig;
    const cleanup = clearManagedMultiAIConfig(config);
    if (
      !cleanup.removedProvider &&
      cleanup.removedModels.length === 0 &&
      !cleanup.defaultModelCleared
    ) {
      return;
    }
    await writeConfigFile(this.options.configPath, config);
    this.options.onConfigUpdated?.(readConfigFile(this.options.configPath));
  }

  private tokenRef(): MultiAIOAuthTokenRef {
    return { key: MULTIAI_OAUTH_KEY, issuer: MULTIAI_OAUTH_ISSUER };
  }
}

function isSignedOutError(error: unknown): boolean {
  return (
    error instanceof MultiAIOAuthLoginRequiredError ||
    error instanceof MultiAIAccountUnavailableError
  );
}

function toTokenRef(oauthRef: OAuthRef | undefined): MultiAIOAuthTokenRef {
  const record = oauthRef as unknown as { key?: string; issuer?: string } | undefined;
  return {
    key: record?.key ?? MULTIAI_OAUTH_KEY,
    issuer: record?.issuer ?? MULTIAI_OAUTH_ISSUER,
  };
}
