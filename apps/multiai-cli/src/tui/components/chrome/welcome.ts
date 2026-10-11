/** Welcome wordmark and session details shown at the top of the TUI. */

import type { Component } from '@multiai/pi-tui';
import { truncateToWidth, visibleWidth } from '@multiai/pi-tui';
import chalk from 'chalk';

import { effectiveModelAlias } from '@multiai/sdk';

import { isRainbowDancing, renderDanceWelcomeLogo } from '#/tui/easter-eggs/dance';
import type { AppState } from '#/tui/types';
import { currentTheme } from '#/tui/theme';
import { t } from '../../i18n';

const MULTIAI_WORDMARK = [
  '███╗   ███╗██╗   ██╗██╗  ████████╗██╗ █████╗ ██╗',
  '████╗ ████║██║   ██║██║  ╚══██╔══╝██║██╔══██╗██║',
  '██╔████╔██║██║   ██║██║     ██║   ██║███████║██║',
  '██║╚██╔╝██║██║   ██║██║     ██║   ██║██╔══██║██║',
  '██║ ╚═╝ ██║╚██████╔╝███████╗██║   ██║██║  ██║██║',
  '╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝  ╚═╝╚═╝',
] as const;
const WORDMARK_WIDTH = Math.max(...MULTIAI_WORDMARK.map((line) => visibleWidth(line)));
const CONTENT_INDENT = '  ';

function formatCardRow(
  label: string,
  value: string,
  boxWidth: number,
  palette: typeof currentTheme.palette,
): string {
  const icon = chalk.hex(palette.primary)('◈ ');
  const styledLabel = chalk.bold.hex(palette.textDim)(label.padEnd(9));
  const innerPrefix = ` ${icon}${styledLabel} `;
  const prefixWidth = visibleWidth(innerPrefix);
  const maxValWidth = Math.max(0, boxWidth - prefixWidth - 3);
  const truncatedVal = truncateToWidth(value, maxValWidth, '…');
  const padRight = Math.max(0, boxWidth - prefixWidth - visibleWidth(truncatedVal) - 2);
  const borderChar = chalk.hex(palette.border)('│');
  return `${borderChar}${innerPrefix}${truncatedVal}${' '.repeat(padRight)}${borderChar}`;
}

export class WelcomeComponent implements Component {
  private state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(0, width);
    const colors = currentTheme.palette;
    const isLoggedOut = !this.state.model;
    const activeModel = this.state.availableModels[this.state.model];
    const effectiveActiveModel = activeModel === undefined ? undefined : effectiveModelAlias(activeModel);
    const modelValue = isLoggedOut
      ? chalk.hex(colors.warning)(
          t('not set, run /login or /provider', 'не задана, запустите /login или /provider'),
        )
      : chalk.hex(colors.primary).bold(effectiveActiveModel?.displayName ?? effectiveActiveModel?.model ?? this.state.model);

    const showFullWordmark = safeWidth >= WORDMARK_WIDTH + CONTENT_INDENT.length;
    let logoLines: string[];
    if (!showFullWordmark) {
      logoLines = [
        chalk.bold.hex(colors.primary)('◈ MULTIAI CLI') +
          chalk.hex(colors.textMuted)(' · ') +
          chalk.hex(colors.accent)(t('Agentic IDE', 'AI-ассистент')),
      ];
    } else if (isRainbowDancing()) {
      logoLines = renderDanceWelcomeLogo(MULTIAI_WORDMARK);
    } else {
      const splitAt = Math.ceil(MULTIAI_WORDMARK.length / 2);
      logoLines = MULTIAI_WORDMARK.map((line, index) =>
        chalk.bold.hex(
          index < splitAt ? colors.primary : colors.accent,
        )(line),
      );
    }

    const subtitle = CONTENT_INDENT +
      chalk.hex(colors.primary)('⚡ ') +
      chalk.bold.hex(colors.textStrong)('MULTIAI IDE') +
      chalk.hex(colors.textMuted)(' ◈ ') +
      chalk.hex(colors.accent)(t('NEXT-GEN AGENTIC RUNTIME', 'АВТОНОМНАЯ СРЕДА РАЗРАБОТКИ'));

    const cardWidth = Math.min(Math.max(safeWidth - 4, 30), Math.max(WORDMARK_WIDTH, 66));
    const canRenderBox = safeWidth >= 44 && cardWidth >= 36;

    let bodyLines: string[];
    if (canRenderBox) {
      const badgeText = t(' СЕССИЯ ', ' SESSION ');
      const rightBorderLen = Math.max(0, cardWidth - 4 - visibleWidth(badgeText));
      const topBorder =
        CONTENT_INDENT +
        chalk.hex(colors.border)('╭─') +
        chalk.bold.hex(colors.accent)(badgeText) +
        chalk.hex(colors.border)('─'.repeat(rightBorderLen) + '╮');

      const statusText =
        chalk.hex(colors.success)('● ') +
        chalk.hex(colors.text)(t('Готов к работе', 'Ready')) +
        chalk.hex(colors.textDim)(` · v${this.state.version}`);

      const rows = [
        formatCardRow(t('Каталог', 'Directory'), this.state.workDir, cardWidth, colors),
        formatCardRow(t('Модель', 'Model'), modelValue, cardWidth, colors),
        formatCardRow(t('Сессия', 'Session'), chalk.hex(colors.textDim)(this.state.sessionId), cardWidth, colors),
        formatCardRow(t('Статус', 'Status'), statusText, cardWidth, colors),
      ];

      const bottomBorder =
        CONTENT_INDENT +
        chalk.hex(colors.border)('╰' + '─'.repeat(Math.max(0, cardWidth - 2)) + '╯');

      bodyLines = [topBorder, ...rows.map((r) => CONTENT_INDENT + r), bottomBorder];
    } else {
      const labelStyle = chalk.bold.hex(colors.textDim);
      bodyLines = [
        CONTENT_INDENT + chalk.hex(colors.primary)('◈ ') + labelStyle(t('Каталог: ', 'Directory: ')) + this.state.workDir,
        CONTENT_INDENT + chalk.hex(colors.primary)('◈ ') + labelStyle(t('Модель:   ', 'Model:     ')) + modelValue,
        CONTENT_INDENT + chalk.hex(colors.primary)('◈ ') + labelStyle(t('Сессия:   ', 'Session:   ')) + this.state.sessionId,
        CONTENT_INDENT + chalk.hex(colors.primary)('◈ ') + labelStyle(t('Версия:   ', 'Version:   ')) + this.state.version,
      ];
    }

    const hotkeysLine = CONTENT_INDENT + [
      chalk.bold.hex(colors.primary)('/help') + chalk.hex(colors.textMuted)(t(' команды', ' commands')),
      chalk.bold.hex(colors.primary)('Tab') + chalk.hex(colors.textMuted)(t(' автодополнение', ' complete')),
      chalk.bold.hex(colors.primary)('!') + chalk.hex(colors.textMuted)(t(' bash', ' bash')),
      chalk.bold.hex(colors.primary)('?') + chalk.hex(colors.textMuted)(t(' справка', ' help')),
    ].join(chalk.hex(colors.border)('  │  '));

    const lines = [
      '',
      ...logoLines.map((line) => CONTENT_INDENT + line),
      subtitle,
      '',
      ...bodyLines,
      '',
      hotkeysLine,
      '',
    ];

    return lines.map((line) => truncateToWidth(line, safeWidth, '…'));
  }
}
