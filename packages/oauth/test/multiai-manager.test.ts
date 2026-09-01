import { describe, expect, it, vi } from 'vitest';

import { MultiAIOAuthManager } from '../src/multiai-manager';
import { MemorySessionStorage, type SecureSessionStorage } from '../src/secure-storage';
import type { PersistedOAuthSession } from '../src/multiai-types';

const issuer = 'https://multiai.example.test';
const clientId = 'public-client-id';
const session: PersistedOAuthSession = {
  schemaVersion: 1,
  revision: 1,
  issuer,
  clientId,
  subject: 'account-123',
  scopes: ['openid', 'profile', 'email', 'account:read', 'keys:read', 'ai:invoke'],
  refreshToken: 'refresh-1',
};
type FetchInput = Parameters<typeof fetch>[0];

function fetchUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function requestBody(init?: RequestInit): URLSearchParams {
  const body = init?.body;
  if (typeof body === 'string') return new URLSearchParams(body);
  if (body instanceof URLSearchParams) return body;
  throw new TypeError('Expected an OAuth form body.');
}

function metadataResponse(): Response {
  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    device_authorization_endpoint: `${issuer}/oauth/device`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/oauth/jwks`,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}

async function seededStorage(): Promise<MemorySessionStorage> {
  const storage = new MemorySessionStorage();
  await storage.compareAndSwap(
    `${issuer}\0${clientId}\0oauth/multiai`,
    undefined,
    session,
  );
  return storage;
}

function tokenResponse(refreshToken = 'refresh-2', accessToken = 'access-1'): Response {
  return Response.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: session.scopes.join(' '),
  });
}

function userInfoResponse(): Response {
  return Response.json({
    sub: session.subject,
    name: 'Updated Name',
    email: 'updated@example.test',
  });
}

describe('MultiAI refresh-token rotation', () => {
  it('deletes the local session after an ambiguous refresh network failure', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      throw new TypeError('socket closed after request upload');
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccessToken()).rejects.toMatchObject({
      code: 'login_required',
    });
    await expect(manager.hasSession()).resolves.toBe(false);
  });

  it('does not publish an access token when refresh-token CAS fails', async () => {
    const backing = await seededStorage();
    const storage: SecureSessionStorage = {
      load: (key) => backing.load(key),
      compareAndSwap: async () => false,
      remove: (key) => backing.remove(key),
    };
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) return tokenResponse();
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccessToken()).rejects.toMatchObject({ code: 'login_required' });
    expect(manager.getCachedAccessToken()).toBeUndefined();
    await expect(manager.hasSession()).resolves.toBe(false);
  });

  it('performs one refresh and one retry after a 401, then preserves the rotated token', async () => {
    const storage = await seededStorage();
    let refreshCount = 0;
    let accountCount = 0;
    const fetchImpl = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) {
        refreshCount += 1;
        const body = requestBody(init);
        expect(body.get('refresh_token')).toBe(`refresh-${refreshCount}`);
        return tokenResponse(`refresh-${refreshCount + 1}`, `access-${refreshCount}`);
      }
      if (url.endsWith('/oauth/userinfo')) return userInfoResponse();
      if (url.endsWith('/api/oauth/v1/snapshot')) {
        accountCount += 1;
        if (accountCount === 1) {
          return Response.json({ error: 'invalid_token' }, { status: 401 });
        }
        return Response.json({
          user: { sub: session.subject },
          account: {
            wallet: { total: 10, classic: 10, new: 0, billing_mode: 'wallet' },
            subscription: {
              active: false,
              available: false,
              limits: {
                five_hour: { enabled: false, remaining_percent: 0 },
                weekly: { enabled: false, remaining_percent: 0 },
                monthly: { enabled: false, remaining_percent: 0 },
              },
            },
            generated_at: new Date().toISOString(),
          },
          keys: [],
          connection: {
            id: 'connection-1',
            client_id: clientId,
            client_name: 'MultiAI CLI',
            device_name: 'test',
            scopes: session.scopes,
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
          generated_at: new Date().toISOString(),
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccountSnapshot()).resolves.toMatchObject({
      user: { sub: session.subject },
    });
    expect(refreshCount).toBe(2);
    expect(accountCount).toBe(2);
    expect((await storage.load(`${issuer}\0${clientId}\0oauth/multiai`))?.value.refreshToken).toBe(
      'refresh-3',
    );
  });

  it('clears local state even when revocation is unavailable', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      throw new TypeError('issuer unavailable');
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.logout()).resolves.toMatchObject({ ok: true });
    await expect(manager.hasSession()).resolves.toBe(false);
  });

  it('keeps the session when the account has insufficient quota', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) return tokenResponse();
      if (url.endsWith('/oauth/userinfo')) return userInfoResponse();
      if (url.endsWith('/api/oauth/v1/snapshot')) {
        return Response.json({ error: 'insufficient_quota' }, { status: 402 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccountSnapshot()).rejects.toMatchObject({
      code: 'insufficient_quota',
    });
    await expect(manager.hasSession()).resolves.toBe(true);
  });

  it('keeps the session when an OAuth scope is missing', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) return tokenResponse();
      if (url.endsWith('/oauth/userinfo')) return userInfoResponse();
      if (url.endsWith('/api/oauth/v1/snapshot')) {
        return Response.json(
          { error: 'insufficient_scope', required_scope: 'account:read' },
          { status: 403 },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccountSnapshot()).rejects.toMatchObject({
      code: 'insufficient_scope',
      requiredScope: 'account:read',
    });
    await expect(manager.hasSession()).resolves.toBe(true);
  });

  it('keeps the session when the account endpoint is rate-limited', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) return tokenResponse();
      if (url.endsWith('/oauth/userinfo')) return userInfoResponse();
      if (url.endsWith('/api/oauth/v1/snapshot')) {
        return Response.json(
          { error: 'rate_limit_exceeded' },
          { status: 429, headers: { 'Retry-After': '11' } },
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccountSnapshot()).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 11,
    });
    await expect(manager.hasSession()).resolves.toBe(true);
  });

  it('clears the session when the remote account becomes unavailable', async () => {
    const storage = await seededStorage();
    const fetchImpl = vi.fn(async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url.endsWith('/.well-known/oauth-authorization-server')) return metadataResponse();
      if (url.endsWith('/oauth/token')) return tokenResponse();
      if (url.endsWith('/oauth/userinfo')) return userInfoResponse();
      if (url.endsWith('/api/oauth/v1/snapshot')) {
        return Response.json({ error: 'account_unavailable' }, { status: 410 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const manager = new MultiAIOAuthManager({
      config: { issuer, clientId, scopes: session.scopes as never },
      keyringStorage: storage,
      fetchImpl,
    });

    await expect(manager.getAccountSnapshot()).rejects.toMatchObject({
      code: 'login_required',
    });
    await expect(manager.hasSession()).resolves.toBe(false);
  });
});
