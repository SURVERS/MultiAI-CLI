import {
  MultiAISecureStorageUnavailableError,
  type MultiAIAuthorization,
  type MultiAIOAuthPersistence,
} from '@multiai/oauth';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';
import { openUrl } from '#/utils/open-url';

export async function runLoginFlow(options: {
  readonly method: 'browser' | 'device';
  readonly persistence: MultiAIOAuthPersistence;
}): Promise<never> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  try {
    const result = await harness.auth.login({
      ...options,
      signal: controller.signal,
      onAuthorization: showAuthorization,
    });
    process.stderr.write(`Signed in to ${result.providerName}.\n`);
    process.exit(0);
  } catch (error) {
    if (controller.signal.aborted) {
      process.stderr.write('Login cancelled.\n');
    } else if (
      error instanceof MultiAISecureStorageUnavailableError &&
      options.persistence !== 'session'
    ) {
      process.stderr.write(
        'The operating-system credential store is unavailable. Re-run with --session-only for a process-local session.\n',
      );
    } else {
      process.stderr.write(
        `Login failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
    process.exit(1);
  } finally {
    await harness.close().catch(() => undefined);
  }
}

function showAuthorization(authorization: MultiAIAuthorization): void {
  const url =
    authorization.method === 'browser'
      ? authorization.authorizationUri
      : authorization.verificationUriComplete;
  const lines =
    authorization.method === 'browser'
      ? [
          '',
          `Opening MultiAI sign-in: ${url}`,
          'If the browser did not open, paste the URL above.',
          'Waiting for the browser callback...',
          '',
        ]
      : [
          '',
          `Open this URL: ${url}`,
          `Device code: ${authorization.userCode}`,
          `Code expires in ${authorization.expiresIn}s.`,
          'Waiting for authorization...',
          '',
        ];
  process.stderr.write(lines.join('\n'));
  try {
    openUrl(url);
  } catch {
    return;
  }
}
