import { visibleWidth } from '@multiai/pi-tui';
import chalk from 'chalk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WelcomeComponent } from '#/tui/components/chrome/welcome';
import { setRainbowDance, type RainbowDanceController } from '#/tui/easter-eggs/dance';
import { darkColors } from '#/tui/theme/colors';
import type { AppState } from '#/tui/types';

const TRUECOLOR_PATTERN = /\u001B\[38;2;(\d+);(\d+);(\d+)m/g;

const appState: AppState = {
  version: '1.2.3',
  workDir: '/tmp/project',
  additionalDirs: [],
  sessionId: 'ses-1',
  sessionTitle: null,
  model: 'kimi-k2',
  permissionMode: 'manual',
  thinkingEffort: 'off',
  contextUsage: 0,
  contextTokens: 0,
  maxContextTokens: 0,
  isCompacting: false,
  isReplaying: false,
  streamingPhase: 'idle',
  streamingStartTime: 0,
  planMode: false,
  inputMode: 'prompt',
  swarmMode: false,
  theme: 'dark',
  editorCommand: null,
  notifications: { enabled: true, condition: 'unfocused' },
  upgrade: { autoInstall: true },
  availableModels: {},
  availableProviders: {},
  mcpServersSummary: null,
};

function truecolorCodes(text: string): Set<string> {
  const codes = new Set<string>();
  for (const match of text.matchAll(TRUECOLOR_PATTERN)) {
    codes.add(`${match[1]},${match[2]},${match[3]}`);
  }
  return codes;
}

function stripAnsi(text: string): string {
  return text.replaceAll(/\u001B\[[0-9;]*m/g, '');
}

/** The six rows of the full-size MULTIAI wordmark. */
function logoOf(lines: string[]): string {
  return lines.slice(1, 7).join('\n');
}

function setDanceView(colored: boolean, phase: number): void {
  const dance: RainbowDanceController = {
    colored,
    phase,
    start: () => {},
    stop: () => {},
    dispose: () => {},
  };
  setRainbowDance(dance);
}

describe('WelcomeComponent', () => {
  const previousChalkLevel = chalk.level;

  beforeEach(() => {
    chalk.level = 3;
  });

  afterEach(() => {
    chalk.level = previousChalkLevel;
    setRainbowDance(undefined);
  });

  it('renders the banner in a single brand color by default', () => {
    const codes = truecolorCodes(logoOf(new WelcomeComponent(appState).render(80)));

    // No rainbow by default — just the primary-to-accent brand treatment.
    expect(codes.size).toBeLessThanOrEqual(2);
  });

  it('paints the banner in rainbow while colored', () => {
    setDanceView(true, 0);
    const codes = truecolorCodes(logoOf(new WelcomeComponent(appState).render(80)));

    expect(codes.size).toBeGreaterThanOrEqual(5);
  });

  it('renders exactly the default banner when not colored', () => {
    const base = logoOf(new WelcomeComponent(appState).render(80));
    setDanceView(false, 5);
    const off = logoOf(new WelcomeComponent(appState).render(80));

    expect(off).toBe(base);
  });

  it('renders a large wordmark without the old welcome box', () => {
    const lines = new WelcomeComponent(appState).render(80).map(stripAnsi);

    expect(lines.slice(1, 7)).toEqual([
      '  ███╗   ███╗██╗   ██╗██╗  ████████╗██╗ █████╗ ██╗',
      '  ████╗ ████║██║   ██║██║  ╚══██╔══╝██║██╔══██╗██║',
      '  ██╔████╔██║██║   ██║██║     ██║   ██║███████║██║',
      '  ██║╚██╔╝██║██║   ██║██║     ██║   ██║██╔══██║██║',
      '  ██║ ╚═╝ ██║╚██████╔╝███████╗██║   ██║██║  ██║██║',
      '  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝  ╚═╝╚═╝',
    ]);
    expect(lines.slice(8, 12)).toEqual([
      '  Directory: /tmp/project',
      '  Session:   ses-1',
      '  Model:     kimi-k2',
      '  Version:   1.2.3',
    ]);
    expect(lines.join('\n')).not.toMatch(/Welcome to|[╭╰│]/);
  });

  it('uses a compact MULTIAI title when the full wordmark does not fit', () => {
    const lines = new WelcomeComponent(appState).render(40).map(stripAnsi);

    expect(lines[1]).toBe('  MULTIAI');
    expect(lines).toContain('  Directory: /tmp/project');
    expect(lines).toContain('  Model:     kimi-k2');
  });

  it('keeps every line within the requested width on narrow terminals', () => {
    for (const width of [0, 1, 2, 4, 10, 39, 80]) {
      for (const line of new WelcomeComponent(appState).render(width)) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });
});
