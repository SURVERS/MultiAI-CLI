/**
 * `auth` domain — MultiAI OAuth and auth-readiness implementation.
 */

import { randomUUID } from 'node:crypto';

import {
  MULTIAI_API_BASE_URL,
  MULTIAI_OAUTH_ISSUER,
  MULTIAI_OAUTH_KEY,
  MULTIAI_PROVIDER_NAME,
  MultiAIAccountUnavailableError,
  MultiAIOAuthError,
  MultiAIOAuthLoginRequiredError,
  MultiAIOAuthToolkit,
  applyManagedMultiAIConfig,
  clearManagedMultiAIConfig,
  type ManagedMultiAIConfigShape,
  type MultiAIAuthorization,
  type MultiAIBearerTokenProvider,
} from '@multiai/oauth';

import { Disposable } from '#/_base/di/lifecycle';
import { LifecycleScope, ScopeActivation, registerScopedService } from '#/_base/di/scope';
import { ILogService } from '#/_base/log/log';
import { IBootstrapService } from '#/app/bootstrap/bootstrap';
import { IConfigService } from '#/app/config/config';
import { IEventService } from '#/app/event/event';
import {
  DEFAULT_MODEL_SECTION,
  MODELS_SECTION,
  PROVIDERS_SECTION,
  THINKING_SECTION,
} from '#/app/kosongConfig/configSection';
import {
  deriveProviderId,
  effectiveModelConfig,
  nonEmpty,
  resolveModelAuthMaterial,
} from '#/kosong/model/modelAuth';
import { IModelService, type ModelRecord } from '#/kosong/model/model';
import {
  IProviderService,
  type OAuthRef,
  type ProviderConfig,
  type ProvidersChangedEvent,
} from '#/kosong/provider/provider';

import {
  AuthModelNotResolvedError,
  AuthProvisioningRequiredError,
  AuthTokenMissingError,
  type AuthStatus,
  IAuthSummaryService,
  IOAuthService,
  IOAuthToolkit,
  type OAuthLoginRequest,
} from './auth';
import type {
  OAuthFlowSnapshot,
  OAuthFlowStart,
  OAuthFlowStatus,
  OAuthLoginCancelResponse,
  OAuthLogoutResponse,
  RefreshOAuthProviderModelsResponse,
} from './oauthProtocol';

const FLOW_TIMEOUT_MS = 10 * 60 * 1000;
const TERMINAL_RETENTION_MS = 5 * 60 * 1000;

interface FlowState {
  readonly flowId: string;
  readonly provider: string;
  readonly method: 'browser' | 'device';
  readonly persistence: 'keyring' | 'session';
  readonly controller: AbortController;
  authorization: MultiAIAuthorization | undefined;
  status: OAuthFlowStatus;
  expiresAt: number;
  errorMessage: string | undefined;
  resolvedAt: string | undefined;
  gcTimer: ReturnType<typeof setTimeout> | undefined;
}

export class OAuthService extends Disposable implements IOAuthService {
  declare readonly _serviceBrand: undefined;

  private readonly flows = new Map<string, FlowState>();
  private refreshChain: Promise<unknown> = Promise.resolve();

  constructor(
    @IOAuthToolkit private readonly toolkit: IOAuthToolkit,
    @IProviderService private readonly providers: IProviderService,
    @IConfigService private readonly config: IConfigService,
    @ILogService private readonly log: ILogService,
    @IEventService private readonly events: IEventService,
  ) {
    super();
    this._register(this.providers.onDidChangeProviders((event) => this.invalidateFlows(event)));
  }

