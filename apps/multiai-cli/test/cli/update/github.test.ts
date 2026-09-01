import { describe, expect, it, vi } from 'vitest';

import {
  fetchLatestFromGitHub,
  fetchLatestVersionFromGitHub,
} from '#/cli/update/github';
import { MULTIAI_GITHUB_LATEST_RELEASE_URL } from '#/constant/app';

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe('GitHub release update check', () => {
  it('extracts and validates the latest v-prefixed release tag', async () => {
    const fetchImpl = vi.fn(async () =>
      redirect('https://github.com/SURVERS/MultiAI-CLI/releases/tag/v1.2.3'),
    ) as unknown as typeof fetch;

    await expect(fetchLatestVersionFromGitHub(fetchImpl)).resolves.toBe('1.2.3');
    expect(fetchImpl).toHaveBeenCalledWith(
      MULTIAI_GITHUB_LATEST_RELEASE_URL,
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('rejects missing, invalid, and non-redirect responses', async () => {
    const missingLocation = vi.fn(async () => redirect('', 302)) as unknown as typeof fetch;
    const invalid = vi.fn(async () =>
      redirect('https://github.com/SURVERS/MultiAI-CLI/releases/tag/latest'),
    ) as unknown as typeof fetch;
    const notFound = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;

    await expect(fetchLatestVersionFromGitHub(missingLocation)).rejects.toThrow();
    await expect(fetchLatestVersionFromGitHub(invalid)).rejects.toThrow(/invalid semver/);
    await expect(fetchLatestVersionFromGitHub(notFound)).rejects.toThrow(/HTTP 404/);
  });

  it('returns a fully rolled-out update without a private CDN manifest', async () => {
    const fetchImpl = vi.fn(async () =>
      redirect('/SURVERS/MultiAI-CLI/releases/tag/1.0.0'),
    ) as unknown as typeof fetch;

    await expect(fetchLatestFromGitHub(fetchImpl)).resolves.toEqual({
      latest: '1.0.0',
      manifest: null,
    });
  });
});
