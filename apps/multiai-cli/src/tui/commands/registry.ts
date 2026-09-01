import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'pathe';

import type { AutocompleteItem } from '@multiai/pi-tui';

import { t } from '../i18n';
import { completeLeadingArg, type ArgCompletionSpec } from './complete-args';
import type { MultiAISlashCommand, SlashCommandAvailability } from './types';

/** Subcommands offered when autocompleting `/goal <…>`. */
const GOAL_ARG_COMPLETIONS: readonly ArgCompletionSpec[] = [
  { value: 'status', description: t('Show the current goal', 'Показать текущую цель') },
  { value: 'pause', description: t('Pause the active goal', 'Приостановить активную цель') },
  { value: 'resume', description: t('Resume a paused goal', 'Продолжить приостановленную цель') },
  { value: 'cancel', description: t('Cancel and remove the current goal', 'Отменить и удалить текущую цель') },
  { value: 'replace', description: t('Replace the current goal with a new objective', 'Заменить текущую цель новой') },
  { value: 'next', description: t('Queue an upcoming goal', 'Добавить следующую цель в очередь') },
];

const GOAL_NEXT_ARG_COMPLETIONS: readonly ArgCompletionSpec[] = [
  { value: 'manage', description: t('Manage upcoming goals', 'Управлять следующими целями') },
];

const SWARM_ARG_COMPLETIONS: readonly ArgCompletionSpec[] = [
  { value: 'on', description: t('Turn swarm mode on', 'Включить режим роя') },
  { value: 'off', description: t('Turn swarm mode off', 'Выключить режим роя') },
];

const ADD_DIR_ARG_COMPLETIONS: readonly ArgCompletionSpec[] = [
  { value: 'list', description: t('Show configured additional workspace directories', 'Показать настроенные дополнительные рабочие каталоги') },
];

/** Argument autocompletion for the `/goal` command (subcommands). */
export function goalArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  const nextMatch = argumentPrefix.match(/^next\s+(\S*)$/i);
  if (nextMatch !== null) {
    return (
      completeLeadingArg(GOAL_NEXT_ARG_COMPLETIONS, nextMatch[1] ?? '')?.map((item) => ({
        ...item,
        value: `next ${item.value}`,
      })) ?? null
    );
  }
  return completeLeadingArg(GOAL_ARG_COMPLETIONS, argumentPrefix);
}

/** Argument autocompletion for the `/swarm` command (subcommands). */
export function swarmArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  return completeLeadingArg(SWARM_ARG_COMPLETIONS, argumentPrefix);
}

/** Argument autocompletion for the `/add-dir` command. */
export function addDirArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  if (isPathLikeAddDirArgument(argumentPrefix)) {
    return completeAddDirPath(argumentPrefix);
  }
  return completeLeadingArg(ADD_DIR_ARG_COMPLETIONS, argumentPrefix);
}

function isPathLikeAddDirArgument(argumentPrefix: string): boolean {
  return argumentPrefix === '.' || argumentPrefix === '..' || argumentPrefix.startsWith('./') || argumentPrefix.startsWith('../') || argumentPrefix.startsWith('/') || argumentPrefix.startsWith('~');
}