  async startLogin(request: OAuthLoginRequest | string): Promise<OAuthFlowStart> {
    const normalized: OAuthLoginRequest =
      typeof request === 'string'
        ? { provider: request, method: 'device', persistence: 'keyring' }
        : request;
    const provider = normalized.provider ?? MULTIAI_PROVIDER_NAME;
    if (provider !== MULTIAI_PROVIDER_NAME) {
      throw new MultiAIOAuthError(
        'unsupported_provider',
        `OAuth login is not supported for provider "${provider}".`,
      );
    }
    this.abortExisting(provider);
    const state: FlowState = {
      flowId: `oauth_${randomUUID()}`,
      provider,
      method: normalized.method,
      persistence: normalized.persistence,
      controller: new AbortController(),
      authorization: undefined,
      status: 'pending',
      expiresAt: Date.now() + FLOW_TIMEOUT_MS,
      errorMessage: undefined,
      resolvedAt: undefined,
      gcTimer: undefined,
    };
    this.flows.set(provider, state);

    let resolveAuthorization!: (authorization: MultiAIAuthorization) => void;
    let rejectAuthorization!: (error: unknown) => void;
    const authorizationReady = new Promise<MultiAIAuthorization>((resolve, reject) => {
      resolveAuthorization = resolve;
      rejectAuthorization = reject;
    });
    const login = this.toolkit.login({
      method: normalized.method,
      persistence: normalized.persistence,
      signal: state.controller.signal,
      onAuthorization: (authorization) => {
        state.authorization = authorization;
        state.expiresAt = Date.now() + authorization.expiresIn * 1000;
        resolveAuthorization(authorization);
      },
    });
    login.then(
      () => void this.finalizeLogin(state),
      (error: unknown) => {
        this.handleFailure(state, error);
        rejectAuthorization(error);
      },
    );
    return this.toFlowStart(state, await authorizationReady);
  }

  getFlow(provider = MULTIAI_PROVIDER_NAME): OAuthFlowSnapshot | undefined {
    const state = this.flows.get(provider);
    if (state?.authorization === undefined) return undefined;
    return this.toSnapshot(state, state.authorization);
  }

  cancelLogin(provider = MULTIAI_PROVIDER_NAME): Promise<OAuthLoginCancelResponse> {
    const state = this.flows.get(provider);
    if (state === undefined || state.status !== 'pending') {
      return Promise.resolve({ cancelled: false, status: state?.status ?? 'cancelled' });
    }
    state.controller.abort();
    this.setTerminal(state, 'cancelled');
    return Promise.resolve({ cancelled: true, status: 'cancelled' });
  }

  async logout(provider = MULTIAI_PROVIDER_NAME): Promise<OAuthLogoutResponse> {
    await this.toolkit.logout(this.oauthRef(provider));
    this.abortExisting(provider);
    await this.deprovision();
    return { logged_out: true, provider };
  }

  async status(provider = MULTIAI_PROVIDER_NAME): Promise<AuthStatus> {
    if (provider !== MULTIAI_PROVIDER_NAME) return { loggedIn: false };
    try {
      const status = await this.toolkit.status();
      return {
        loggedIn: status.loggedIn,
        provider: status.loggedIn ? provider : undefined,
        identity: status.identity,
      };
    } catch (error) {
      if (error instanceof MultiAIOAuthLoginRequiredError) return { loggedIn: false };
      throw error;
    }
  }

  resolveTokenProvider(
    provider: string,
    oauthRef?: OAuthRef,
  ): MultiAIBearerTokenProvider | undefined {
    if (provider !== MULTIAI_PROVIDER_NAME) return undefined;
    const tokenProvider = this.toolkit.tokenProvider(toMultiAITokenRef(oauthRef));
    return {
      getAccessToken: async (options) => {
        try {
          return await tokenProvider.getAccessToken(options);
        } catch (error) {
          if (
            error instanceof MultiAIOAuthLoginRequiredError ||
            error instanceof MultiAIAccountUnavailableError
          ) {
            await this.deprovision();
          }
          throw error;
        }
      },
    };
  }

  async getCachedAccessToken(provider: string, oauthRef?: OAuthRef): Promise<string | undefined> {
    if (provider !== MULTIAI_PROVIDER_NAME) return undefined;
    const cached = this.toolkit.getCachedAccessToken();
    if (cached !== undefined) return cached;
    try {
      return await this.toolkit.tokenProvider(toMultiAITokenRef(oauthRef)).getAccessToken();
    } catch (error) {
      if (
        error instanceof MultiAIOAuthLoginRequiredError ||
        error instanceof MultiAIAccountUnavailableError
      ) {
        await this.deprovision();
        return undefined;
      }
      throw error;
    }
  }

