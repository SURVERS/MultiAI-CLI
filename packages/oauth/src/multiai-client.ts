import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import {
  MultiAIAccountUnavailableError,
  MultiAIInsufficientQuotaError,
  MultiAIOAuthError,
  MultiAIOAuthInsufficientScopeError,
  MultiAIOAuthLoginRequiredError,
  MultiAIRateLimitError,
} from './multiai-errors';
import type {
  MultiAIAccountSnapshot,
  MultiAIIdentity,
  MultiAIModelInfo,
  MultiAIOAuthConfig,
  MultiAITokenResponse,
  OAuthAuthorizationServerMetadata,
} from './multiai-types';

export interface PkceAttempt {
  readonly verifier: string;
  readonly challenge: string;
  readonly state: string;
  readonly nonce: string;
}

export interface DeviceAuthorizationResponse {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete: string;
  readonly expiresIn: number;
  readonly interval: number;
}

export type DeviceTokenPoll =
  | { readonly kind: 'pending'; readonly slowDown: boolean }
  | { readonly kind: 'denied' | 'expired' }
  | { readonly kind: 'success'; readonly token: MultiAITokenResponse };

const METADATA_PATH = '/.well-known/oauth-authorization-server';

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function createPkceAttempt(): PkceAttempt {
  const verifier = base64url(randomBytes(32));
  return {
    verifier,
    challenge: base64url(createHash('sha256').update(verifier, 'utf8').digest()),
    state: base64url(randomBytes(32)),
    nonce: base64url(randomBytes(32)),
  };
}

export function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function issuerUrl(issuer: string): URL {
  const url = new URL(issuer);
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new MultiAIOAuthError('invalid_issuer', 'The MultiAI OAuth issuer is invalid.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1')) {
    throw new MultiAIOAuthError('invalid_issuer', 'The MultiAI OAuth issuer must use HTTPS.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MultiAIOAuthError('invalid_response', `OAuth response is missing ${key}.`);
  }
  return value;
}

function requiredPositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new MultiAIOAuthError('invalid_response', `OAuth response has an invalid ${key}.`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MultiAIOAuthError('invalid_response', 'OAuth server returned an invalid response.');
  }
  return value as Record<string, unknown>;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MultiAIOAuthError('invalid_response', 'OAuth server returned invalid JSON.', {
      status: response.status,
    });
  }
  return asRecord(payload);
}

function protocolError(
  payload: Record<string, unknown>,
  status: number,
  retryAfter?: string | null,
): MultiAIOAuthError {
  const code = typeof payload['error'] === 'string' ? payload['error'] : 'server_error';
  if (code === 'invalid_grant' || code === 'invalid_token' || code === 'invalid_oauth_token') {
    return new MultiAIOAuthLoginRequiredError('The MultiAI session has expired or was revoked.');
  }
  if (code === 'account_unavailable' || status === 410) return new MultiAIAccountUnavailableError();
  if (code === 'insufficient_quota' || status === 402) {
    return new MultiAIInsufficientQuotaError();
  }
  if (code === 'insufficient_scope') {
    const scope = typeof payload['required_scope'] === 'string' ? payload['required_scope'] : undefined;
    return new MultiAIOAuthInsufficientScopeError(
      scope === undefined
        ? undefined
        : `The MultiAI OAuth application is missing the "${scope}" scope.`,
      scope,
    );
  }
  if (status === 429) {
    const seconds = retryAfter === null || retryAfter === undefined ? undefined : Number(retryAfter);
    return new MultiAIRateLimitError(
      undefined,
      seconds !== undefined && Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined,
    );
  }
  const safeMessages: Record<string, string> = {
    invalid_request: 'The OAuth request is invalid.',
    invalid_client: 'The MultiAI OAuth client configuration is invalid.',
    invalid_scope: 'The MultiAI OAuth application does not grant all requested scopes.',
    access_denied: 'MultiAI authorization was denied.',
    expired_token: 'The MultiAI authorization request expired.',
    temporarily_unavailable: 'MultiAI authorization is temporarily unavailable.',
    server_error: 'MultiAI authorization failed.',
  };
  return new MultiAIOAuthError(code, safeMessages[code] ?? 'MultiAI authorization failed.', {
    status,
  });
}

