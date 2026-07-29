import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';

import lockfile from 'proper-lockfile';

import {
  buildAuthorizationUri,
  constantTimeEquals,
  createPkceAttempt,
  exchangeAuthorizationCode,
  fetchAccountSnapshot,
  fetchAuthorizationServerMetadata,
  fetchMultiAIModels,
  fetchUserInfo,
  pollDeviceToken,
  refreshToken,
  requestDeviceAuthorization,
  revokeToken,
  verifyIdToken,
} from './multiai-client';
import {
  MultiAIAccountUnavailableError,
  MultiAIOAuthError,
  MultiAIOAuthLoginRequiredError,
} from './multiai-errors';
import type {
  MultiAIAccountSnapshot,
  MultiAIIdentity,
  MultiAILoginOptions,
  MultiAILoginResult,
  MultiAILogoutResult,
  MultiAIModelInfo,
  MultiAIOAuthConfig,
  MultiAIOAuthPersistence,
  MultiAITokenResponse,
  OAuthAuthorizationServerMetadata,
  PersistedOAuthSession,
} from './multiai-types';
import {
  KeyringSessionStorage,
  MemorySessionStorage,
  type SecureSessionStorage,
} from './secure-storage';

const ACCESS_REFRESH_SKEW_SECONDS = 60;
const BROWSER_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

type Sleep = (ms: number) => Promise<void>;

export interface MultiAIOAuthManagerOptions {
  readonly config: MultiAIOAuthConfig;
  readonly homeDir?: string;
  readonly key?: string;
  readonly fetchImpl?: typeof fetch;
  readonly keyringStorage?: SecureSessionStorage;
  readonly memoryStorage?: SecureSessionStorage;
  readonly now?: () => number;
  readonly sleep?: Sleep;
}

interface AccessSession {
  readonly token: MultiAITokenResponse;
  readonly identity: MultiAIIdentity;
  readonly persistence: MultiAIOAuthPersistence;
}

interface CallbackResult {
  readonly code: string;
  readonly redirectUri: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageKey(config: MultiAIOAuthConfig, key: string): string {
  return `${config.issuer.replace(/\/+$/, '')}\0${config.clientId}\0${key}`;
}

function lockName(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function requestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new MultiAIOAuthError('cancelled', 'MultiAI login was cancelled.');
  }
}

