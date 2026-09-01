import { describe, expect, it } from 'vitest';

import {
  createCliTelemetryBootstrap,
  initializeCliTelemetry,
  initializeServerTelemetry,
} from '#/cli/telemetry';

describe('disabled product telemetry', () => {
  it('creates a non-identifying CLI bootstrap', () => {
    expect(createCliTelemetryBootstrap()).toMatchObject({
      deviceId: 'telemetry-disabled',
      firstLaunch: false,
    });
  });

  it('keeps CLI initialization as a no-op', () => {
    expect(
      initializeCliTelemetry({
        harness: {} as never,
        bootstrap: createCliTelemetryBootstrap(),
        config: {},
        version: '1.0.0',
        uiMode: 'shell',
      }),
    ).toBeUndefined();
  });

  it('returns an inert server client', () => {
    const client = initializeServerTelemetry({ version: '1.0.0' });
    expect(client.withContext?.({ sessionId: 'session-1' })).toBe(client);
    expect(client.track?.('startup', {})).toBeUndefined();
    expect(client.setContext?.({ sessionId: 'session-1' })).toBeUndefined();
  });
});
