import {
  MultiAISecureStorageUnavailableError,
  type MultiAIAuthorization,
  type MultiAIOAuthPersistence,
} from '@multiai/oauth';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';
import { t } from '#/tui/i18n';
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
    process.stderr.write(`${t('Signed in to', 'Выполнен вход в')} ${result.providerName}.\n`);
    process.exit(0);
  } catch (error) {
    if (controller.signal.aborted) {
      process.stderr.write(`${t('Login cancelled.', 'Вход отменён.')}\n`);
    } else if (
      error instanceof MultiAISecureStorageUnavailableError &&
      options.persistence !== 'session'
    ) {
      process.stderr.write(
        `${t('The operating-system credential store is unavailable. Re-run with --session-only for a process-local session.', 'Хранилище учётных данных операционной системы недоступно. Повторите запуск с --session-only для сессии текущего процесса.')}\n`,
      );
    } else {
      process.stderr.write(
        `${t('Login failed:', 'Ошибка входа:')} ${error instanceof Error ? error.message : String(error)}\n`,
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
          `${t('Opening MultiAI sign-in:', 'Открываем вход в MultiAI:')} ${url}`,
          t('If the browser did not open, paste the URL above.', 'Если браузер не открылся, вставьте указанный выше URL.'),
          t('Waiting for the browser callback...', 'Ожидание ответа браузера...'),
          '',
        ]
      : [
          '',
          `${t('Open this URL:', 'Откройте этот URL:')} ${url}`,
          `${t('Device code:', 'Код устройства:')} ${authorization.userCode}`,
          `${t('Code expires in', 'Код истекает через')} ${authorization.expiresIn}${t('s.', ' с.')}`,
          t('Waiting for authorization...', 'Ожидание авторизации...'),
          '',
        ];
  process.stderr.write(lines.join('\n'));
  try {
    openUrl(url);
  } catch {
    return;
  }
}
