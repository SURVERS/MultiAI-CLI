import { readConfigFile, readConfigFileForUpdate, writeConfigFile } from '../../config';
import type { MultiAIConfig, OAuthRef } from '../../config';
import type { OAuthTokenProviderResolver } from '../../session/provider-manager';
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
  type MultiAIAuthorization,
  type MultiAIBearerTokenProvider,
  type MultiAILoginOptions,
  type MultiAIOAuthTokenRef,
} from '@multiai/oauth';

import type { IEnvironmentService } from '../environment/environment';

type ServicesManagedConfig = MultiAIConfig & ManagedMultiAIConfigShape;
export type ServicesAuthLoginOptions = MultiAILoginOptions;

interface ServicesAuthLoginResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly ok: true;
  readonly defaultModel?: string;
  readonly defaultThinking: false;
  readonly configPath: string;
}

interface ServicesAuthLogoutResult {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly ok: true;
}

export interface ServicesAuthFacade {
  login(
    providerName?: string,
    options?: ServicesAuthLoginOptions,
  ): Promise<ServicesAuthLoginResult>;
  logout(providerName?: string): Promise<ServicesAuthLogoutResult>;
  getCachedAccessToken(
    providerName?: string,
    oauthRef?: OAuthRef,
  ): Promise<string | undefined>;
  readonly resolveOAuthTokenProvider: OAuthTokenProviderResolver;
}

class ServicesManagedAuthFacade implements ServicesAuthFacade {
  private readonly toolkit: MultiAIOAuthToolkit;

  constructor(
    private readonly options: Pick<IEnvironmentService, 'homeDir' | 'configPath'>,
  ) {
    this.toolkit = new MultiAIOAuthToolkit({ homeDir: options.homeDir });
  }

  async login(
    providerName = MULTIAI_PROVIDER_NAME,
    options: ServicesAuthLoginOptions = {},
  ): Promise<ServicesAuthLoginResult> {
    assertManagedProvider(providerName);
    await this.toolkit.login(options);
    const models = await this.toolkit.getModels();
    const config = readConfigFileForUpdate(this.options.configPath) as ServicesManagedConfig;
    const applied = applyManagedMultiAIConfig(config, models, {
      baseUrl: MULTIAI_API_BASE_URL,
      issuer: MULTIAI_OAUTH_ISSUER,
      preserveDefaultModel: true,
      providerType: 'openai_responses',
    });
    await writeConfigFile(this.options.configPath, config);
    return {
      providerName: MULTIAI_PROVIDER_NAME,
      ok: true,
      defaultModel: applied.defaultModel,
      defaultThinking: false,
      configPath: this.options.configPath,
    };
  }

  async logout(providerName = MULTIAI_PROVIDER_NAME): Promise<ServicesAuthLogoutResult> {
    assertManagedProvider(providerName);
    await this.toolkit.logout(this.tokenRef());
    const config = readConfigFileForUpdate(this.options.configPath) as ServicesManagedConfig;
    clearManagedMultiAIConfig(config);
    await writeConfigFile(this.options.configPath, config);
    return { providerName: MULTIAI_PROVIDER_NAME, ok: true };
  }

  async getCachedAccessToken(
    providerName = MULTIAI_PROVIDER_NAME,
    _oauthRef?: OAuthRef,
  ): Promise<string | undefined> {
    if (providerName !== MULTIAI_PROVIDER_NAME) return undefined;
    const cached = this.toolkit.getCachedAccessToken();
    if (cached !== undefined) return cached;
    try {
      return await this.toolkit.tokenProvider(this.tokenRef()).getAccessToken();
    } catch (error) {
      if (isSignedOutError(error)) await this.deprovision();
      return undefined;
    }
  }

  readonly resolveOAuthTokenProvider = (
    providerName: string,
    _oauthRef?: OAuthRef,
  ): MultiAIBearerTokenProvider | undefined => {
    if (providerName !== MULTIAI_PROVIDER_NAME) return undefined;
    const tokenProvider = this.toolkit.tokenProvider(this.tokenRef());
    return {
      getAccessToken: async (options) => {
        try {
          return await tokenProvider.getAccessToken(options);
        } catch (error) {
          if (isSignedOutError(error)) await this.deprovision();
          throw error;
        }
      },
      invalidate: async () => {
        await this.toolkit.invalidate();
        await this.deprovision();
      },
    };
  };

  private async deprovision(): Promise<void> {
    const config = readConfigFileForUpdate(this.options.configPath) as ServicesManagedConfig;
    const cleanup = clearManagedMultiAIConfig(config);
    if (
      !cleanup.removedProvider &&
      cleanup.removedModels.length === 0 &&
      !cleanup.defaultModelCleared
    ) {
      return;
    }
    await writeConfigFile(this.options.configPath, config);
  }

  private tokenRef(): MultiAIOAuthTokenRef {
    const provider = readConfigFile(this.options.configPath).providers[MULTIAI_PROVIDER_NAME];
    return {
      key: provider?.oauth?.key ?? MULTIAI_OAUTH_KEY,
      issuer: provider?.oauth?.issuer ?? MULTIAI_OAUTH_ISSUER,
    };
  }
}

function isSignedOutError(error: unknown): boolean {
  return (
    error instanceof MultiAIOAuthLoginRequiredError ||
    error instanceof MultiAIAccountUnavailableError
  );
}

function assertManagedProvider(providerName: string): void {
  if (providerName !== MULTIAI_PROVIDER_NAME) {
    throw new Error(`OAuth login is not supported for provider "${providerName}".`);
  }
}

export function createManagedAuthFacade(
  env: Pick<IEnvironmentService, 'homeDir' | 'configPath'>,
): ServicesAuthFacade {
  return new ServicesManagedAuthFacade(env);
}

export type { MultiAIAuthorization };
