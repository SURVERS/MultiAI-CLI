import type { Command } from 'commander';

import { runLoginFlow } from './login-flow';

export function registerLoginCommand(parent: Command): void {
  parent
    .command('login')
    .description('Sign in to your MultiAI account.')
    .option('--device', 'Use the device-code flow instead of a loopback browser callback.', false)
    .option('--session-only', 'Keep credentials only until this process exits.', false)
    .action(async (options: { device: boolean; sessionOnly: boolean }) => {
      await runLoginFlow({
        method: options.device ? 'device' : 'browser',
        persistence: options.sessionOnly ? 'session' : 'keyring',
      });
    });
}
