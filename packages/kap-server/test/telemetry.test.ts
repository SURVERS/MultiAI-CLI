/**
 * Kap server telemetry composition tests.
 *
 * MultiAI deliberately does not attach a product telemetry appender. The
 * lifecycle hooks remain no-ops so hosts may still provide their own appender.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  bootstrap,
  type ITelemetryAppender,
  ITelemetryService,
  logSeed,
  resolveConfigPath,
  resolveLoggingConfig,
  type Scope,
  TelemetryService,
} from '@multiai/agent-core-v2';
import { readMultiAIDeviceId } from '@multiai/oauth';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeServerTelemetry, shutdownServerTelemetry } from '../src/services/telemetry';

describe('server telemetry', () => {
  let home: string;
  let core: Scope | undefined;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'multiai-server-telemetry-'));
  });

  afterEach(async () => {
    core?.dispose();
    await rm(home, { recursive: true, force: true });
  });

  function bootCore(telemetry?: TelemetryService): Scope {
    const logging = resolveLoggingConfig({ homeDir: home, env: process.env });
    const { app } = bootstrap(
      {
        homeDir: home,
        configPath: resolveConfigPath({ homeDir: home }),
        env: process.env,
      },
      [
        ...logSeed(logging),
        ...(telemetry === undefined ? [] : ([[ITelemetryService, telemetry]] as const)),
      ],
    );
    core = app;
    return app;
  }

  it('does not attach product telemetry or create a device identifier', async () => {
    const app = bootCore();
    const telemetry = await initializeServerTelemetry(app, home);

    expect(telemetry).toEqual({});
    expect(readMultiAIDeviceId(home)).toBeNull();

    await expect(shutdownServerTelemetry(telemetry)).resolves.toBeUndefined();
  });

  it('preserves a host-provided telemetry appender', async () => {
    const events: string[] = [];
    const appender: ITelemetryAppender = {
      track: (event) => events.push(event),
    };
    const hostTelemetry = new TelemetryService();
    hostTelemetry.addAppender(appender);
    const app = bootCore(hostTelemetry);
    const lifecycle = await initializeServerTelemetry(app, home);

    app.accessor.get(ITelemetryService).track('host_probe');
    await shutdownServerTelemetry(lifecycle);
    app.accessor.get(ITelemetryService).track('host_after_shutdown');

    expect(events).toEqual(['host_probe', 'host_after_shutdown']);
  });
});
