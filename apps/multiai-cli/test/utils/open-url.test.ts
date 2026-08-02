/**
 * Scenario: handing a query-rich authorization URL to the Windows default browser.
 * Responsibility: preserve the complete URL as one process argument without shell parsing.
 * Wiring: openUrl is real; node:child_process is the single stubbed OS-process boundary.
 * Run: pnpm --filter @multiai/cli exec vitest run test/utils/open-url.test.ts
 */
import { execFile } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openUrl } from '#/utils/open-url';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);
const originalPlatform = process.platform;

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  vi.clearAllMocks();
});

describe('openUrl (external browser handoff)', () => {
  it('preserves the complete authorization URL when the platform is Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const authorizationUrl =
      'https://example.test/oauth/authorize?response_type=code&client_id=public-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A49152%2Foauth%2Fcallback&state=state-value';

    openUrl(authorizationUrl);

    expect(execFileMock).toHaveBeenCalledWith(
      'rundll32.exe',
      ['url.dll,FileProtocolHandler', authorizationUrl],
      expect.any(Function),
    );
  });
});
