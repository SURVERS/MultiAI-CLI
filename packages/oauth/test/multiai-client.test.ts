/**
 * MultiAI OAuth client contract: validates configuration defaults and the
 * remote OAuth/OIDC boundary through fetch stubs. Run with the package tests.
 */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BUILTIN_MULTIAI_OAUTH_CLIENT_ID,
  resolveMultiAIOAuthConfig,
} from '../src/multiai-constants';
import {
  fetchAccountSnapshot,
  fetchAuthorizationServerMetadata,
  fetchMultiAIModels,
  requestDeviceAuthorization,
  verifyIdToken,
} from '../src/multiai-client';
import {
  applyManagedMultiAIConfig,
  applyManagedMultiAIModelProfiles,
  type ManagedMultiAIConfigShape,
} from '../src/managed-multiai';
import type {
  MultiAIOAuthConfig,
  OAuthAuthorizationServerMetadata,
} from '../src/multiai-types';

const issuer = 'https://multiai.example.test';
const clientId = 'public-client-id';
const now = 1_800_000_000;
const config: MultiAIOAuthConfig = {
  issuer,
  clientId,
  scopes: ['openid', 'profile', 'email', 'account:read', 'keys:read', 'ai:invoke'],
};
type FetchInput = Parameters<typeof fetch>[0];

function metadata(): OAuthAuthorizationServerMetadata {
  return {
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
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MultiAI OAuth configuration', () => {
  it('returns the production client ID when no override is provided', () => {
    expect(resolveMultiAIOAuthConfig({}).clientId).toBe('ma-client-zhbk1ikvlissdtjp');
    expect(BUILTIN_MULTIAI_OAUTH_CLIENT_ID).toBe('ma-client-zhbk1ikvlissdtjp');
  });

  it('returns the override client ID when development configuration provides one', () => {
    expect(
      resolveMultiAIOAuthConfig({
        MULTIAI_OAUTH_CLIENT_ID: 'staging-client-id',
      }).clientId,
    ).toBe('staging-client-id');
  });
});

