import { describe, expect, it } from 'vitest';

import {
  accountSnapshotSchema,
  oauthFlowStartSchema,
} from '../../../src/app/auth/oauthProtocol';

describe('MultiAI auth wire contracts', () => {
  it('accepts browser and device login starts as distinct methods', () => {
    expect(
      oauthFlowStartSchema.parse({
        flow_id: 'flow-browser',
        provider: 'managed:multiai',
        method: 'browser',
        persistence: 'keyring',
        status: 'pending',
        authorization_uri: 'https://multiai.store/oauth/authorize?client_id=client',
        redirect_uri: 'http://127.0.0.1:49152/oauth/callback',
        expires_in: 600,
        expires_at: '2026-07-29T12:00:00.000Z',
      }),
    ).toMatchObject({ method: 'browser' });

    expect(
      oauthFlowStartSchema.parse({
        flow_id: 'flow-device',
        provider: 'managed:multiai',
        method: 'device',
        persistence: 'session',
        status: 'pending',
        verification_uri: 'https://multiai.store/device',
        verification_uri_complete: 'https://multiai.store/device?user_code=ABCD',
        user_code: 'ABCD',
        interval: 5,
        expires_in: 600,
        expires_at: '2026-07-29T12:00:00.000Z',
      }),
    ).toMatchObject({ method: 'device' });
  });

  it('validates profile, wallet, limits, connection scopes, and masked keys', () => {
    expect(
      accountSnapshotSchema.parse({
        user: {
          sub: 'account-1',
          display_name: 'Example',
          email: 'person@example.test',
          email_verified: true,
        },
        account: {
          wallet: {
            total: 100,
            classic: 25,
            new: 75,
            billing_mode: 'prepaid',
          },
          subscription: {
            active: true,
            available: true,
            limits: {
              five_hour: { enabled: true, remaining_percent: 80 },
              weekly: { enabled: true, remaining_percent: 60 },
              monthly: { enabled: false, remaining_percent: 0 },
            },
          },
          generated_at: '2026-07-29T11:00:00.000Z',
        },
        keys: [{ id: 1, name: 'CLI', key: 'ma-…abcd', status: 'active' }],
        connection: {
          id: 'connection-1',
          client_id: 'client-1',
          client_name: 'MultiAI CLI',
          device_name: 'workstation',
          scopes: ['openid', 'ai:invoke'],
          expires_at: '2026-10-27T11:00:00.000Z',
        },
        generated_at: '2026-07-29T11:00:00.000Z',
      }),
    ).toMatchObject({ user: { sub: 'account-1' } });
  });
});
