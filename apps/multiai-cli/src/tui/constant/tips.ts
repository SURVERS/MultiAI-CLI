import { t } from '../i18n';

export interface ToolbarTip {
  readonly en: string;
  readonly ru: string;
  /**
   * Long/important tips render on their own. They never pair with a
   * neighbour and never appear as the second half of someone else's pair.
   */
  readonly solo?: boolean;
  /**
   * Rotation weight: a higher value makes the tip recur more often. Defaults
   * to 1. Used to give newer/important features more airtime.
   */
  readonly priority?: number;
}

/** Resolve a tip's text in the current TUI language at render time. */
export function tipText(tip: ToolbarTip | undefined): string {
  if (tip === undefined) return '';
  return t(tip.en, tip.ru);
}

/**
 * Subset of toolbar tips shown behind the composing spinner.
 */
export const WORKING_TIPS: readonly ToolbarTip[] = [
  { en: 'ctrl-s to add guidance without waiting for the turn to finish', ru: 'ctrl-s: добавить указания, не дожидаясь завершения хода', priority: 2, solo: true },
  { en: '/tasks to check progress and status for background tasks', ru: '/tasks: проверить ход и состояние фоновых задач', priority: 2 },
  { en: '/init: generate AGENTS.md', ru: '/init: создать AGENTS.md', priority: 2 },
  { en: 'Try /dance for a hidden Easter egg', ru: 'Попробуйте /dance — там спрятана пасхалка' },
  { en: '/plugins: manage local plugins and explicitly configured marketplaces', ru: '/plugins: управление локальными плагинами и настроенными маркетплейсами', solo: true },
  { en: 'ask MultiAI to schedule tasks, e.g. "remind me at 5pm"', ru: 'попросите MultiAI запланировать задачу, например: «напомни мне в 17:00»', solo: true, priority: 3 },
  { en: '/sessions to browse and resume earlier sessions', ru: '/sessions: просмотр и возобновление прошлых сессий', solo: true },
  { en: '/goal for multi-step work with a clear finish line', ru: '/goal: многоэтапная работа с чёткой целью', priority: 2, solo: true },
  { en: '/goal next to queue follow-up work while the current goal keeps running', ru: '/goal next: поставить следующую работу в очередь, не прерывая текущую цель', solo: true },
  { en: '/web: use the Web UI for a better experience', ru: '/web: открыть более удобный веб-интерфейс', solo: true },
  { en: '@: mention files', ru: '@: упомянуть файлы', priority: 2 },
  { en: '! to run a shell command', ru: '!: выполнить команду оболочки', priority: 2 },
];

export const ALL_TIPS: readonly ToolbarTip[] = [
  ...WORKING_TIPS,
  { en: 'shift+enter: newline', ru: 'shift+enter: новая строка' },
  { en: 'ctrl+c: cancel', ru: 'ctrl+c: отмена' },
  { en: '/theme to switch the terminal UI theme', ru: '/theme: сменить тему терминального интерфейса' },
  { en: '/auto when you want MultiAI to handle approvals and keep going unattended', ru: '/auto: доверить MultiAI подтверждения и продолжить работу без присмотра' },
  { en: '/yolo to skip most approvals for trusted batch work, only use it in repos you trust', ru: '/yolo: пропустить большинство подтверждений; используйте только в доверенных репозиториях' },
  { en: '/help: show commands', ru: '/help: показать команды' },
  { en: '/compact compresses context when it gets long', ru: '/compact: сжать слишком длинный контекст', priority: 2 },
  { en: 'ctrl-o to hide or reveal tool output switching between a clean chat view and full execution details', ru: 'ctrl-o: скрыть или показать вывод инструментов, переключаясь между чистым чатом и подробностями выполнения', priority: 2 },
  { en: 'shift-tab to Plan mode to review the approach before MultiAI edits files.', ru: 'shift-tab: перейти в режим плана и проверить подход до того, как MultiAI изменит файлы.', priority: 2 },
  { en: '/model: switch model', ru: '/model: сменить модель', priority: 2 },
];