function validateEndpoint(origin: string, value: string, name: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1')) {
    throw new MultiAIOAuthError('invalid_metadata', `${name} must use HTTPS.`);
  }
  if (url.origin !== origin) {
    throw new MultiAIOAuthError('invalid_metadata', `${name} does not match the trusted issuer.`);
  }
  return url.toString();
}

export async function fetchAuthorizationServerMetadata(
  config: MultiAIOAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<OAuthAuthorizationServerMetadata> {
  const issuer = issuerUrl(config.issuer);
  const response = await fetchImpl(new URL(METADATA_PATH, `${issuer.toString()}/`));
  if (!response.ok) {
    throw new MultiAIOAuthError('metadata_unavailable', 'Unable to load MultiAI OAuth metadata.', {
      status: response.status,
    });
  }
  const payload = await responseJson(response);
  if (requiredString(payload, 'issuer').replace(/\/+$/, '') !== issuer.toString().replace(/\/+$/, '')) {
    throw new MultiAIOAuthError('invalid_metadata', 'OAuth metadata issuer does not match.');
  }
  const stringArray = (key: string): readonly string[] => {
    const value = payload[key];
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      throw new MultiAIOAuthError('invalid_metadata', `OAuth metadata is missing ${key}.`);
    }
    return value;
  };
  const metadata: OAuthAuthorizationServerMetadata = {
    issuer: issuer.toString().replace(/\/+$/, ''),
    authorization_endpoint: validateEndpoint(
      issuer.origin,
      requiredString(payload, 'authorization_endpoint'),
      'authorization_endpoint',
    ),
    token_endpoint: validateEndpoint(
      issuer.origin,
      requiredString(payload, 'token_endpoint'),
      'token_endpoint',
    ),
    device_authorization_endpoint: validateEndpoint(
      issuer.origin,
      requiredString(payload, 'device_authorization_endpoint'),
      'device_authorization_endpoint',
    ),
    revocation_endpoint: validateEndpoint(
      issuer.origin,
      requiredString(payload, 'revocation_endpoint'),
      'revocation_endpoint',
    ),
    userinfo_endpoint: validateEndpoint(
      issuer.origin,
      requiredString(payload, 'userinfo_endpoint'),
      'userinfo_endpoint',
    ),
    jwks_uri: validateEndpoint(issuer.origin, requiredString(payload, 'jwks_uri'), 'jwks_uri'),
    response_types_supported: stringArray('response_types_supported'),
    code_challenge_methods_supported: stringArray('code_challenge_methods_supported'),
    token_endpoint_auth_methods_supported: stringArray('token_endpoint_auth_methods_supported'),
  };
  if (
    !metadata.response_types_supported.includes('code') ||
    !metadata.code_challenge_methods_supported.includes('S256') ||
    !metadata.token_endpoint_auth_methods_supported.includes('none')
  ) {
    throw new MultiAIOAuthError('invalid_metadata', 'OAuth server does not support native PKCE clients.');
  }
  return metadata;
}

function parseToken(payload: Record<string, unknown>, now: () => number): MultiAITokenResponse {
  const accessToken = requiredString(payload, 'access_token');
  const refreshToken = requiredString(payload, 'refresh_token');
  const tokenType = requiredString(payload, 'token_type');
  const expiresIn = requiredPositiveInteger(payload, 'expires_in');
  if (tokenType.toLowerCase() !== 'bearer') {
    throw new MultiAIOAuthError('invalid_response', 'OAuth server returned an unsupported token type.');
  }
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn,
    expiresAt: now() + expiresIn,
    scopes: requiredString(payload, 'scope').split(/\s+/).filter(Boolean),
    idToken: typeof payload['id_token'] === 'string' ? payload['id_token'] : undefined,
  };
}

async function postForm(
  endpoint: string,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<{ readonly response: Response; readonly payload: Record<string, unknown> }> {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const payload = await responseJson(response);
  return { response, payload };
}

export function buildAuthorizationUri(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly attempt: PkceAttempt;
  readonly redirectUri: string;
  readonly deviceName: string;
}): string {
  const url = new URL(options.metadata.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', options.config.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', (options.config.scopes ?? []).join(' '));
  url.searchParams.set('state', options.attempt.state);
  url.searchParams.set('nonce', options.attempt.nonce);
  url.searchParams.set('code_challenge', options.attempt.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('device_name', options.deviceName);
  return url.toString();
}

export async function exchangeAuthorizationCode(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly code: string;
  readonly redirectUri: string;
  readonly verifier: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}): Promise<MultiAITokenResponse> {
  const { response, payload } = await postForm(
    options.metadata.token_endpoint,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: options.config.clientId,
      code: options.code,
      redirect_uri: options.redirectUri,
      code_verifier: options.verifier,
    }),
    options.fetchImpl ?? fetch,
  );
  if (!response.ok) throw protocolError(payload, response.status);
  return parseToken(payload, options.now ?? (() => Math.floor(Date.now() / 1000)));
}

