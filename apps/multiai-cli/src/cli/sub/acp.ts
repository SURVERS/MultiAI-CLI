/**
 * `multiai acp` sub-command.
 *
 * Starts the Agent Client Protocol (ACP) server over stdio so that
 * ACP-compatible clients (editors, IDEs, custom front-ends) can drive
 * a MultiAI CLI session.
 *
 * Wire-up:
 *  - A {@link MultiAIHarness} is constructed with the MultiAI CLI host identity
 *    and a dedicated `uiMode: 'acp'` so downstream telemetry can
 *    distinguish ACP sessions from the TUI.
 *  - {@link runAcpServer} owns the JSON-RPC stdio bridge and redirects
 *    rogue `console.*` traffic to stderr.
 *  - `--login` pivots into the device-code login flow instead of
 *    starting the server. This is the entry point ACP clients hit
 *    via the first-class `AuthMethodTerminal` path when they re-invoke
 *    the agent binary with the advertised `args:['--login']` appended.
 *  - On stream close or unhandled error the process exits with the
 *    appropriate code.
 */

import type { Command } from 'commander';

import {
  ACP_BUILTIN_SLASH_COMMANDS,
  runAcpServer,
  type AvailableCommand,
  type SlashCommandsSnapshot,
} from '@multiai/acp-adapter';
import { createMultiAIHarness, type Session, type SkillSummary } from '@multiai/sdk';

import { MULTIAI_HOME_ENV } from '#/constant/app';
import { createMultiAIHostIdentity, getVersion } from '#/cli/version';
import { buildSkillSlashCommands } from '#/tui/commands/skills';
import { t } from '#/tui/i18n';

import { runLoginFlow } from './login-flow';

export function registerAcpCommand(parent: Command): void {
  parent
    .command('acp')
    .description(t('Run MultiAI CLI as an Agent Client Protocol (ACP) server over stdio.', 'Запустить MultiAI CLI как сервер Agent Client Protocol (ACP) через stdio.'))
    .option(
      '--login',
      t('Run the device-code login flow then exit (entry point for ACP terminal-auth).', 'Выполнить вход по коду устройства и завершить работу (точка входа для терминальной авторизации ACP).'),
      false,
    )
    .action(async (opts: { login?: boolean }) => {
      if (opts.login === true) {
        await runLoginFlow({ method: 'device', persistence: 'keyring' });
        return;
      }
      const identity = createMultiAIHostIdentity();
      const harness = createMultiAIHarness({
        identity,
        uiMode: 'acp',
      });
      // Forward `MULTIAI_HOME` (if set) into `authMethods[0].env` so the
      // `multiai login` subprocess clients spawn for terminal-auth writes its
      // token under the same data root the ACP server reads from. Used for
      // sandboxed test setups (Zed's `agent_servers.*.env.MULTIAI_HOME =
      // /tmp/...`). Production runs leave the env unset and the field stays
      // empty.
      const sandboxHome = process.env[MULTIAI_HOME_ENV];
      const terminalAuthEnv =
        sandboxHome !== undefined && sandboxHome.length > 0
          ? { [MULTIAI_HOME_ENV]: sandboxHome }
          : undefined;
      // Legacy `_meta.terminal-auth` fallback for clients that don't yet
      // honor the first-class `type:'terminal'` (Zed without the
      // AcpBetaFeatureFlag, current JetBrains plugin, etc.). `command` is
      // the absolute path to this very binary (`process.argv[1]`) so the
      // client can spawn it with `args:['login']` for the top-level
      // `multiai login` subcommand.
      const legacyCommand = process.argv[1];
      const builtinCommands: AvailableCommand[] = (ACP_BUILTIN_SLASH_COMMANDS as readonly AvailableCommand[]).map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        input: cmd.input,
      }));
      // Skills are session-scoped (per-cwd config), so we defer the
      // listSkills() call until the adapter hands us the just-created
      // Session — mirrors opencode's per-directory snapshot. A
      // listSkills() failure degrades to builtins-only so a broken
      // skill source never blanks the palette.
      const resolveSlashCommands = async (
        session: Session,
      ): Promise<SlashCommandsSnapshot> => {
        let skills: readonly SkillSummary[] = [];
        try {
          skills = await session.listSkills();
        } catch {
          skills = [];
        }
        // `buildSkillSlashCommands` already returns both views — the
        // palette entries (advertised via `available_commands_update`)
        // and the `commandName → skillName` map the adapter uses to
        // intercept `/skill:<name>` inputs and route them to
        // `Session.activateSkill`. Passing both through keeps the two
        // surfaces in lockstep (palette ↔ interceptable set) without
        // a second `listSkills()` round trip.
        const built = buildSkillSlashCommands(skills);
        const skillCommands = built.commands.map((cmd) => ({
          name: cmd.name,
          description: cmd.description,
        }));
        return {
          commands: [...builtinCommands, ...skillCommands],
          skillCommandMap: built.commandMap,
        };
      };
      try {
        await runAcpServer(harness, {
          agentInfo: { name: 'MultiAI CLI', version: getVersion() },
          slashCommands: resolveSlashCommands,
          ...(terminalAuthEnv ? { terminalAuthEnv } : {}),
          ...(legacyCommand !== undefined && legacyCommand.length > 0
            ? { terminalAuthLegacyCommand: legacyCommand }
            : {}),
        });
        process.exit(0);
      } catch (err) {
        process.stderr.write(`${t('acp server: fatal error:', 'сервер acp: критическая ошибка:')} ${String(err)}\n`);
        process.exit(1);
      }
    });
}
