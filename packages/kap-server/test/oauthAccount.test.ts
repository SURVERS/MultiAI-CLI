import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  IOAuthService,
  type IOAuthService as IOAuthServiceType,
  type ScopeSeed,
} from '@multiai/agent-core-v2';
import {
  accountSnapshotSchema,
  type AccountSnapshot,
} from '@multiai/agent-core-v2/app/auth/oauthProtocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type RunningServer, startServer } from '../src/start';
import { authHeaders } from './helpers/auth';

interface Envelope<T> {
  code: number;
  msg: string;
  data: T;
  request_id: string;
}

describe('server-v2 GET /api/v1/oauth/account', () => {
  let server: RunningServer | undefined;
  let home: string | undefined;
  let base: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'multiai-server-v2-oauth-account-'));
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    if (home !== undefined) await rm(home, { recursive: true, force: true });
    home = undefined;
  });

  function oauthStub(getAccount: IOAuthServiceType['getAccount']): IOAuthServiceType {
    return {
      _serviceBrand: undefined,
      startLogin: async () => {
        throw new Error('unused');
      },
      getFlow: () => undefined,
      cancelLogin: async () => {
        throw new Error('unused');
      },
      logout: async () => {
        throw new Error('unused');
      },
      status: async () => ({ loggedIn: false }),
      refreshOAuthProviderModels: async () => ({ changed: [], unchanged: [], failed: [] }),
      getAccount,
      resolveTokenProvider: () => undefined,
      getCachedAccessToken: async () => undefined,
    };
  }

  async function boot(seeds: ScopeSeed): Promise<void> {
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      homeDir: home,
      logLevel: 'silent',
      seeds,
    });
    base = `http://127.0.0.1:${server.port}`;
  }

  it('returns the account snapshot and forwards the provider query', async () => {
    const snapshot: AccountSnapshot = {
      user: { sub: 'account-1', email: 'person@example.test', email_verified: true },
      account: {
        wallet: { total: 100, classic: 40, new: 60, billing_mode: 'prepaid' },
        subscription: {
          active: true,
          available: true,
          limits: {
            five_hour: { enabled: true, remaining_percent: 90 },
            weekly: { enabled: true, remaining_percent: 80 },
            monthly: { enabled: false, remaining_percent: 0 },
          },
        },
        generated_at: '2026-07-29T10:00:00.000Z',
      },
      keys: [{ id: 1, name: 'CLI', key: 'ma-…abcd', status: 'active' }],
      connection: {
        id: 'connection-1',
        client_id: 'client-1',
        client_name: 'MultiAI CLI',
        device_name: 'workstation',
        scopes: ['openid', 'account:read'],
        expires_at: '2026-10-27T10:00:00.000Z',
      },
      generated_at: '2026-07-29T10:00:00.000Z',
    };
    const getAccount = vi.fn(async () => snapshot);
    await boot([[IOAuthService, oauthStub(getAccount)]] as unknown as ScopeSeed);

    const response = await fetch(
      `${base}/api/v1/oauth/account?provider=managed%3Amultiai`,
      { headers: authHeaders(server as RunningServer) } as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Envelope<AccountSnapshot>;
    expect(accountSnapshotSchema.parse(body.data)).toEqual(snapshot);
    expect(getAccount).toHaveBeenCalledWith('managed:multiai');
  });
});
