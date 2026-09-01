import type { Command } from 'commander';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';
import { t } from '#/tui/i18n';

export function registerAccountCommand(parent: Command): void {
  parent
    .command('account')
    .alias('profile')
    .description(t('Show the current MultiAI profile, balance, usage quotas, subscription, scopes, and API keys.', 'Показать профиль MultiAI, баланс, квоты, подписку, области доступа и API-ключи.'))
    .option('--json', t('Print the account snapshot as JSON.', 'Вывести данные аккаунта в формате JSON.'), false)
    .action(async (options: { json: boolean }) => {
      const harness = createMultiAIHarness({
        identity: createMultiAIHostIdentity(),
        uiMode: 'cli',
      });
      try {
        const snapshot = await harness.auth.getAccount();
        process.stdout.write(
          options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : formatAccount(snapshot),
        );
      } finally {
        await harness.close();
      }
    });
}

function formatAccount(snapshot: Awaited<ReturnType<ReturnType<typeof createMultiAIHarness>['auth']['getAccount']>>): string {
  const user = snapshot.user;
  const profile = user.display_name ?? user.email ?? user.sub;
  const wallet = snapshot.account.wallet;
  const subscription = snapshot.account.subscription;
  const rows = [
    `${t('Profile:', 'Профиль:')} ${profile}`,
    ...(user.email === undefined
      ? []
      : [`${t('Email:', 'Эл. почта:')} ${user.email}${user.email_verified === true ? t(' (verified)', ' (подтверждена)') : ''}`]),
    `${t('Balance:', 'Баланс:')} ${wallet.total} ${t('total', 'всего')} (${wallet.classic} classic, ${wallet.new} new)`,
    `${t('Billing mode:', 'Режим оплаты:')} ${wallet.billing_mode}`,
    `${t('Subscription:', 'Подписка:')} ${subscription.active ? t('active', 'активна') : subscription.available ? t('available', 'доступна') : t('inactive', 'неактивна')}`,
    t('Usage quotas:', 'Квоты использования:'),
    ...Object.entries(subscription.limits).map(([name, limit]) => {
      const reset = limit.reset_at === undefined ? '' : `, resets ${limit.reset_at}`;
      return `  ${name.replaceAll('_', ' ')}: ${String(limit.remaining_percent)}% remaining${reset}`;
    }),
    `${t('Scopes:', 'Области доступа:')} ${snapshot.connection.scopes.join(', ') || t('none', 'нет')}`,
    `${t('Connection:', 'Подключение:')} ${snapshot.connection.client_name} ${t('on', 'на')} ${snapshot.connection.device_name}`,
    `${t('Connection expires:', 'Подключение истекает:')} ${snapshot.connection.expires_at}`,
    t('API keys:', 'API-ключи:'),
    ...(snapshot.keys.length === 0
      ? [t('  No visible API keys.', '  Нет доступных API-ключей.')]
      : snapshot.keys.map((key) => `  ${key.name}: ${key.key} (${key.status})`)),
  ];
  return `${rows.join('\n')}\n`;
}
