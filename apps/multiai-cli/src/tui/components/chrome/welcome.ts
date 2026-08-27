/** Welcome wordmark and session details shown at the top of the TUI. */

import type { Component } from '@multiai/pi-tui';
import { truncateToWidth, visibleWidth } from '@multiai/pi-tui';
import chalk from 'chalk';

import { effectiveModelAlias } from '@multiai/sdk';

import { isRainbowDancing, renderDanceWelcomeLogo } from '#/tui/easter-eggs/dance';
import type { AppState } from '#/tui/types';
import { currentTheme } from '#/tui/theme';

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

export class WelcomeComponent implements Component {
  private state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Math.max(0, width);
    const isLoggedOut = !this.state.model;
    const activeModel = this.state.availableModels[this.state.model];
    const effectiveActiveModel = activeModel === undefined ? undefined : effectiveModelAlias(activeModel);
    const labelStyle = chalk.bold.hex(currentTheme.palette.textDim);
    const modelValue = isLoggedOut
      ? chalk.hex(currentTheme.palette.warning)('not set, run /login or /provider')
      : (effectiveActiveModel?.displayName ?? effectiveActiveModel?.model ?? this.state.model);
    const infoLines = [
      labelStyle('Directory: ') + this.state.workDir,
      labelStyle('Session:   ') + this.state.sessionId,
      labelStyle('Model:     ') + modelValue,
      labelStyle('Version:   ') + this.state.version,
    ];

    const showFullWordmark = safeWidth >= WORDMARK_WIDTH + CONTENT_INDENT.length;
    let logoLines: string[];
    if (!showFullWordmark) {
      logoLines = [chalk.bold.hex(currentTheme.palette.primary)('MULTIAI')];
    } else if (isRainbowDancing()) {
      logoLines = renderDanceWelcomeLogo(MULTIAI_WORDMARK);
    } else {
      const splitAt = Math.ceil(MULTIAI_WORDMARK.length / 2);
      logoLines = MULTIAI_WORDMARK.map((line, index) =>
        chalk.bold.hex(
          index < splitAt ? currentTheme.palette.primary : currentTheme.palette.accent,
        )(line),
      );
    }

    const lines = [
      '',
      ...logoLines.map((line) => CONTENT_INDENT + line),
      '',
      ...infoLines.map((line) => CONTENT_INDENT + line),
      '',
    ];

    return lines.map((line) => truncateToWidth(line, safeWidth, '…'));
  }
}
