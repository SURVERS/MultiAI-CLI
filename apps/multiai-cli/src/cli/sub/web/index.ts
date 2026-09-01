/**
 * `multiai web` — run the local MultiAI server (REST + WebSocket + web UI) in the
 * foreground and open the web UI in the default browser.
 *
 * The command itself is the runner (`multiai web` = start the server + open the
 * browser; `--no-open` to skip). The server stays attached to the terminal
 * and stops with Ctrl+C, so there is no kill/ps subcommand; the only
 * management subcommand is `web rotate-token` (rotate the home-wide bearer
 * token).
 */

import type { Command } from 'commander';

import { registerRotateTokenCommand } from './rotate-token';
import { buildWebCommand } from './run';

export function registerWebCommand(program: Command): void {
  const web = buildWebCommand(
    program
      .command('web')
      .description('Run the local MultiAI server and open the web UI.'),
  );
  registerRotateTokenCommand(web);
}
