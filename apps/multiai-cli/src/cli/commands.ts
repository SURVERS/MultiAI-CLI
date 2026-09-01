import { CLI_COMMAND_NAME } from '#/constant/app';
import { Command, InvalidArgumentError, Option } from 'commander';

import { t } from '#/tui/i18n';

import type { CLIOptions } from './options';
import { registerAcpCommand } from './sub/acp';
import { registerDoctorCommand } from './sub/doctor';
import { registerExportCommand } from './sub/export';
import { registerLoginCommand } from './sub/login';
import { registerLogoutCommand } from './sub/logout';
import { registerAccountCommand } from './sub/account';
import { registerProviderCommand } from './sub/provider';
import { registerVisCommand } from './sub/vis';
import { registerWebCommand } from './sub/web';

export type MainCommandHandler = (opts: CLIOptions) => void;
export type PluginNodeRunnerHandler = (entry: string, args: readonly string[]) => void;
export type UpgradeCommandHandler = () => void | Promise<void>;

export function createProgram(
  version: string,
  onMain: MainCommandHandler,
  onPluginNodeRunner: PluginNodeRunnerHandler = () => {},
  onUpgrade: UpgradeCommandHandler = () => {},
): Command {
  const program = new Command(CLI_COMMAND_NAME)
    .description(t('The Starting Point for Next-Gen Agents', 'Отправная точка для агентов нового поколения'))
    .version(version, '-V, --version')
    .allowUnknownOption(false)
    .configureHelp({ helpWidth: 100 })
    .helpOption('-h, --help', t('Show help.', 'Показать справку.'))
    .usage(t('[options] [command]', '[параметры] [команда]'))
    .addHelpText(
      'after',
      t(
        '\nDocumentation:        https://survers.github.io/MultiAI-CLI/\n',
        '\nДокументация:          https://survers.github.io/MultiAI-CLI/\n',
      ),
    );

  program
    .addOption(
      new Option(
        '-S, --session [id]',
        t('Resume a session. With ID: resume that session. Without ID: interactively pick.', 'Возобновить сессию. С ID — указанную сессию, без ID — выбрать интерактивно.'),
      ).argParser((val: string | boolean) => (val === true ? '' : (val as string))),
    )
    .addOption(
      new Option('-r, --resume [id]')
        .hideHelp()
        .argParser((val: string | boolean) => (val === true ? '' : (val as string))),
    )
    .option('-c, --continue', t('Continue the previous session for the working directory.', 'Продолжить предыдущую сессию для рабочей директории.'), false)
    .addOption(new Option('-C').hideHelp().default(false))
    .option('-y, --yolo', t('Auto-approve regular tool calls; the agent may still ask questions.', 'Автоматически подтверждать обычные вызовы инструментов; агент всё ещё может задавать вопросы.'), false)
    .option('--auto', t('Start in auto permission mode: fully autonomous, the agent will not ask questions.', 'Запустить в автоматическом режиме разрешений: полностью автономно, без вопросов от агента.'), false)
    .addOption(
      new Option(
        '-m, --model <model>',
        t('LLM model alias to use for this invocation. Defaults to default_model in config.toml.', 'Псевдоним модели LLM для этого запуска. По умолчанию используется default_model из config.toml.'),
      ),
    )
    .addOption(
      new Option(
        '-p, --prompt <prompt>',
        t('Run one prompt non-interactively and print the response.', 'Выполнить один запрос без интерактивного режима и вывести ответ.'),
      ),
    )
    .addOption(
      new Option(
        '--output-format <format>',
        t('Output format for prompt mode. Defaults to text.', 'Формат вывода в режиме запроса. По умолчанию — text.'),
      ).choices(['text', 'stream-json']),
    )
    .addOption(
      new Option(
        '--skills-dir <dir>',
        t('Load skills from this directory instead of auto-discovered user and project directories. Can be repeated.', 'Загружать навыки из этой директории вместо автоматически найденных пользовательских и проектных директорий. Можно указать несколько раз.'),
      )
        .argParser((value: string, previous: string[] | undefined) => [...(previous ?? []), value])
        .default([]),
    )
    .addOption(
      new Option(
        '--agent <name>',
        t('Agent profile to use for this invocation (v2 engine only). Custom profiles are discovered from agent directories or loaded via --agent-file.', 'Профиль агента для этого запуска (только движок v2). Пользовательские профили ищутся в директориях агентов или загружаются через --agent-file.'),
      )
        .argParser((value: string, previous: string | undefined) => {
          if (previous !== undefined) {
            throw new InvalidArgumentError(t('--agent may only be specified once.', '--agent можно указать только один раз.'));
          }
          return value;
        })
        .conflicts('agentFile'),
    )
    .addOption(
      new Option(
        '--agent-file <path>',
        t('Load an agent definition from a Markdown file and select it (v2 engine only).', 'Загрузить определение агента из файла Markdown и выбрать его (только движок v2).'),
      )
        .argParser((value: string, previous: string[] | undefined) => {
          if ((previous?.length ?? 0) > 0) {
            throw new InvalidArgumentError(t('--agent-file may only be specified once.', '--agent-file можно указать только один раз.'));
          }
          return [value];
        })
        .conflicts('agent')
        .default([]),
    )
    .addOption(
      new Option(
        '--add-dir <dir>',
        t('Add an additional workspace directory for this session. Can be repeated.', 'Добавить дополнительную рабочую директорию для этой сессии. Можно указать несколько раз.'),
      )
        .argParser((value: string, previous: string[] | undefined) => [...(previous ?? []), value])
        .default([]),
    )
    .addOption(new Option('--yes').hideHelp().default(false))
    .addOption(new Option('--auto-approve').hideHelp().default(false))
    .option('--plan', t('Start in plan mode.', 'Запустить в режиме планирования.'), false);

  registerExportCommand(program);
  registerProviderCommand(program);
  registerAcpCommand(program);
  registerWebCommand(program);
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerAccountCommand(program);
  registerDoctorCommand(program);
  registerVisCommand(program);
  program
    .command('upgrade')
    .alias('update')
    .description(t('Upgrade MultiAI CLI to the latest version.', 'Обновить MultiAI CLI до последней версии.'))
    .action(async () => {
      await onUpgrade();
    });

  program
    .command('__plugin_run_node', { hidden: true })
    .argument('<entry>')
    .argument('[args...]')
    .allowUnknownOption(true)
    .action((entry: string, args: string[]) => {
      onPluginNodeRunner(entry, args);
    });

  program.argument('[args...]').action((args: string[]) => {
    if (args.length > 0) {
      program.error(t(`unknown command '${args[0]}'. See '${CLI_COMMAND_NAME} --help'.`, `неизвестная команда '${args[0]}'. См. '${CLI_COMMAND_NAME} --help'.`));
    }

    const raw = program.opts<Record<string, unknown>>();

    const rawSession = raw['session'] ?? raw['resume'];
    const sessionValue = rawSession === true ? '' : (rawSession as string | undefined);
    const yoloValue = raw['yolo'] === true || raw['yes'] === true || raw['autoApprove'] === true;
    const autoValue = raw['auto'] === true;

    const opts: CLIOptions = {
      session: sessionValue,
      continue: raw['continue'] === true || raw['C'] === true,
      yolo: yoloValue,
      auto: autoValue,
      plan: raw['plan'] as boolean,
      model: raw['model'] as string | undefined,
      outputFormat: raw['outputFormat'] as CLIOptions['outputFormat'],
      prompt: raw['prompt'] as string | undefined,
      skillsDirs: raw['skillsDir'] as string[],
      agent: raw['agent'] as string | undefined,
      agentFiles: raw['agentFile'] as string[],
      addDirs: raw['addDir'] as string[],
    };

    onMain(opts);
  });

  return program;
}
