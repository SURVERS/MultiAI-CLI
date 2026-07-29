import type { Command } from 'commander';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';

export function registerAccountCommand(parent: Command): void {
  parent
    .command('account')
    .description('Show the current MultiAI profile, balance, limits, scopes, and API keys.')
    .option('--json', 'Print the account snapshot as JSON.', false)
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
  const profile = snapshot.user.display_name ?? snapshot.user.email ?? snapshot.user.sub;
  const wallet = snapshot.account.wallet;
  const limits = snapshot.account.subscription.limits;
  const rows = [
    `Account: ${profile}`,
    `Balance: ${wallet.total}`,
    `Billing mode: ${wallet.billing_mode}`,
    `5-hour remaining: ${limits.five_hour.remaining_percent}%`,
    `Weekly remaining: ${limits.weekly.remaining_percent}%`,
    `Monthly remaining: ${limits.monthly.remaining_percent}%`,
    `Scopes: ${snapshot.connection.scopes.join(', ')}`,
    'API keys:',
    ...snapshot.keys.map((key) => `  ${key.name}: ${key.key} (${key.status})`),
  ];
  return `${rows.join('\n')}\n`;
}
