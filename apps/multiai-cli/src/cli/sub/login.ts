import type { Command } from 'commander';

import { t } from '#/tui/i18n';

import { runLoginFlow } from './login-flow';

export function registerLoginCommand(parent: Command): void {
  parent
    .command('login')
    .description(t('Sign in to your MultiAI account.', 'Войти в аккаунт MultiAI.'))
    .option(
      '--device',
      t('Use the device-code flow instead of a loopback browser callback.', 'Использовать вход по коду устройства вместо обратного вызова браузера.'),
      false,
    )
    .option('--session-only', t('Keep credentials only until this process exits.', 'Хранить учётные данные только до завершения процесса.'), false)
    .action(async (options: { device: boolean; sessionOnly: boolean }) => {
      await runLoginFlow({
        method: options.device ? 'device' : 'browser',
        persistence: options.sessionOnly ? 'session' : 'keyring',
      });
    });
}