export async function requestDeviceAuthorization(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly challenge: string;
  readonly deviceName: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<DeviceAuthorizationResponse> {
  const { response, payload } = await postForm(
    options.metadata.device_authorization_endpoint,
    new URLSearchParams({
      client_id: options.config.clientId,
      scope: (options.config.scopes ?? []).join(' '),
      code_challenge: options.challenge,
      code_challenge_method: 'S256',
      device_name: options.deviceName,
    }),
    options.fetchImpl ?? fetch,
  );
  if (!response.ok) throw protocolError(payload, response.status);
  return {
    deviceCode: requiredString(payload, 'device_code'),
    userCode: requiredString(payload, 'user_code'),
    verificationUri: requiredString(payload, 'verification_uri'),
    verificationUriComplete: requiredString(payload, 'verification_uri_complete'),
    expiresIn: requiredPositiveInteger(payload, 'expires_in'),
    interval: requiredPositiveInteger(payload, 'interval'),
  };
}

export async function pollDeviceToken(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly deviceCode: string;
  readonly verifier: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}): Promise<DeviceTokenPoll> {
  const { response, payload } = await postForm(
    options.metadata.token_endpoint,
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: options.config.clientId,
      device_code: options.deviceCode,
      code_verifier: options.verifier,
    }),
    options.fetchImpl ?? fetch,
  );
  if (response.ok) {
    return { kind: 'success', token: parseToken(payload, options.now ?? (() => Math.floor(Date.now() / 1000))) };
  }
  const code = typeof payload['error'] === 'string' ? payload['error'] : '';
  if (code === 'authorization_pending') return { kind: 'pending', slowDown: false };
  if (code === 'slow_down') return { kind: 'pending', slowDown: true };
  if (code === 'access_denied') return { kind: 'denied' };
  if (code === 'expired_token') return { kind: 'expired' };
  throw protocolError(payload, response.status);
}

export async function refreshToken(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly refreshToken: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}): Promise<MultiAITokenResponse> {
  let response: Response;
  let payload: Record<string, unknown>;
  try {
    ({ response, payload } = await postForm(
      options.metadata.token_endpoint,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: options.config.clientId,
        refresh_token: options.refreshToken,
      }),
      options.fetchImpl ?? fetch,
    ));
  } catch (error) {
    throw new MultiAIOAuthLoginRequiredError(
      'The refresh result is ambiguous; sign in to MultiAI again.',
      { cause: error },
    );
  }
  if (!response.ok) throw protocolError(payload, response.status);
  return parseToken(payload, options.now ?? (() => Math.floor(Date.now() / 1000)));
}

export async function revokeToken(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly config: MultiAIOAuthConfig;
  readonly refreshToken: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<void> {
  try {
    await (options.fetchImpl ?? fetch)(options.metadata.revocation_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.config.clientId,
        token: options.refreshToken,
      }),
    });
  } catch {
    // Logout is local-first after this best-effort revocation attempt.
  }
}

function validateIdentityClaims(payload: JWTPayload, issuer: string): MultiAIIdentity {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token has no subject.');
  }
  if (payload['auth_time'] !== undefined && typeof payload['auth_time'] !== 'number') {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token auth_time has an invalid type.');
  }
  if (payload['acr'] !== undefined && typeof payload['acr'] !== 'string') {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token acr has an invalid type.');
  }
  if (
    payload['amr'] !== undefined &&
    (!Array.isArray(payload['amr']) ||
      !payload['amr'].every((value) => typeof value === 'string'))
  ) {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token amr has an invalid type.');
  }
  return {
    issuer,
    subject: payload.sub,
    name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    preferredUsername:
      typeof payload['preferred_username'] === 'string'
        ? payload['preferred_username']
        : undefined,
    picture: typeof payload['picture'] === 'string' ? payload['picture'] : undefined,
    email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
    emailVerified:
      typeof payload['email_verified'] === 'boolean' ? payload['email_verified'] : undefined,
  };
}

