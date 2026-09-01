import { valid } from 'semver';
import { z } from 'zod';

import { MULTIAI_GITHUB_LATEST_RELEASE_URL } from '#/constant/app';

import type { UpdateManifest } from './types';

const GITHUB_FETCH_TIMEOUT_MS = 3_000;

const RolloutBatchSchema = z.object({
  percent: z.number().int().min(0).max(100),
  delaySeconds: z.number().int().min(0),
});

/**
 * Legacy rollout manifest schema kept for reading existing update caches.
 */
export const UpdateManifestSchema = z.object({
  version: z.string().refine((value) => valid(value) !== null, { error: 'invalid semver' }),
  publishedAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)), { error: 'invalid timestamp' }),
  rollout: z.array(RolloutBatchSchema).readonly().default([]),
});

export interface FetchLatestResult {
  /** Latest semver published as a GitHub release. */
  readonly latest: string;
  /** GitHub releases are not rollout-gated by this client. */
  readonly manifest: UpdateManifest | null;
}

async function fetchWithTimeout(fetchImpl: typeof fetch, input: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, GITHUB_FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(input, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'multiai-cli-update-check' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve GitHub's `/releases/latest` redirect and validate its tag as semver.
 *
 * **Throws** on any failure (network error, non-2xx, empty body, non-semver
 * text). Callers must catch — `refreshUpdateCache` deliberately lets the
 * error propagate so the existing cache stays intact instead of being
 * overwritten with a null `latest` on a transient blip.
 *
 * `fetchImpl` is injectable for tests; defaults to the global `fetch`.
 */
export async function fetchLatestVersionFromGitHub(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchWithTimeout(fetchImpl, MULTIAI_GITHUB_LATEST_RELEASE_URL);
  if (![301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error(`GitHub releases/latest returned HTTP ${response.status}`);
  }
  const location = response.headers.get('location');
  if (location === null) {
    throw new Error('GitHub releases/latest did not return a Location header');
  }
  const tag = new URL(location, MULTIAI_GITHUB_LATEST_RELEASE_URL).pathname
    .split('/')
    .filter(Boolean)
    .at(-1);
  const version = tag?.startsWith('v') ? tag.slice(1) : tag;
  if (version === undefined || valid(version) === null) {
    throw new Error(`GitHub latest release returned invalid semver tag: ${JSON.stringify(tag)}`);
  }
  return version;
}

/**
 * Fetch the latest MultiAI CLI release from GitHub.
 */
export async function fetchLatestFromGitHub(
  fetchImpl: typeof fetch = fetch,
): Promise<FetchLatestResult> {
  return {
    latest: await fetchLatestVersionFromGitHub(fetchImpl),
    manifest: null,
  };
}
