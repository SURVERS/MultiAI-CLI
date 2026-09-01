import type { Command } from 'commander';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';
import { t } from '#/tui/i18n';

export function registerLogoutCommand(parent: Command): void {
  parent
    .command('logout')
    .description(t('Revoke the MultiAI connection and clear the local session.', 'Отозвать подключение MultiAI и очистить локальную сессию.'))
    .action(async () => {
      const harness = createMultiAIHarness({
        identity: createMultiAIHostIdentity(),
        uiMode: 'cli',
      });
      try {
        await harness.auth.logout();
        process.stdout.write(`${t('Signed out of MultiAI.', 'Вы вышли из MultiAI.')}\n`);
      } finally {
        await harness.close();
      }
    });
}