export async function verifyIdToken(options: {
  readonly token: string;
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly clientId: string;
  readonly nonce?: string;
  readonly now?: () => number;
}): Promise<MultiAIIdentity> {
  const now = (options.now ?? (() => Math.floor(Date.now() / 1000)))();
  const result = await jwtVerify(
    options.token,
    createRemoteJWKSet(new URL(options.metadata.jwks_uri)),
    {
      algorithms: ['RS256'],
      issuer: options.metadata.issuer,
      audience: options.clientId,
      clockTolerance: 60,
      currentDate: new Date(now * 1000),
    },
  );
  if (
    result.protectedHeader.alg !== 'RS256' ||
    typeof result.protectedHeader.kid !== 'string' ||
    result.protectedHeader.kid.length === 0
  ) {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token has an invalid signing header.');
  }
  if (
    typeof result.payload.exp !== 'number' ||
    typeof result.payload.iat !== 'number' ||
    result.payload.iat > now + 60
  ) {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token lifetime claims are invalid.');
  }
  if (
    options.nonce !== undefined &&
    (typeof result.payload['nonce'] !== 'string' ||
      !constantTimeEquals(result.payload['nonce'], options.nonce))
  ) {
    throw new MultiAIOAuthError('invalid_id_token', 'ID token nonce does not match.');
  }
  return validateIdentityClaims(result.payload, options.metadata.issuer);
}

async function authorizedJson(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  let payload: Record<string, unknown>;
  try {
    payload = await responseJson(response);
  } catch (error) {
    if (response.ok) throw error;
    payload = {};
  }
  if (!response.ok) {
    throw protocolError(payload, response.status, response.headers.get('retry-after'));
  }
  return payload;
}

export async function fetchUserInfo(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<MultiAIIdentity> {
  const payload = await authorizedJson(
    options.metadata.userinfo_endpoint,
    options.accessToken,
    options.fetchImpl ?? fetch,
  );
  return validateIdentityClaims(payload as JWTPayload, options.metadata.issuer);
}

export async function fetchAccountSnapshot(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<MultiAIAccountSnapshot> {
  const endpoint = new URL('/api/oauth/v1/snapshot', options.metadata.issuer).toString();
  return (await authorizedJson(
    endpoint,
    options.accessToken,
    options.fetchImpl ?? fetch,
  )) as unknown as MultiAIAccountSnapshot;
}

export async function fetchMultiAIModels(options: {
  readonly metadata: OAuthAuthorizationServerMetadata;
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<readonly MultiAIModelInfo[]> {
  const endpoint = new URL('/v1/models', options.metadata.issuer).toString();
  const payload = await authorizedJson(endpoint, options.accessToken, options.fetchImpl ?? fetch);
  if (!Array.isArray(payload['data'])) {
    throw new MultiAIOAuthError('invalid_response', 'MultiAI returned an invalid model catalog.');
  }
  return payload['data'].flatMap((item): MultiAIModelInfo[] => {
    if (item === null || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record['id'] !== 'string' || record['id'].length === 0) return [];
    const capabilities = Array.isArray(record['capabilities'])
      ? record['capabilities'].filter(
          (candidate): candidate is string =>
            typeof candidate === 'string' && candidate.length > 0,
        )
      : undefined;
    const supportEfforts = Array.isArray(record['support_efforts'])
      ? record['support_efforts'].filter(
          (candidate): candidate is string =>
            typeof candidate === 'string' && candidate.length > 0,
        )
      : undefined;
    return [{
      id: record['id'],
      inputMultiplier:
        typeof record['input_multiplier'] === 'number' ? record['input_multiplier'] : undefined,
      cachedInputMultiplier:
        typeof record['cached_input_multiplier'] === 'number'
          ? record['cached_input_multiplier']
          : undefined,
      outputMultiplier:
        typeof record['output_multiplier'] === 'number' ? record['output_multiplier'] : undefined,
      capabilities:
        capabilities !== undefined && capabilities.length > 0 ? capabilities : undefined,
      supportEfforts:
        supportEfforts !== undefined && supportEfforts.length > 0 ? supportEfforts : undefined,
      defaultEffort:
        typeof record['default_effort'] === 'string' && record['default_effort'].length > 0
          ? record['default_effort']
          : undefined,
    }];
  });
}
