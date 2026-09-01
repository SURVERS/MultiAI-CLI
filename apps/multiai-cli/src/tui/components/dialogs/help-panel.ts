/**
 * HelpPanel — modal `/help` display. Lists keyboard shortcuts, slash
 * commands (with aliases + descriptions) in colour-coded sections.
 *
 * Mirrors the container-replacement pattern used by SessionPicker /
 * ApprovalPanel: host mounts the panel into `editorContainer`, picks
 * it as the focused component, and tears it down on the `onClose`
 * callback (fired on Esc / Enter / q).
 */

import {
  Container,
  matchesKey,
  Key,
  decodeKittyPrintable,
  type Focusable,
  truncateToWidth,
} from '@multiai/pi-tui';
import { t } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';

export interface KeyboardShortcut {
  readonly keys: string;
  readonly description: string;
}

export interface HelpPanelCommand {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
}

/** Static list — keep in sync with the global editor bindings. */
export const DEFAULT_KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  { keys: 'Shift-Tab', description: t('Toggle plan mode', 'Переключить режим планирования') },
  { keys: 'Ctrl-G', description: t('Edit in external editor ($VISUAL / $EDITOR)', 'Редактировать во внешнем редакторе ($VISUAL / $EDITOR)') },
  { keys: 'Ctrl-O', description: t('Toggle tool output / compaction summary expansion', 'Развернуть или свернуть вывод инструмента / сводку сжатия') },
  { keys: 'Ctrl-T', description: t('Expand / collapse the todo list (when truncated)', 'Развернуть или свернуть список задач (если он сокращён)') },
  { keys: 'Ctrl-S', description: t('Steer — inject a follow-up during streaming', 'Уточнить — добавить сообщение во время потокового ответа') },
  { keys: 'Shift-Enter / Ctrl-J', description: t('Insert newline', 'Вставить новую строку') },
  { keys: 'Ctrl-C', description: t('Interrupt stream / clear input', 'Прервать поток / очистить ввод') },
  { keys: 'Ctrl-D', description: t('Exit (on empty input)', 'Выйти (если поле ввода пусто)') },
  { keys: 'Esc', description: t('Close dialogs / interrupt streaming', 'Закрыть диалог / прервать поток') },
  { keys: '↑ / ↓', description: t('Browse input history', 'Просматривать историю ввода') },
  { keys: 'Enter', description: t('Submit', 'Отправить') },
];

export interface HelpPanelOptions {
  readonly commands: readonly HelpPanelCommand[];
  readonly shortcuts?: readonly KeyboardShortcut[];
  readonly onClose: () => void;
  /** Terminal height — used to decide whether to show the hint tail. */
  readonly maxVisible?: number;
}

export class HelpPanelComponent extends Container implements Focusable {
  focused = false;
  private readonly opts: HelpPanelOptions;
  private scrollTop = 0;

  constructor(opts: HelpPanelOptions) {
    super();
    this.opts = opts;
  }

  handleInput(data: string): void {
    const printable = decodeKittyPrintable(data) ?? data;
    if (
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.enter) ||
      printable === 'q' ||
      printable === 'Q'
    ) {
      this.opts.onClose();
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.scrollTop = Math.max(0, this.scrollTop - 1);
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.scrollTop += 1; // render clamps
      return;
    }
    if (matchesKey(data, Key.pageUp)) {
      this.scrollTop = Math.max(0, this.scrollTop - 10);
      return;
    }
    if (matchesKey(data, Key.pageDown)) {
      this.scrollTop += 10;
    }
  }

  override render(width: number): string[] {
    const accent = (text: string) => currentTheme.fg('primary', text);
    const dim = (text: string) => currentTheme.fg('textDim', text);
    const muted = (text: string) => currentTheme.fg('textMuted', text);
    const kbdColor = (text: string) => currentTheme.fg('warning', text);
    const slashColor = (text: string) => currentTheme.fg('primary', text);

    const shortcuts = this.opts.shortcuts ?? DEFAULT_KEYBOARD_SHORTCUTS;
    const kbdWidth = Math.max(8, ...shortcuts.map((s) => s.keys.length));
    const sortedCmds = [...this.opts.commands].toSorted(compareSlashCommandsForDisplay);
    const cmdLabels = sortedCmds.map((c) => {
      const aliases = c.aliases.length > 0 ? ` (${c.aliases.map((a) => '/' + a).join(', ')})` : '';
      return `/${c.name}${aliases}`;
    });
    const cmdWidth = Math.max(12, ...cmdLabels.map((l) => l.length));
    const lines: string[] = [
      accent('─'.repeat(width)),
      currentTheme.boldFg('primary', t(' help ', ' справка ')) + muted(t('· Esc / Enter / q to cancel · ↑↓ scroll', '· Esc / Enter / q — закрыть · ↑↓ — прокрутка')),
      '',
      // Greeting
      `  ${dim(t('Sure, MultiAI is ready to help! Just send a message to get started.', 'MultiAI готов помочь! Просто отправьте сообщение, чтобы начать.'))}`,
      '',
      // Section: keyboard shortcuts
      `  ${currentTheme.bold(t('Keyboard shortcuts', 'Сочетания клавиш'))}`,
      ...shortcuts.map((s) => `    ${kbdColor(s.keys.padEnd(kbdWidth))}  ${dim(s.description)}`),
      '',
      // Section: slash commands
      `  ${currentTheme.bold(t('Slash commands', 'Слеш-команды'))}`,
      ...sortedCmds.map((cmd, i) => {
        const label = cmdLabels[i] ?? `/${cmd.name}`;
        return `    ${slashColor(label.padEnd(cmdWidth))}  ${dim(cmd.description)}`;
      }),
      '',
      accent('─'.repeat(width)),
    ];

    // Apply scroll windowing — keep the borders visible.
    const content = lines.slice(1, lines.length - 1);
    const maxVisible = Math.max(5, this.opts.maxVisible ?? 24);
    if (content.length > maxVisible) {
      this.scrollTop = Math.max(0, Math.min(this.scrollTop, content.length - maxVisible));
      const slice = content.slice(this.scrollTop, this.scrollTop + maxVisible);
      const scrollInfo = muted(
        t(
          ` showing ${String(this.scrollTop + 1)}-${String(this.scrollTop + slice.length)} of ${String(content.length)}`,
          ` показаны ${String(this.scrollTop + 1)}–${String(this.scrollTop + slice.length)} из ${String(content.length)}`,
        ),
      );
      return [lines[0] ?? '', ...slice, scrollInfo, lines.at(-1) ?? ''].map((line) =>
        truncateToWidth(line, width),
      );
    }
    this.scrollTop = 0;
    return lines.map((line) => truncateToWidth(line, width));
  }
}

function compareSlashCommandsForDisplay(a: HelpPanelCommand, b: HelpPanelCommand): number {
  return (
    getSlashCommandDisplayGroup(a.name) - getSlashCommandDisplayGroup(b.name) ||
    a.name.localeCompare(b.name)
  );
}

function getSlashCommandDisplayGroup(name: string): number {
  return name.startsWith('skill:') ? 1 : 0;
}
