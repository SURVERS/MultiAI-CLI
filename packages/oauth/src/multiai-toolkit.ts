import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  MULTIAI_OAUTH_KEY,
  MULTIAI_PROVIDER_NAME,
  resolveMultiAIOAuthConfig,
} from './multiai-constants';
import { MultiAIOAuthManager, type MultiAIOAuthManagerOptions } from './multiai-manager';
import type {
  MultiAIAccountSnapshot,
  MultiAIIdentity,
  MultiAILoginOptions,
  MultiAILoginResult,
  MultiAILogoutResult,
  MultiAIModelInfo,
  MultiAIOAuthTokenRef,
} from './multiai-types';

export interface BearerTokenProvider {
  getAccessToken(options?: { readonly force?: boolean }): Promise<string>;
}

export interface MultiAIOAuthToolkitOptions {
  readonly homeDir?: string;
  readonly config?: MultiAIOAuthManagerOptions['config'];
  readonly fetchImpl?: typeof fetch;
  readonly keyringStorage?: MultiAIOAuthManagerOptions['keyringStorage'];
  readonly memoryStorage?: MultiAIOAuthManagerOptions['memoryStorage'];
  readonly now?: MultiAIOAuthManagerOptions['now'];
  readonly sleep?: MultiAIOAuthManagerOptions['sleep'];
}

export interface MultiAIAuthStatus {
  readonly providerName: typeof MULTIAI_PROVIDER_NAME;
  readonly loggedIn: boolean;
  readonly identity?: MultiAIIdentity;
}

export class MultiAIOAuthToolkit {
  private readonly manager: MultiAIOAuthManager;

  constructor(options: MultiAIOAuthToolkitOptions = {}) {
    this.manager = new MultiAIOAuthManager({
      config: options.config ?? resolveMultiAIOAuthConfig(),
      homeDir: options.homeDir ?? join(homedir(), '.multiai'),
      key: MULTIAI_OAUTH_KEY,
      fetchImpl: options.fetchImpl,
      keyringStorage: options.keyringStorage,
      memoryStorage: options.memoryStorage,
      now: options.now,
      sleep: options.sleep,
    });
  }

  async status(): Promise<MultiAIAuthStatus> {
    return {
      providerName: MULTIAI_PROVIDER_NAME,
      loggedIn: await this.manager.hasSession(),
      identity: this.manager.getIdentity(),
    };
  }

  login(options: MultiAILoginOptions = {}): Promise<MultiAILoginResult> {
    return this.manager.login(options);
  }

  logout(_tokenRef?: MultiAIOAuthTokenRef): Promise<MultiAILogoutResult> {
    return this.manager.logout();
  }

  getAccessToken(options?: { readonly force?: boolean }): Promise<string> {
    return this.manager.getAccessToken(options);
  }

  getCachedAccessToken(): string | undefined {
    return this.manager.getCachedAccessToken();
  }

  tokenProvider(_tokenRef?: MultiAIOAuthTokenRef): BearerTokenProvider {
    return { getAccessToken: (options) => this.manager.getAccessToken(options) };
  }

  getAccountSnapshot(): Promise<MultiAIAccountSnapshot> {
    return this.manager.getAccountSnapshot();
  }

  getModels(): Promise<readonly MultiAIModelInfo[]> {
    return this.manager.getModels();
  }

  invalidate(): Promise<void> {
    return this.manager.invalidate();
  }
}
