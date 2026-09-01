/**
 * Product telemetry is intentionally disabled for the MultiAI server.
 *
 * The no-op lifecycle surface remains so server startup and shutdown do not
 * need product-specific branches.
 */

import type { Scope } from '@multiai/agent-core-v2';

export type ServerTelemetry = Readonly<Record<string, never>>;

export function initializeServerTelemetry(
  _core: Scope,
  _homeDir: string,
): Promise<ServerTelemetry> {
  return Promise.resolve({});
}

export function shutdownServerTelemetry(
  _telemetry: ServerTelemetry,
  _deadlineMs?: number,
): Promise<void> {
  return Promise.resolve();
}
