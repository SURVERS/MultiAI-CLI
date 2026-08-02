/**
 * `auth` domain (cross-cutting) — app-scope OAuth + auth summary contracts.
 *
 * Defines the public contracts of authentication: the `AuthStatus` model, the
 * `IOAuthService` used to drive browser/device login, logout, flow inspection,
 * rejected-session invalidation, per-provider bearer tokens, and managed model
 * refresh, the `IOAuthToolkit` client that delegates the OAuth protocol, and
 * the `IAuthSummaryService` used to summarize auth state and provide the
 * prompt auth-readiness gate. App-scoped — shared across the application.
 */

import type {
  MultiAIAccountSnapshot,
  MultiAIAuthorization,
  MultiAIBearerTokenProvider,
  MultiAIIdentity,
  MultiAIAuthStatus,
  MultiAILoginResult,
  MultiAILogoutResult,
  MultiAIModelInfo,
  MultiAIOAuthPersistence,
  MultiAIOAuthTokenRef,
} from '@multiai/oauth';
import { createDecorator, type ServiceIdentifier } from '#/_base/di/instantiation';
import { Error2 } from '#/_base/errors/errors';

import type { OAuthRef } from '#/kosong/provider/provider';

import { AuthErrors } from './errors';
import type {
  OAuthFlowSnapshot,
  OAuthFlowStart,
  OAuthLoginCancelResponse,
  OAuthLogoutResponse,
  RefreshOAuthProviderModelsResponse,
} from './oauthProtocol';

export interface AuthStatus {
  readonly loggedIn: boolean;
  readonly provider?: string;
  readonly identity?: MultiAIIdentity;
  readonly persistence?: MultiAIOAuthPersistence;
}

export interface OAuthLoginRequest {
  readonly provider?: string;
  readonly method: 'browser' | 'device';
  readonly persistence: MultiAIOAuthPersistence;
}

export interface IOAuthService {
  readonly _serviceBrand: undefined;

  startLogin(request: OAuthLoginRequest | string): Promise<OAuthFlowStart>;
  getFlow(provider?: string): OAuthFlowSnapshot | undefined;
  cancelLogin(provider?: string): Promise<OAuthLoginCancelResponse>;
  logout(provider?: string): Promise<OAuthLogoutResponse>;
  status(provider?: string): Promise<AuthStatus>;
  refreshOAuthProviderModels(): Promise<RefreshOAuthProviderModelsResponse>;
  getAccount(provider?: string): Promise<MultiAIAccountSnapshot>;
  resolveTokenProvider(
    provider: string,
    oauthRef?: OAuthRef,
  ): MultiAIBearerTokenProvider | undefined;
  getCachedAccessToken(provider: string, oauthRef?: OAuthRef): Promise<string | undefined>;
  invalidate(provider?: string): Promise<void>;
}

export const IOAuthService: ServiceIdentifier<IOAuthService> =
  createDecorator<IOAuthService>('oauthService');

export interface IOAuthToolkit {
  readonly _serviceBrand: undefined;

  status(): Promise<MultiAIAuthStatus>;
  login(options: {
    readonly method: 'browser' | 'device';
    readonly persistence: MultiAIOAuthPersistence;
    readonly signal?: AbortSignal;
    readonly onAuthorization?: (authorization: MultiAIAuthorization) => Promise<void> | void;
  }): Promise<MultiAILoginResult>;
  logout(oauthRef?: MultiAIOAuthTokenRef): Promise<MultiAILogoutResult>;
  getCachedAccessToken(): string | undefined;
  tokenProvider(oauthRef?: MultiAIOAuthTokenRef): MultiAIBearerTokenProvider;
  getAccountSnapshot(): Promise<MultiAIAccountSnapshot>;
  getModels(): Promise<readonly MultiAIModelInfo[]>;
  invalidate(): Promise<void>;
}

export const IOAuthToolkit: ServiceIdentifier<IOAuthToolkit> =
  createDecorator<IOAuthToolkit>('oauthToolkit');

export interface IAuthSummaryService {
  readonly _serviceBrand: undefined;

  summarize(): Promise<readonly AuthStatus[]>;
  ensureReady(modelOverride?: string): Promise<void>;
}

export const IAuthSummaryService: ServiceIdentifier<IAuthSummaryService> =
  createDecorator<IAuthSummaryService>('authSummaryService');

export class AuthProvisioningRequiredError extends Error2 {
  constructor() {
    super(
      AuthErrors.codes.AUTH_PROVISIONING_REQUIRED,
      'no provider configured; complete onboarding via /login or the providers endpoint',
      { name: 'AuthProvisioningRequiredError' },
    );
  }
}

export class AuthTokenMissingError extends Error2 {
  readonly providerId: string;

  constructor(providerId: string) {
    super(
      AuthErrors.codes.AUTH_TOKEN_MISSING,
      `provider ${providerId} has no credential configured`,
      { details: { provider_id: providerId }, name: 'AuthTokenMissingError' },
    );
    this.providerId = providerId;
  }
}

export class AuthModelNotResolvedError extends Error2 {
  readonly modelId: string | undefined;
  readonly providerId: string | undefined;

  constructor(modelId: string | undefined, providerId?: string) {
    const details: Record<string, unknown> = {};
    if (modelId !== undefined) details['model_id'] = modelId;
    if (providerId !== undefined) details['provider_id'] = providerId;
    super(
      AuthErrors.codes.AUTH_MODEL_NOT_RESOLVED,
      modelId === undefined
        ? 'no default model configured'
        : `model ${modelId} does not resolve to a configured provider`,
      {
        details: Object.keys(details).length === 0 ? undefined : details,
        name: 'AuthModelNotResolvedError',
      },
    );
    this.modelId = modelId;
    this.providerId = providerId;
  }
}