describe('MultiAI managed model reasoning metadata', () => {
  it('assigns the model-specific reasoning controls to a sparse managed catalog', () => {
    const managedConfig: ManagedMultiAIConfigShape = { providers: {}, models: {} };

    applyManagedMultiAIConfig(managedConfig, [
      { id: 'gpt-5.6-sol' },
      { id: 'gemini-3.6-flash' },
      { id: 'deepseek-v4-pro' },
      { id: 'mimo-v2.5' },
      { id: 'gpt-image-2' },
    ]);

    expect(managedConfig.models).toMatchObject({
      'multiai/gpt-5.6-sol': {
        capabilities: ['thinking'],
        supportEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
        defaultEffort: 'high',
      },
      'multiai/gemini-3.6-flash': {
        capabilities: ['always_thinking'],
        supportEfforts: ['minimal', 'low', 'medium', 'high'],
        protocol: 'openai',
      },
      'multiai/deepseek-v4-pro': {
        capabilities: ['thinking'],
        supportEfforts: ['high', 'max'],
      },
      'multiai/mimo-v2.5': {
        capabilities: ['thinking'],
      },
      'multiai/gpt-image-2': {
        provider: 'managed:multiai',
        model: 'gpt-image-2',
      },
    });
    expect(managedConfig.models?.['multiai/gpt-image-2']?.capabilities).toBeUndefined();
  });

  it('uses the same reasoning profile for the ma-prefixed route alias', () => {
    const managedConfig: ManagedMultiAIConfigShape = { providers: {}, models: {} };

    applyManagedMultiAIConfig(managedConfig, [{ id: 'ma-gpt-5.6-sol' }]);

    expect(managedConfig.models?.['multiai/ma-gpt-5.6-sol']).toMatchObject({
      capabilities: ['thinking'],
      supportEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultEffort: 'high',
    });
  });

  it('routes ma-prefixed Gemini aliases through OpenAI Chat Completions', () => {
    const managedConfig: ManagedMultiAIConfigShape = { providers: {}, models: {} };

    applyManagedMultiAIConfig(managedConfig, [{ id: 'ma-gemini-3.6-flash' }]);

    expect(managedConfig.models?.['multiai/ma-gemini-3.6-flash']).toMatchObject({
      capabilities: ['always_thinking'],
      protocol: 'openai',
    });
  });

  it('upgrades an existing Gemini alias to the Chat Completions transport', () => {
    const managedConfig: ManagedMultiAIConfigShape = {
      providers: {},
      models: {
        'multiai/gemini-3.6-flash': {
          provider: 'managed:multiai',
          model: 'gemini-3.6-flash',
          capabilities: ['thinking'],
          protocol: 'anthropic',
          betaApi: true,
          adaptiveThinking: true,
        },
      },
    };

    expect(applyManagedMultiAIModelProfiles(managedConfig)).toBe(true);
    expect(managedConfig.models?.['multiai/gemini-3.6-flash']).toMatchObject({
      capabilities: ['always_thinking'],
      protocol: 'openai',
    });
    expect(managedConfig.models?.['multiai/gemini-3.6-flash']?.betaApi).toBeUndefined();
    expect(managedConfig.models?.['multiai/gemini-3.6-flash']?.adaptiveThinking).toBeUndefined();
  });

  it('keeps explicit reasoning metadata returned by the server authoritative', async () => {
    const models = await fetchMultiAIModels({
      metadata: metadata(),
      accessToken: 'access-token',
      fetchImpl: vi.fn(async () =>
        Response.json({
          data: [
            {
              id: 'gpt-5.6-sol',
              capabilities: ['thinking'],
              support_efforts: ['minimal', 'high'],
              default_effort: 'minimal',
            },
          ],
        }),
      ),
    });
    const managedConfig: ManagedMultiAIConfigShape = { providers: {}, models: {} };

    applyManagedMultiAIConfig(managedConfig, models);

    expect(managedConfig.models?.['multiai/gpt-5.6-sol']).toMatchObject({
      supportEfforts: ['minimal', 'high'],
      defaultEffort: 'minimal',
    });
  });

  it('removes disabled models and resets thinking when the managed default changes', () => {
    const managedConfig: ManagedMultiAIConfigShape = { providers: {}, models: {} };
    applyManagedMultiAIConfig(managedConfig, [{ id: 'old-model' }, { id: 'kept-model' }]);
    managedConfig.defaultModel = 'multiai/old-model';
    managedConfig.thinking = { enabled: true, effort: 'max' };

    applyManagedMultiAIConfig(managedConfig, [{ id: 'kept-model' }, { id: 'new-model' }], {
      preserveDefaultModel: true,
    });

    expect(managedConfig.models?.['multiai/old-model']).toBeUndefined();
    expect(managedConfig.models?.['multiai/new-model']).toMatchObject({
      provider: 'managed:multiai',
      model: 'new-model',
    });
    expect(managedConfig.defaultModel).toBe('multiai/kept-model');
    expect(managedConfig.thinking).toBeUndefined();
  });

  it('falls back to a configured external model when every managed model is disabled', () => {
    const managedConfig: ManagedMultiAIConfigShape = {
      providers: {
        external: { type: 'openai_legacy', baseUrl: 'https://api.example.test/v1', apiKey: 'key' },
      },
      models: {
        'external/model': { provider: 'external', model: 'model' },
      },
    };
    applyManagedMultiAIConfig(managedConfig, [{ id: 'old-model' }]);
    managedConfig.defaultModel = 'multiai/old-model';

    applyManagedMultiAIConfig(managedConfig, [], { preserveDefaultModel: true });

    expect(managedConfig.models?.['multiai/old-model']).toBeUndefined();
    expect(managedConfig.defaultModel).toBe('external/model');
  });
});

describe('MultiAI OAuth metadata', () => {
  it.each([
    'authorization_endpoint',
    'token_endpoint',
    'device_authorization_endpoint',
    'revocation_endpoint',
    'userinfo_endpoint',
    'jwks_uri',
  ] as const)('rejects %s on a different origin', async (field) => {
    const payload = {
      ...metadata(),
      [field]: `https://attacker.example/oauth/${field}`,
    };
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchAuthorizationServerMetadata(config, fetchImpl)).rejects.toMatchObject({
      code: 'invalid_metadata',
    });
  });

  it('requires native-client PKCE metadata', async () => {
    const payload = {
      ...metadata(),
      code_challenge_methods_supported: ['plain'],
    };
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchAuthorizationServerMetadata(config, fetchImpl)).rejects.toMatchObject({
      code: 'invalid_metadata',
    });
  });
});