function completeAddDirPath(argumentPrefix: string): AutocompleteItem[] | null {
  const normalizedPrefix = argumentPrefix === '~' ? '~/' : argumentPrefix;
  const expandedPrefix = expandHomePrefix(normalizedPrefix);
  const parentInput = getDirectoryCompletionParentInput(normalizedPrefix, expandedPrefix);
  const partialName = normalizedPrefix.endsWith('/') ? '' : basename(expandedPrefix);
  const parentDir = resolveDirectoryCompletionParent(parentInput);
  let entries;
  try {
    entries = readdirSync(parentDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const items: AutocompleteItem[] = [];
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..' || entry.name.startsWith('.')) continue;
    if (partialName.length > 0 && !entry.name.toLowerCase().startsWith(partialName.toLowerCase())) continue;
    const absolutePath = join(parentDir, entry.name);
    if (!isDirectoryPath(absolutePath, entry.isDirectory(), entry.isSymbolicLink())) continue;
    const value = formatDirectoryCompletionValue(normalizedPrefix, parentInput, entry.name);
    items.push({
      value,
      label: t(`${entry.name}/`, `${entry.name}/`),
      description: t(absolutePath, absolutePath),
    });
  }

  return items.length > 0 ? items : null;
}

function expandHomePrefix(argumentPrefix: string): string {
  if (argumentPrefix === '~') return homedir();
  if (argumentPrefix.startsWith('~/')) return join(homedir(), argumentPrefix.slice(2));
  return argumentPrefix;
}

function getDirectoryCompletionParentInput(argumentPrefix: string, expandedPrefix: string): string {
  if (argumentPrefix === '/') return '/';
  if (argumentPrefix === '~/') return homedir();
  if (argumentPrefix.endsWith('/')) return expandedPrefix.slice(0, -1);
  return dirname(expandedPrefix);
}

function resolveDirectoryCompletionParent(parentInput: string): string {
  if (parentInput === '~') return homedir();
  if (parentInput.startsWith('~/')) return join(homedir(), parentInput.slice(2));
  return resolve(parentInput);
}

function isDirectoryPath(path: string, isDirectory: boolean, isSymlink: boolean): boolean {
  if (isDirectory) return true;
  if (!isSymlink) return false;
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function formatDirectoryCompletionValue(argumentPrefix: string, parentInput: string, entryName: string): string {
  if (argumentPrefix.startsWith('~/')) {
    const home = homedir();
    const homeRelative = relative(home, parentInput);
    return `~${homeRelative.length > 0 ? `/${homeRelative}` : ''}/${entryName}/`;
  }
  if (argumentPrefix.startsWith('/')) {
    return `${join(parentInput, entryName)}/`;
  }
  return `${join(parentInput, entryName)}/`;
}

export const BUILTIN_SLASH_COMMANDS = [
  {
    name: 'yolo',
    aliases: ['yes'],
    description: t(
      'Toggle YOLO mode: auto-approve tool actions, but the agent may still ask questions.',
      'Переключить режим YOLO: действия инструментов подтверждаются автоматически, но агент всё ещё может задавать вопросы.',
    ),
    priority: 101,
    availability: 'always',
  },
  {
    name: 'auto',
    aliases: [],
    description: t('Toggle Auto mode: fully autonomous, agent decides everything without asking.', 'Переключить режим Auto: полная автономность, агент принимает все решения без вопросов.'),
    priority: 99,
    availability: 'always',
  },
  {
    name: 'permission',
    aliases: [],
    description: t('Select permission mode', 'Выбрать режим разрешений'),
    priority: 100,
    availability: 'always',
  },
  {
    name: 'settings',
    aliases: ['config'],
    description: t('Open TUI settings', 'Открыть настройки терминального интерфейса'),
    priority: 100,
    availability: 'always',
  },
  {
    name: 'plan',
    aliases: [],
    description: t('Toggle plan mode', 'Переключить режим планирования'),
    priority: 100,
    availability: (args) => (args.trim().toLowerCase() === 'clear' ? 'idle-only' : 'always'),
  },
  {
    name: 'swarm',
    aliases: [],
    description: t('Toggle swarm mode or run one task in swarm mode', 'Переключить режим роя или выполнить одну задачу в режиме роя'),
    priority: 100,
    argumentHint: '[on|off] | <task>',
    completeArgs: swarmArgumentCompletions,
    availability: 'idle-only',
  },
  {
    name: 'model',
    aliases: [],
    description: t('Switch LLM model', 'Сменить модель LLM'),
    priority: 100,
    availability: 'always',
  },
  {
    name: 'effort',
    aliases: ['thinking'],
    description: t('Switch thinking effort', 'Изменить интенсивность рассуждений'),
    priority: 95,
    availability: 'always',
  },
  {
    name: 'provider',
    aliases: ['providers'],
    description: t('Manage AI providers (add / delete / refresh)', 'Управлять AI-провайдерами (добавить / удалить / обновить)'),
    priority: 95,
    availability: 'always',
  },
  {
    name: 'btw',
    aliases: [],
    description: t('Ask a forked side agent a question', 'Задать вопрос ответвлённому вспомогательному агенту'),
    priority: 90,
    availability: 'always',
  },
  {
    name: 'help',
    aliases: ['h', '?'],
    description: t('Show available commands and shortcuts', 'Показать доступные команды и сочетания клавиш'),
    priority: 80,
    availability: 'always',
  },
  {
    name: 'new',
    aliases: ['clear'],
    description: t('Start a fresh session in the current workspace', 'Начать новую сессию в текущем рабочем пространстве'),
    priority: 80,
  },
  {
    name: 'sessions',
    aliases: ['resume'],
    description: t('Browse and resume sessions', 'Просматривать и возобновлять сессии'),
    priority: 80,
  },
  {
    name: 'tasks',
    aliases: ['task'],
    description: t('Browse background tasks', 'Просматривать фоновые задачи'),
    priority: 80,
    availability: 'always',
  },
  {
    name: 'mcp',
    aliases: [],
    description: t('Show MCP server status', 'Показать состояние MCP-серверов'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'plugins',
    aliases: [],
    description: t('Manage plugins', 'Управлять плагинами'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'add-dir',
    aliases: [],
    description: t('Add or list an additional workspace directory', 'Добавить или показать дополнительный каталог рабочего пространства'),
    priority: 60,
    availability: 'idle-only',
    argumentHint: '[list] | <path>',
    completeArgs: addDirArgumentCompletions,
  },
  {
    name: 'experiments',
    aliases: ['experimental'],
    description: t('Manage experimental features', 'Управлять экспериментальными функциями'),
    priority: 60,
    availability: 'idle-only',
  },
  {
    name: 'reload',
    aliases: [],
    description: t('Reload session and apply config.toml settings plus tui.toml UI preferences', 'Перезагрузить сессию и применить настройки config.toml и параметры интерфейса из tui.toml'),
    priority: 60,
    availability: 'idle-only',
  },
  {
    name: 'reload-tui',
    aliases: [],
    description: t('Reload only tui.toml UI preferences', 'Перезагрузить только параметры интерфейса из tui.toml'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'compact',
    aliases: [],
    description: t('Compact the conversation context', 'Сжать контекст диалога'),
    priority: 80,
    argumentHint: '<instruction>',
  },
  {
    name: 'goal',
    aliases: [],
    description: t('Start or manage an autonomous goal', 'Запустить автономную цель или управлять ею'),
    priority: 80,
    argumentHint: '[status|pause|resume|cancel|replace|next] | <objective>',
    completeArgs: goalArgumentCompletions,
    // status / pause / cancel are always available; creation, replacement, and
    // resume start (or restart) a turn and so are idle-only.
    availability: (args) => {
      const trimmed = args.trim();
      if (trimmed === 'next' || trimmed.startsWith('next ')) return 'always';
      return trimmed === '' || trimmed === 'status' || trimmed === 'pause' || trimmed === 'cancel'
        ? 'always'
        : 'idle-only';
    },
  },
  {
    name: 'init',
    aliases: [],
    description: t('Analyze the codebase and generate AGENTS.md', 'Проанализировать кодовую базу и создать AGENTS.md'),
  },
  {
    name: 'fork',
    aliases: [],
    description: t('Fork the current session', 'Создать ответвление текущей сессии'),
    priority: 80,
  },
  {
    name: 'title',
    aliases: ['rename'],
    description: t('Set or show session title', 'Задать или показать название сессии'),
    priority: 60,
    argumentHint: '<title>',
    availability: 'always',
  },
  {
    name: 'usage',
    aliases: [],
    description: t('Show session tokens and context window', 'Показать токены сессии и контекстное окно'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'status',
    aliases: [],
    description: t('Show current session and runtime status', 'Показать состояние текущей сессии и среды выполнения'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'account',
    aliases: ['profile'],
    description: t('Show MultiAI profile, wallet, usage, subscription, quotas, scopes, and masked keys', 'Показать профиль MultiAI, кошелёк, использование, подписку, квоты, области доступа и скрытые ключи'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'undo',
    aliases: [],
    description: t('Withdraw the last prompt from the transcript', 'Убрать последний запрос из истории диалога'),
    priority: 80,
    availability: 'idle-only',
  },
  {
    name: 'editor',
    aliases: [],
    description: t('Set the external editor for Ctrl-G', 'Выбрать внешний редактор для Ctrl-G'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'language',
    aliases: ['lang'],
    description: t('Change the terminal interface language', 'Изменить язык терминального интерфейса'),
    priority: 100,
    argumentHint: '[en|ru]',
    availability: 'always',
  },
  {
    name: 'theme',
    aliases: [],
    description: t('Set the terminal UI theme', 'Выбрать тему терминального интерфейса'),
    priority: 60,
    availability: 'always',
  },
  {
    name: 'logout',
    aliases: ['disconnect'],
    description: t('Log out of a configured provider', 'Выйти из учётной записи настроенного провайдера'),
    priority: 40,
  },
  {
    name: 'login',
    aliases: [],
    description: t('Select a platform and authenticate', 'Выбрать платформу и войти в систему'),
    priority: 40,
  },
  {
    name: 'export-md',
    aliases: ['export'],
    description: t('Export current session as a Markdown file', 'Экспортировать текущую сессию в файл Markdown'),
    priority: 40,
  },
  {
    name: 'export-debug-zip',
    aliases: [],
    description: t('Export current session as a debug ZIP archive', 'Экспортировать текущую сессию в отладочный ZIP-архив'),
    priority: 40,
  },
  {
    name: 'copy',
    aliases: [],
    description: t('Copy the last assistant message to the clipboard', 'Скопировать последнее сообщение ассистента в буфер обмена'),
    priority: 40,
  },
  {
    name: 'web',
    aliases: [],
    description: t('Open the current session in the Web UI by starting a new server', 'Открыть текущую сессию в веб-интерфейсе, запустив новый сервер'),
    priority: 40,
    availability: 'always',
  },
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: t('Exit the application', 'Выйти из приложения'),
    priority: 20,
  },
  {
    name: 'version',
    aliases: [],
    description: t('Show version information', 'Показать информацию о версии'),
    priority: 20,
    availability: 'always',
  },
] as const satisfies readonly MultiAISlashCommand[];

export type BuiltinSlashCommand = (typeof BUILTIN_SLASH_COMMANDS)[number];
export type BuiltinSlashCommandName = BuiltinSlashCommand['name'];

export function findBuiltInSlashCommand(commandName: string): BuiltinSlashCommand | undefined {
  const commands = BUILTIN_SLASH_COMMANDS as readonly MultiAISlashCommand<BuiltinSlashCommandName>[];
  return commands.find(
    (command) => command.name === commandName || command.aliases.includes(commandName),
  ) as BuiltinSlashCommand | undefined;
}

export function resolveSlashCommandAvailability(
  command: MultiAISlashCommand,
  args: string,
): SlashCommandAvailability {
  const availability = command.availability ?? 'idle-only';
  return typeof availability === 'function' ? availability(args) : availability;
}

export function sortSlashCommands(commands: readonly MultiAISlashCommand[]): MultiAISlashCommand[] {
  return [...commands].toSorted(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name),
  );
}
