import type { Command } from 'commander';
import { createMultiAIHarness } from '@multiai/sdk';

import { createMultiAIHostIdentity } from '#/cli/version';

export function registerLogoutCommand(parent: Command): void {
  parent
    .command('logout')
    .description('Revoke the MultiAI connection and clear the local session.')
    .action(async () => {
      const harness = createMultiAIHarness({
        identity: createMultiAIHostIdentity(),
        uiMode: 'cli',
      });
      try {
        await harness.auth.logout();
        process.stdout.write('Signed out of MultiAI.\n');
      } finally {
        await harness.close();
      }
    });
}
