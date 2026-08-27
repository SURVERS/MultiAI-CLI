export const MULTIAI_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'account:read',
  'keys:read',
  'ai:invoke',
] as const;

export type MultiAIOAuthScope = (typeof MULTIAI_OAUTH_SCOPES)[number];
export type MultiAIOAuthMethod = 'browser' | 'device';
export type MultiAIOAuthPersistence = 'keyring' | 'session';

export interface MultiAIOAuthConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly scopes?: readonly MultiAIOAuthScope[];
  readonly callbackPath?: string;
}

export interface OAuthAuthorizationServerMetadata {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly device_authorization_endpoint: string;
  readonly revocation_endpoint: string;
  readonly userinfo_endpoint: string;
  readonly jwks_uri: string;
  readonly response_types_supported: readonly string[];
  readonly code_challenge_methods_supported: readonly string[];
  readonly token_endpoint_auth_methods_supported: readonly string[];
}

export interface MultiAITokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly expiresAt: number;
  readonly scopes: readonly string[];
  readonly idToken?: string;
}

export interface MultiAIIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly name?: string;
  readonly preferredUsername?: string;
  readonly picture?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
}

export interface MultiAIWallet {
  readonly total: number;
  readonly classic: number;
  readonly new: number;
  readonly billing_mode: string;
}

export interface MultiAISubscriptionLimit {
  readonly enabled: boolean;
  readonly remaining_percent: number;
  readonly reset_at?: string;
}

export interface MultiAISubscription {
  readonly active: boolean;
  readonly available: boolean;
  readonly limits: {
    readonly five_hour: MultiAISubscriptionLimit;
    readonly weekly: MultiAISubscriptionLimit;
    readonly monthly: MultiAISubscriptionLimit;
  };
}

export interface MultiAIMaskedKey {
  readonly id: number;
  readonly name: string;
  readonly key: string;
  readonly status: string;
}

export interface MultiAIAccountSnapshot {
  readonly user: {
    readonly sub: string;
    readonly display_name?: string;
    readonly avatar_url?: string;
    readonly email?: string;
    readonly email_verified?: boolean;
  };
  readonly account: {
    readonly wallet: MultiAIWallet;
    readonly subscription: MultiAISubscription;
    readonly generated_at: string;
  };
  readonly keys: readonly MultiAIMaskedKey[];
  readonly connection: {
    readonly id: string;
    readonly client_id: string;
    readonly client_name: string;
    readonly device_name: string;
    readonly scopes: readonly string[];
    readonly expires_at: string;
  };
  readonly generated_at: string;
}

export interface MultiAIModelInfo {
  readonly id: string;
  readonly inputMultiplier?: number;
  readonly cachedInputMultiplier?: number;
  readonly outputMultiplier?: number;
  readonly capabilities?: readonly string[];
  readonly supportEfforts?: readonly string[];
  readonly defaultEffort?: string;
}

export interface MultiAIBrowserAuthorization {
  readonly method: 'browser';
  readonly authorizationUri: string;
  readonly redirectUri: string;
  readonly expiresIn: number;
}

export interface MultiAIDeviceAuthorization {
  readonly method: 'device';
  readonly userCode: string;
  readonly deviceCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete: string;
  readonly expiresIn: number;
  readonly interval: number;
}

export type MultiAIAuthorization = MultiAIBrowserAuthorization | MultiAIDeviceAuthorization;

export interface MultiAILoginOptions {
  readonly method?: MultiAIOAuthMethod;
  readonly persistence?: MultiAIOAuthPersistence;
  readonly signal?: AbortSignal;
  readonly deviceName?: string;
  readonly onAuthorization?: (authorization: MultiAIAuthorization) => Promise<void> | void;
}

export interface MultiAILoginResult {
  readonly providerName: string;
  readonly identity: MultiAIIdentity;
  readonly scopes: readonly string[];
  readonly persistence: MultiAIOAuthPersistence;
}

export interface MultiAILogoutResult {
  readonly providerName: string;
  readonly ok: true;
}

export interface MultiAIOAuthTokenRef {
  readonly key: string;
  readonly issuer?: string;
}

export interface PersistedOAuthSession {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly issuer: string;
  readonly clientId: string;
  readonly subject: string;
  readonly scopes: readonly string[];
  readonly refreshToken: string;
}