function mergeIdentity(verified: MultiAIIdentity, current: MultiAIIdentity): MultiAIIdentity {
  if (verified.issuer !== current.issuer || verified.subject !== current.subject) {
    throw new MultiAIOAuthError('identity_mismatch', 'MultiAI account identity changed during login.');
  }
  return {
    issuer: verified.issuer,
    subject: verified.subject,
    name: current.name ?? verified.name,
    preferredUsername: current.preferredUsername ?? verified.preferredUsername,
    picture: current.picture ?? verified.picture,
    email: current.email ?? verified.email,
    emailVerified: current.emailVerified ?? verified.emailVerified,
  };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

export class MultiAIOAuthManager {
  private readonly config: MultiAIOAuthConfig;
  private readonly homeDir: string;
  private readonly key: string;
  private readonly sessionKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly keyringStorage: SecureSessionStorage;
  private readonly memoryStorage: SecureSessionStorage;
  private readonly now: () => number;
  private readonly sleep: Sleep;
  private metadataPromise: Promise<OAuthAuthorizationServerMetadata> | undefined;
  private accessSession: AccessSession | undefined;
  private refreshInFlight: Promise<string> | undefined;
  private legacyCleanupPromise: Promise<void> | undefined;

  constructor(options: MultiAIOAuthManagerOptions) {
    this.config = options.config;
    this.homeDir = options.homeDir ?? join(homedir(), '.multiai');
    this.key = options.key ?? 'oauth/multiai';
    this.sessionKey = storageKey(this.config, this.key);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.keyringStorage = options.keyringStorage ?? new KeyringSessionStorage();
    this.memoryStorage = options.memoryStorage ?? new MemorySessionStorage();
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.sleep = options.sleep ?? defaultSleep;
  }

  private validateClient(): void {
    if (this.config.clientId.trim().length === 0) {
      throw new MultiAIOAuthError(
        'client_not_configured',
        'MultiAI OAuth client_id is not configured. Set MULTIAI_OAUTH_CLIENT_ID.',
      );
    }
  }

  private metadata(): Promise<OAuthAuthorizationServerMetadata> {
    this.validateClient();
    this.metadataPromise ??= fetchAuthorizationServerMetadata(this.config, this.fetchImpl);
    return this.metadataPromise;
  }

  private cleanupLegacyCredential(): Promise<void> {
    this.legacyCleanupPromise ??= removeRecognizedLegacyCredential();
    return this.legacyCleanupPromise;
  }

  async login(options: MultiAILoginOptions = {}): Promise<MultiAILoginResult> {
    await this.cleanupLegacyCredential();
    const metadata = await this.metadata();
    const attempt = createPkceAttempt();
    const persistence = options.persistence ?? 'keyring';
    const deviceName = options.deviceName?.trim() || `MultiAI CLI on ${hostname()}`;
    requestAborted(options.signal);
    const token =
      (options.method ?? 'browser') === 'device'
        ? await this.loginWithDevice(
            metadata,
            attempt.verifier,
            attempt.challenge,
            deviceName,
            options,
          )
        : await this.loginWithBrowser(metadata, attempt, deviceName, options);
    const method = options.method ?? 'browser';
    return this.acceptLoginToken(
      token,
      metadata,
      persistence,
      method === 'browser' ? attempt.nonce : undefined,
    );
  }

  private async loginWithBrowser(
    metadata: OAuthAuthorizationServerMetadata,
    attempt: ReturnType<typeof createPkceAttempt>,
    deviceName: string,
    options: MultiAILoginOptions,
  ): Promise<MultiAITokenResponse> {
    const callback = await this.waitForBrowserCallback(metadata, attempt, deviceName, options);
    requestAborted(options.signal);
    return exchangeAuthorizationCode({
      metadata,
      config: this.config,
      code: callback.code,
      redirectUri: callback.redirectUri,
      verifier: attempt.verifier,
      fetchImpl: this.fetchImpl,
      now: this.now,
    });
  }

  private async waitForBrowserCallback(
    metadata: OAuthAuthorizationServerMetadata,
    attempt: ReturnType<typeof createPkceAttempt>,
    deviceName: string,
    options: MultiAILoginOptions,
  ): Promise<CallbackResult> {
    const callbackPath = this.config.callbackPath ?? '/oauth/callback';
    const server = createServer();
    let timeout: NodeJS.Timeout | undefined;
    let settled = false;
    const result = new Promise<CallbackResult>((resolve, reject) => {
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) clearTimeout(timeout);
        void closeServer(server).finally(action);
      };
      server.on('request', (request, response) => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          response.writeHead(400).end();
          return;
        }
        if (request.socket.remoteAddress !== '127.0.0.1') {
          response.writeHead(403).end();
          return;
        }
        const host = request.headers.host;
        if (host !== `127.0.0.1:${address.port}` || request.method !== 'GET') {
          response.writeHead(400).end();
          return;
        }
        const url = new URL(request.url ?? '/', `http://${host}`);
        if (url.pathname !== callbackPath) {
          response.writeHead(404).end();
          return;
        }
        const state = url.searchParams.get('state') ?? '';
        const issuer = url.searchParams.get('iss') ?? '';
        if (
          !constantTimeEquals(state, attempt.state) ||
          issuer.replace(/\/+$/, '') !== metadata.issuer.replace(/\/+$/, '')
        ) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('MultiAI authorization validation failed. You can close this window.');
          finish(() => reject(new MultiAIOAuthError('invalid_callback', 'OAuth callback validation failed.')));
          return;
        }
        const oauthError = url.searchParams.get('error');
        if (oauthError !== null) {
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('MultiAI authorization was cancelled. You can close this window.');
          finish(() => reject(new MultiAIOAuthError(oauthError, 'MultiAI authorization was denied.')));
          return;
        }
        const code = url.searchParams.get('code');
        if (code === null || code.length === 0) {
          response.writeHead(400).end();
          finish(() => reject(new MultiAIOAuthError('invalid_callback', 'OAuth callback has no code.')));
          return;
        }
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          '<!doctype html><meta charset="utf-8"><title>MultiAI CLI</title><p>Вход выполнен. Это окно можно закрыть.</p>',
        );
        finish(() => resolve({ code, redirectUri: `http://127.0.0.1:${address.port}${callbackPath}` }));
      });
      server.once('error', (error) => finish(() => reject(error)));
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          finish(() => reject(new MultiAIOAuthError('loopback_failed', 'Unable to bind OAuth callback listener.')));
          return;
        }
        const redirectUri = `http://127.0.0.1:${address.port}${callbackPath}`;
        const authorizationUri = buildAuthorizationUri({
          metadata,
          config: this.config,
          attempt,
          redirectUri,
          deviceName,
        });
        try {
          const notified = options.onAuthorization?.({
            method: 'browser',
            authorizationUri,
            redirectUri,
            expiresIn: BROWSER_LOGIN_TIMEOUT_MS / 1000,
          });
          void Promise.resolve(notified).catch((error: unknown) => {
            finish(() => reject(error));
          });
        } catch (error) {
          finish(() => reject(error));
        }
      });
      timeout = setTimeout(
        () => finish(() => reject(new MultiAIOAuthError('expired_token', 'MultiAI login expired.'))),
        BROWSER_LOGIN_TIMEOUT_MS,
      );
      options.signal?.addEventListener(
        'abort',
        () => finish(() => reject(new MultiAIOAuthError('cancelled', 'MultiAI login was cancelled.'))),
        { once: true },
      );
    });
    return result;
  }

  private async loginWithDevice(
    metadata: OAuthAuthorizationServerMetadata,
    verifier: string,
    challenge: string,
    deviceName: string,
    options: MultiAILoginOptions,
  ): Promise<MultiAITokenResponse> {
    const authorization = await requestDeviceAuthorization({
      metadata,
      config: this.config,
      challenge,
      deviceName,
      fetchImpl: this.fetchImpl,
    });
    await options.onAuthorization?.({ method: 'device', ...authorization });
    const deadline = this.now() + authorization.expiresIn;
    let interval = authorization.interval;
    while (this.now() < deadline) {
      requestAborted(options.signal);
      await this.sleep(interval * 1000);
      requestAborted(options.signal);
      const result = await pollDeviceToken({
        metadata,
        config: this.config,
        deviceCode: authorization.deviceCode,
        verifier,
        fetchImpl: this.fetchImpl,
        now: this.now,
      });
      if (result.kind === 'success') return result.token;
      if (result.kind === 'denied') {
        throw new MultiAIOAuthError('access_denied', 'MultiAI authorization was denied.');
      }
      if (result.kind === 'expired') {
        throw new MultiAIOAuthError('expired_token', 'MultiAI device authorization expired.');
      }
      if (result.kind === 'pending' && result.slowDown) {
        interval = Math.min(interval + 5, 30);
      }
    }
    throw new MultiAIOAuthError('expired_token', 'MultiAI device authorization expired.');
  }

  private async acceptLoginToken(
    token: MultiAITokenResponse,
    metadata: OAuthAuthorizationServerMetadata,
    persistence: MultiAIOAuthPersistence,
    nonce: string | undefined,
  ): Promise<MultiAILoginResult> {
    if (token.idToken === undefined) {
      throw new MultiAIOAuthError('invalid_id_token', 'MultiAI did not return an ID token.');
    }
    const verified = await verifyIdToken({
      token: token.idToken,
      metadata,
      clientId: this.config.clientId,
      nonce,
      now: this.now,
    });
    const current = await fetchUserInfo({
      metadata,
      accessToken: token.accessToken,
      fetchImpl: this.fetchImpl,
    });
    const identity = mergeIdentity(verified, current);
    const storage = this.storageFor(persistence);
    const previous = await storage.load(this.sessionKey);
    const next: PersistedOAuthSession = {
      schemaVersion: 1,
      revision: (previous?.revision ?? 0) + 1,
      issuer: metadata.issuer,
      clientId: this.config.clientId,
      subject: identity.subject,
      scopes: token.scopes,
      refreshToken: token.refreshToken,
    };
    try {
      if (!(await storage.compareAndSwap(this.sessionKey, previous?.revision, next))) {
        throw new MultiAIOAuthLoginRequiredError('MultiAI credential changed during login.');
      }
    } catch (error) {
      await revokeToken({ metadata, config: this.config, refreshToken: token.refreshToken, fetchImpl: this.fetchImpl });
      await storage.remove(this.sessionKey).catch(() => undefined);
      throw error;
    }
    this.accessSession = { token, identity, persistence };
    return { providerName: 'managed:multiai', identity, scopes: token.scopes, persistence };
  }

  async hasSession(): Promise<boolean> {
    await this.cleanupLegacyCredential();
    if (this.accessSession !== undefined) return true;
    return (await this.keyringStorage.load(this.sessionKey)) !== undefined;
  }

  getCachedAccessToken(): string | undefined {
    return this.accessSession?.token.accessToken;
  }

  getIdentity(): MultiAIIdentity | undefined {
    return this.accessSession?.identity;
  }

  async getAccessToken(options: { readonly force?: boolean } = {}): Promise<string> {
    await this.cleanupLegacyCredential();
    const cached = this.accessSession;
    if (
      options.force !== true &&
      cached !== undefined &&
      cached.token.expiresAt - this.now() > ACCESS_REFRESH_SKEW_SECONDS
    ) {
      return cached.token.accessToken;
    }
    this.refreshInFlight ??= this.refreshAccessToken().finally(() => {
      this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
  }

  private async refreshAccessToken(): Promise<string> {
    const persistence = this.accessSession?.persistence ?? 'keyring';
    if (persistence === 'session') return this.refreshUnderLock(this.memoryStorage, undefined, persistence);
    const target = join(this.homeDir, 'locks', `oauth-${lockName(this.sessionKey)}`);
    await mkdir(dirname(target), { recursive: true });
    await open(target, 'a').then((handle) => handle.close());
    const release = await lockfile.lock(target, {
      retries: { retries: 60, factor: 1, minTimeout: 250, maxTimeout: 1_000 },
      stale: 30_000,
      update: 10_000,
      realpath: false,
    });
    try {
      return await this.refreshUnderLock(this.keyringStorage, target, persistence);
    } finally {
      await release().catch(() => undefined);
    }
  }

  private async refreshUnderLock(
    storage: SecureSessionStorage,
    _lockTarget: string | undefined,
    persistence: MultiAIOAuthPersistence,
  ): Promise<string> {
    const current = await storage.load(this.sessionKey);
    if (current === undefined || current.value.refreshToken.length === 0) {
      this.accessSession = undefined;
      throw new MultiAIOAuthLoginRequiredError();
    }
    let metadata: OAuthAuthorizationServerMetadata;
    let token: MultiAITokenResponse;
    try {
      metadata = await this.metadata();
      token = await refreshToken({
        metadata,
        config: this.config,
        refreshToken: current.value.refreshToken,
        fetchImpl: this.fetchImpl,
        now: this.now,
      });
    } catch (error) {
      await storage.remove(this.sessionKey).catch(() => undefined);
      this.accessSession = undefined;
      throw error;
    }
    const next: PersistedOAuthSession = {
      ...current.value,
      revision: current.revision + 1,
      scopes: token.scopes,
      refreshToken: token.refreshToken,
    };
    try {
      if (!(await storage.compareAndSwap(this.sessionKey, current.revision, next))) {
        throw new MultiAIOAuthLoginRequiredError('MultiAI credential rotation could not be committed.');
      }
    } catch (error) {
      await storage.remove(this.sessionKey).catch(() => undefined);
      this.accessSession = undefined;
      throw new MultiAIOAuthLoginRequiredError(
        'MultiAI credential rotation could not be saved; sign in again.',
        { cause: error },
      );
    }
    let identity: MultiAIIdentity = {
      issuer: current.value.issuer,
      subject: current.value.subject,
    };
    if (token.idToken !== undefined) {
      try {
        const verified = await verifyIdToken({
          token: token.idToken,
          metadata,
          clientId: this.config.clientId,
          now: this.now,
        });
        identity = mergeIdentity(identity, verified);
      } catch (error) {
        await storage.remove(this.sessionKey).catch(() => undefined);
        this.accessSession = undefined;
        throw new MultiAIOAuthLoginRequiredError(
          'MultiAI returned an invalid identity token; sign in again.',
          { cause: error },
        );
      }
    }
    try {
      const freshIdentity = await fetchUserInfo({
        metadata,
        accessToken: token.accessToken,
        fetchImpl: this.fetchImpl,
      });
      identity = mergeIdentity(identity, freshIdentity);
    } catch (error) {
      if (
        error instanceof MultiAIAccountUnavailableError ||
        error instanceof MultiAIOAuthLoginRequiredError
      ) {
        await storage.remove(this.sessionKey).catch(() => undefined);
        this.accessSession = undefined;
        throw new MultiAIOAuthLoginRequiredError('The MultiAI account is unavailable.', { cause: error });
      }
      this.accessSession = { token, identity, persistence };
      throw error;
    }
    this.accessSession = { token, identity, persistence };
    return token.accessToken;
  }

  async invalidate(): Promise<void> {
    this.accessSession = undefined;
    await Promise.allSettled([
      this.keyringStorage.remove(this.sessionKey),
      this.memoryStorage.remove(this.sessionKey),
    ]);
  }

  async logout(): Promise<MultiAILogoutResult> {
    try {
      const metadata = await this.metadata().catch(() => undefined);
      const persistent = await this.keyringStorage.load(this.sessionKey).catch(() => undefined);
      const memory = await this.memoryStorage.load(this.sessionKey).catch(() => undefined);
      const refresh = memory?.value.refreshToken ?? persistent?.value.refreshToken;
      if (metadata !== undefined && refresh !== undefined) {
        await revokeToken({
          metadata,
          config: this.config,
          refreshToken: refresh,
          fetchImpl: this.fetchImpl,
        });
      }
    } catch {
      // Revocation is best-effort: local logout must succeed even while the
      // issuer is unavailable. The server-side token will expire normally.
    } finally {
      await this.invalidate();
    }
    return { providerName: 'managed:multiai', ok: true };
  }

  async getAccountSnapshot(): Promise<MultiAIAccountSnapshot> {
    return this.authorizedRequest((metadata, accessToken) =>
      fetchAccountSnapshot({ metadata, accessToken, fetchImpl: this.fetchImpl }),
    );
  }

  async getModels(): Promise<readonly MultiAIModelInfo[]> {
    return this.authorizedRequest((metadata, accessToken) =>
      fetchMultiAIModels({ metadata, accessToken, fetchImpl: this.fetchImpl }),
    );
  }

  private async authorizedRequest<T>(
    request: (metadata: OAuthAuthorizationServerMetadata, accessToken: string) => Promise<T>,
  ): Promise<T> {
    const metadata = await this.metadata();
    const accessToken = await this.getAccessToken();
    try {
      return await request(metadata, accessToken);
    } catch (error) {
      if (error instanceof MultiAIAccountUnavailableError) {
        await this.invalidate();
        throw new MultiAIOAuthLoginRequiredError('The MultiAI account is unavailable.', {
          cause: error,
        });
      }
      if (!(error instanceof MultiAIOAuthLoginRequiredError)) throw error;
    }
    const refreshed = await this.getAccessToken({ force: true });
    try {
      return await request(metadata, refreshed);
    } catch (error) {
      if (
        error instanceof MultiAIOAuthLoginRequiredError ||
        error instanceof MultiAIAccountUnavailableError
      ) {
        await this.invalidate();
      }
      throw error;
    }
  }

  private storageFor(persistence: MultiAIOAuthPersistence): SecureSessionStorage {
    return persistence === 'session' ? this.memoryStorage : this.keyringStorage;
  }
}

async function removeRecognizedLegacyCredential(): Promise<void> {
  const candidates = [join(homedir(), '.kimi-code', 'credentials', 'kimi-code.json')];
  for (const candidate of candidates) {
    let raw: string;
    try {
      raw = await readFile(candidate, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>)['access_token'] === 'string' &&
      typeof (parsed as Record<string, unknown>)['refresh_token'] === 'string'
    ) {
      await unlink(candidate).catch(() => undefined);
    }
  }
}
