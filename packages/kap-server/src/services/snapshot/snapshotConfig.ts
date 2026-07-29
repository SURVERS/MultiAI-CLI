/**
 * Env-driven knobs for the snapshot read path. Read once at route registration.
 *
 * Mirrors v1 (`packages/server/src/services/snapshot/snapshotConfig.ts`):
 *
 *   MULTIAI_SNAPSHOT_READER       'auto' (default) | 'legacy'
 *   MULTIAI_SNAPSHOT_TIMEOUT_MS   integer ms hard ceiling on the auto path (default 4000)
 *   MULTIAI_SNAPSHOT_CACHE_LIMIT  transcript LRU entries (default 32)
 */

export type SnapshotReaderMode = 'auto' | 'legacy';

export interface SnapshotConfig {
  readonly mode: SnapshotReaderMode;
  readonly timeoutMs: number;
  readonly cacheLimit: number;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_CACHE_LIMIT = 32;

function parseInteger(value: string | undefined, fallback: number, min: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

export function loadSnapshotConfig(env: NodeJS.ProcessEnv = process.env): SnapshotConfig {
  const rawMode = env['MULTIAI_SNAPSHOT_READER']?.trim().toLowerCase();
  const mode: SnapshotReaderMode = rawMode === 'legacy' ? 'legacy' : 'auto';
  return {
    mode,
    timeoutMs: parseInteger(env['MULTIAI_SNAPSHOT_TIMEOUT_MS'], DEFAULT_TIMEOUT_MS, 100),
    cacheLimit: parseInteger(env['MULTIAI_SNAPSHOT_CACHE_LIMIT'], DEFAULT_CACHE_LIMIT, 1),
  };
}