describe('MultiAI device authorization', () => {
  it('sends PKCE S256 without a client secret', async () => {
    const fetchImpl = vi.fn(async (_input: FetchInput, init?: RequestInit) => {
      const body = init?.body;
      if (!(body instanceof URLSearchParams)) {
        throw new TypeError('Expected an OAuth form body.');
      }
      expect(body.get('client_id')).toBe(clientId);
      expect(body.get('code_challenge')).toBe('challenge');
      expect(body.get('code_challenge_method')).toBe('S256');
      expect(body.has('nonce')).toBe(false);
      expect(body.has('client_secret')).toBe(false);
      return new Response(
        JSON.stringify({
          device_code: 'ma-oauth-device-secret',
          user_code: 'MA-1234',
          verification_uri: `${issuer}/activate`,
          verification_uri_complete: `${issuer}/activate?user_code=MA-1234`,
          expires_in: 900,
          interval: 5,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(
      requestDeviceAuthorization({
        metadata: metadata(),
        config,
        challenge: 'challenge',
        deviceName: 'test device',
        fetchImpl,
      }),
    ).resolves.toMatchObject({ deviceCode: 'ma-oauth-device-secret', userCode: 'MA-1234' });
  });
});

async function signedToken(
  claims: Record<string, unknown> = {},
  header: { alg: 'RS256'; kid?: string } = { kid: 'key-1', alg: 'RS256' },
  registered: {
    issuer?: string;
    audience?: string;
    issuedAt?: number;
    expirationTime?: number;
  } = {},
): Promise<{ token: string; jwk: Record<string, unknown> }> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'key-1',
    alg: 'RS256',
    use: 'sig',
  };
  const token = await new SignJWT({
    nonce: 'nonce-1',
    auth_time: now - 30,
    acr: 'urn:multiai:mfa',
    amr: ['pwd', 'otp'],
    ...claims,
  })
    .setProtectedHeader(header)
    .setIssuer(registered.issuer ?? issuer)
    .setAudience(registered.audience ?? clientId)
    .setSubject('account-123')
    .setIssuedAt(registered.issuedAt ?? now)
    .setExpirationTime(registered.expirationTime ?? now + 300)
    .sign(privateKey);
  return { token, jwk };
}

function stubJwks(jwk: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('MultiAI ID tokens', () => {
  it('accepts a valid RS256 token and identifies the account by issuer and subject', async () => {
    const { token, jwk } = await signedToken({ email: 'first@example.test' });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).resolves.toMatchObject({
      issuer,
      subject: 'account-123',
      email: 'first@example.test',
    });
  });

  it('rejects a nonce mismatch', async () => {
    const { token, jwk } = await signedToken();
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'different-nonce',
        now: () => now,
      }),
    ).rejects.toMatchObject({ code: 'invalid_id_token' });
  });

  it('rejects a token signed by an untrusted key', async () => {
    const { token } = await signedToken();
    const { jwk: unrelatedJwk } = await signedToken();
    stubJwks(unrelatedJwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects an issuer mismatch', async () => {
    const { token, jwk } = await signedToken({}, undefined, {
      issuer: 'https://other.example.test',
    });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects an audience mismatch', async () => {
    const { token, jwk } = await signedToken({}, undefined, {
      audience: 'another-client',
    });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects an expired token outside the clock-skew allowance', async () => {
    const { token, jwk } = await signedToken({}, undefined, {
      expirationTime: now - 61,
    });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects a token issued in the future outside the clock-skew allowance', async () => {
    const { token, jwk } = await signedToken({}, undefined, {
      issuedAt: now + 61,
    });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toMatchObject({ code: 'invalid_id_token' });
  });

  it('rejects invalid auth_time, acr, and amr claim types', async () => {
    const { token, jwk } = await signedToken({
      auth_time: 'recently',
      acr: 2,
      amr: ['pwd', 1],
    });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toMatchObject({ code: 'invalid_id_token' });
  });

  it('rejects a token without a signing key id', async () => {
    const { token, jwk } = await signedToken({}, { alg: 'RS256' });
    stubJwks(jwk);

    await expect(
      verifyIdToken({
        token,
        metadata: metadata(),
        clientId,
        nonce: 'nonce-1',
        now: () => now,
      }),
    ).rejects.toBeDefined();
  });
});

describe('MultiAI resource errors', () => {
  it('preserves insufficient quota without converting it to login-required', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: 'insufficient_quota', message: 'Balance exhausted.' },
        { status: 402 },
      ),
    );

    await expect(
      fetchAccountSnapshot({
        metadata: metadata(),
        accessToken: 'access-token',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'insufficient_quota',
      status: 402,
      topUpUrl: 'https://multiai.store/account',
    });
  });

  it('reports the missing OAuth scope without retrying login', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: 'insufficient_scope', required_scope: 'account:read' },
        { status: 403 },
      ),
    );

    await expect(
      fetchAccountSnapshot({
        metadata: metadata(),
        accessToken: 'access-token',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'insufficient_scope',
      status: 403,
      requiredScope: 'account:read',
    });
  });

  it('exposes Retry-After for rate-limit scheduling', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: 'rate_limit_exceeded' },
        { status: 429, headers: { 'Retry-After': '17' } },
      ),
    );

    await expect(
      fetchAccountSnapshot({
        metadata: metadata(),
        accessToken: 'access-token',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
      retryAfterSeconds: 17,
    });
  });
});