  async getAccount(provider = MULTIAI_PROVIDER_NAME) {
    if (provider !== MULTIAI_PROVIDER_NAME) {
      throw new MultiAIOAuthLoginRequiredError();
    }
    try {
      return await this.toolkit.getAccountSnapshot();
    } catch (error) {
      if (
        error instanceof MultiAIOAuthLoginRequiredError ||
        error instanceof MultiAIAccountUnavailableError
      ) {
        await this.deprovision();
      }
      throw error;
    }
  }

  refreshOAuthProviderModels(): Promise<RefreshOAuthProviderModelsResponse> {
    const run = this.refreshChain.then(() => this.doRefreshOAuthProviderModels());
    this.refreshChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async doRefreshOAuthProviderModels(): Promise<RefreshOAuthProviderModelsResponse> {
    await this.config.reload();
    const current = this.readConfig();
    if (current.providers[MULTIAI_PROVIDER_NAME] === undefined) {
      return { changed: [], unchanged: [], failed: [] };
    }
    try {
      const before = providerModelIds(current);
      const models = await this.toolkit.getModels();
      const next = structuredClone(current);
      applyManagedMultiAIConfig(next, models, {
        preserveDefaultModel: true,
        baseUrl: MULTIAI_API_BASE_URL,
        issuer: MULTIAI_OAUTH_ISSUER,
      });
      const after = providerModelIds(next);
      if (setsEqual(before, after)) {
        return { changed: [], unchanged: [MULTIAI_PROVIDER_NAME], failed: [] };
      }
      await this.writeConfig(next);
      const result: RefreshOAuthProviderModelsResponse = {
        changed: [
          {
            provider_id: MULTIAI_PROVIDER_NAME,
            provider_name: 'MultiAI',
            added: [...after].filter((id) => !before.has(id)).length,
            removed: [...before].filter((id) => !after.has(id)).length,
          },
        ],
        unchanged: [],
        failed: [],
      };
      this.events.publish({ type: 'event.model_catalog.changed', payload: result });
      return result;
    } catch (error) {
      if (
        error instanceof MultiAIOAuthLoginRequiredError ||
        error instanceof MultiAIAccountUnavailableError
      ) {
        await this.deprovision();
      }
      return {
        changed: [],
        unchanged: [],
        failed: [
          {
            provider: MULTIAI_PROVIDER_NAME,
            reason: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async finalizeLogin(state: FlowState): Promise<void> {
    if (state.status !== 'pending') return;
    try {
      const models = await this.toolkit.getModels();
      const next = structuredClone(this.readConfig());
      applyManagedMultiAIConfig(next, models, {
        preserveDefaultModel: true,
        baseUrl: MULTIAI_API_BASE_URL,
        issuer: MULTIAI_OAUTH_ISSUER,
      });
      await this.writeConfig(next);
      if (state.status === 'pending') this.setTerminal(state, 'authenticated');
    } catch (error) {
      this.handleFailure(state, error);
    }
  }

  private async deprovision(): Promise<void> {
    const next = structuredClone(this.readConfig());
    const cleanup = clearManagedMultiAIConfig(next);
    if (
      !cleanup.removedProvider &&
      cleanup.removedModels.length === 0 &&
      !cleanup.defaultModelCleared
    ) {
      return;
    }
    await this.writeConfig(next);
  }

  private readConfig(): ManagedMultiAIConfigShape {
    const providers =
      this.config.inspect<Record<string, ProviderConfig>>(PROVIDERS_SECTION).userValue ?? {};
    const models =
      this.config.inspect<Record<string, ModelRecord>>(MODELS_SECTION).userValue ?? {};
    return {
      providers: { ...providers } as ManagedMultiAIConfigShape['providers'],
      models: { ...models } as ManagedMultiAIConfigShape['models'],
      defaultModel: this.config.inspect<string>(DEFAULT_MODEL_SECTION).userValue,
      thinking:
        this.config.inspect<Record<string, unknown>>(THINKING_SECTION).userValue,
    };
  }

  private async writeConfig(config: ManagedMultiAIConfigShape): Promise<void> {
    await this.config.replace(PROVIDERS_SECTION, config.providers);
    await this.config.replace(MODELS_SECTION, config.models ?? {});
    await this.config.replace(DEFAULT_MODEL_SECTION, config.defaultModel);
    await this.config.replace(THINKING_SECTION, config.thinking);
  }

  private oauthRef(provider: string): OAuthRef | undefined {
    return provider === MULTIAI_PROVIDER_NAME
      ? this.providers.get(provider)?.oauth
      : undefined;
  }

  private abortExisting(provider: string): void {
    const state = this.flows.get(provider);
    if (state === undefined || state.status !== 'pending') return;
    state.controller.abort();
    this.setTerminal(state, 'cancelled');
  }

  private invalidateFlows(event: ProvidersChangedEvent): void {
    const changed = new Set([...event.changed, ...event.removed]);
    for (const state of this.flows.values()) {
      if (state.status !== 'pending' || !changed.has(state.provider)) continue;
      state.controller.abort();
      state.errorMessage = 'Provider configuration changed during login.';
      this.setTerminal(state, 'cancelled');
    }
  }

  private handleFailure(state: FlowState, error: unknown): void {
    if (state.status !== 'pending') return;
    state.errorMessage = error instanceof Error ? error.message : String(error);
    const status: OAuthFlowStatus =
      error instanceof MultiAIOAuthError && error.code === 'expired_token'
        ? 'expired'
        : error instanceof MultiAIOAuthError && error.code === 'cancelled'
          ? 'cancelled'
          : 'denied';
    this.setTerminal(state, status);
  }

  private setTerminal(state: FlowState, status: OAuthFlowStatus): void {
    state.status = status;
    state.resolvedAt = new Date().toISOString();
    const timer = setTimeout(() => {
      if (this.flows.get(state.provider) === state) this.flows.delete(state.provider);
    }, TERMINAL_RETENTION_MS);
    timer.unref();
    state.gcTimer = timer;
  }

  private toFlowStart(
    state: FlowState,
    authorization: MultiAIAuthorization,
  ): OAuthFlowStart {
    const common = {
      flow_id: state.flowId,
      provider: state.provider,
      persistence: state.persistence,
      status: 'pending' as const,
      expires_in: authorization.expiresIn,
      expires_at: new Date(state.expiresAt).toISOString(),
    };
    return authorization.method === 'browser'
      ? {
          ...common,
          method: 'browser',
          authorization_uri: authorization.authorizationUri,
          redirect_uri: authorization.redirectUri,
        }
      : {
          ...common,
          method: 'device',
          verification_uri: authorization.verificationUri,
          verification_uri_complete: authorization.verificationUriComplete,
          user_code: authorization.userCode,
          interval: authorization.interval,
        };
  }

  private toSnapshot(
    state: FlowState,
    authorization: MultiAIAuthorization,
  ): OAuthFlowSnapshot {
    const common = {
      flow_id: state.flowId,
      provider: state.provider,
      method: state.method,
      persistence: state.persistence,
      status: state.status,
      expires_in: authorization.expiresIn,
      expires_at: new Date(state.expiresAt).toISOString(),
      resolved_at: state.resolvedAt,
      error_message: state.errorMessage,
    };
    return authorization.method === 'browser'
      ? {
          ...common,
          authorization_uri: authorization.authorizationUri,
          redirect_uri: authorization.redirectUri,
        }
      : {
          ...common,
          verification_uri: authorization.verificationUri,
          verification_uri_complete: authorization.verificationUriComplete,
          user_code: authorization.userCode,
          interval: authorization.interval,
        };
  }
}

export class AuthSummaryService implements IAuthSummaryService {
  declare readonly _serviceBrand: undefined;

  constructor(
    @IProviderService private readonly providers: IProviderService,
    @IModelService private readonly models: IModelService,
    @IConfigService private readonly config: IConfigService,
    @IOAuthService private readonly oauth: IOAuthService,
  ) {}

  async summarize(): Promise<readonly AuthStatus[]> {
    return [await this.oauth.status()];
  }

  async ensureReady(modelOverride?: string): Promise<void> {
    await this.config.reload();
    const providers = this.providers.list();
    const models = this.models.list();
    const modelId = modelOverride ?? this.models.getDefaultModel();
    const configured = modelId === undefined || modelId === '' ? undefined : models[modelId];
    if (Object.keys(providers).length === 0 && !isProviderlessModel(configured)) {
      throw new AuthProvisioningRequiredError();
    }
    if (modelId === undefined || modelId === '') throw new AuthModelNotResolvedError(undefined);
    if (configured === undefined) throw new AuthModelNotResolvedError(modelId);

    const model = effectiveModelConfig(configured);
    const providerId = model.providerId ?? model.provider;
    const provider = providerId === undefined ? undefined : this.providers.get(providerId);
    if (providerId !== undefined && provider === undefined) {
      throw new AuthModelNotResolvedError(modelId, providerId);
    }
    const providerName = providerId ?? providerNameFromFlatModel(model);
    if (providerName === undefined) throw new AuthModelNotResolvedError(modelId);
    const auth = resolveModelAuthMaterial({ modelId, model, provider, providerName });
    if (auth.apiKey !== undefined) return;
    if (auth.oauth !== undefined) {
      const providerKey = auth.oauthProviderKey ?? providerName;
      const token = await this.oauth.getCachedAccessToken(providerKey, auth.oauth);
      if (nonEmpty(token) !== undefined) return;
      throw new AuthTokenMissingError(providerKey);
    }
    throw new AuthTokenMissingError(providerName);
  }
}

function toMultiAITokenRef(oauthRef: OAuthRef | undefined) {
  return {
    key: oauthRef?.key ?? MULTIAI_OAUTH_KEY,
    issuer: oauthRef?.issuer,
  };
}

function providerModelIds(config: ManagedMultiAIConfigShape): Set<string> {
  const ids = new Set<string>();
  for (const model of Object.values(config.models ?? {})) {
    const record = model as { provider?: unknown; model?: unknown };
    if (
      record.provider === MULTIAI_PROVIDER_NAME &&
      typeof record.model === 'string'
    ) {
      ids.add(record.model);
    }
  }
  return ids;
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isProviderlessModel(model: ModelRecord | undefined): boolean {
  if (model === undefined) return false;
  const effective = effectiveModelConfig(model);
  return (
    effective.providerId === undefined &&
    effective.provider === undefined &&
    providerNameFromFlatModel(effective) !== undefined
  );
}

function providerNameFromFlatModel(model: ModelRecord): string | undefined {
  const baseUrl = nonEmpty(model.baseUrl);
  return baseUrl === undefined ? undefined : deriveProviderId(baseUrl);
}

class OAuthToolkitService extends MultiAIOAuthToolkit implements IOAuthToolkit {
  declare readonly _serviceBrand: undefined;

  constructor(@IBootstrapService bootstrap: IBootstrapService) {
    super({ homeDir: bootstrap.homeDir });
  }
}

registerScopedService(
  LifecycleScope.App,
  IOAuthService,
  OAuthService,
  ScopeActivation.OnScopeCreated,
  'auth',
);
registerScopedService(
  LifecycleScope.App,
  IOAuthToolkit,
  OAuthToolkitService,
  ScopeActivation.OnScopeCreated,
  'auth',
);
registerScopedService(
  LifecycleScope.App,
  IAuthSummaryService,
  AuthSummaryService,
  ScopeActivation.OnScopeCreated,
  'auth',
);
