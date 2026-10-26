import chalk from 'chalk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FooterComponent, formatWorkingDuration } from '#/tui/components/chrome/footer';
import { setRainbowDance, type RainbowDanceController } from '#/tui/easter-eggs/dance';
import { currentTheme, darkColors, lightColors } from '#/tui/theme';
import type { ModelAlias } from '@multiai/sdk';
import type { AppState } from '#/tui/types';

const TRUECOLOR_PATTERN = /\[38;2;(\d+);(\d+);(\d+)m/g;

function truecolorCodes(text: string): Set<string> {
  const codes = new Set<string>();
  for (const match of text.matchAll(TRUECOLOR_PATTERN)) {
    codes.add(`${match[1]},${match[2]},${match[3]}`);
  }
  return codes;
}

// Dark dance colors the footer never uses outside of /dance.
const RAINBOW_CYAN = '91,192,190';
const RAINBOW_GREEN = '78,200,126';

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

describe('FooterComponent', () => {
  const previousChalkLevel = chalk.level;

  beforeEach(() => {
    chalk.level = 3;
  });

  afterEach(() => {
    chalk.level = previousChalkLevel;
    setRainbowDance(undefined);
  });

  it('paints the model name in rainbow while colored', () => {
    setDanceView(true, 0);
    const footer = new FooterComponent(appState);

    const codes = truecolorCodes(footer.render(120).join('\n'));

    // "kimi-k2" spreads across the palette, pulling in colors the footer
    // never renders on its own.
    expect(codes.has(RAINBOW_CYAN)).toBe(true);
    expect(codes.has(RAINBOW_GREEN)).toBe(true);
  });

  it('renders the model name in its normal color when not dancing', () => {
    const footer = new FooterComponent(appState);

    const codes = truecolorCodes(footer.render(120).join('\n'));

    expect(codes.has(RAINBOW_CYAN)).toBe(false);
    expect(codes.has(RAINBOW_GREEN)).toBe(false);
  });

  it('repaints from the active palette on the next render (no setColors needed)', () => {
    const footer = new FooterComponent(appState);
    const before = footer.render(120).join('\n');

    currentTheme.setPalette(lightColors);
    try {
      const after = footer.render(120).join('\n');
      // Reads currentTheme live, so a palette swap changes the emitted colours.
      expect(after).not.toBe(before);
    } finally {
      currentTheme.setPalette(darkColors);
    }
  });

  it('shows the effort for an effort-capable model', () => {
    const effortModel: ModelAlias = {
      provider: 'managed:multiai',
      model: 'kimi-k2',
      maxContextSize: 262144,
      supportEfforts: ['low', 'high', 'max'],
      defaultEffort: 'high',
    };
    const state: AppState = {
      ...appState,
      thinkingEffort: 'max',
      availableModels: { 'kimi-k2': effortModel },
    };
    const footer = new FooterComponent(state);

    expect(footer.render(120).join('\n')).toContain('thinking: max');
  });

  it('does not show the effort for a legacy boolean model', () => {
    const plainModel: ModelAlias = {
      provider: 'managed:multiai',
      model: 'kimi-k2',
      maxContextSize: 262144,
      capabilities: ['thinking'],
    };
    const state: AppState = {
      ...appState,
      thinkingEffort: 'high',
      availableModels: { 'kimi-k2': plainModel },
    };
    const footer = new FooterComponent(state);
    const rendered = footer.render(120).join('\n');

    expect(rendered).toContain('thinking');
    expect(rendered).not.toContain('thinking:high');
  });
});

describe('FooterComponent overrides', () => {
  it('shows the overridden effort list', () => {
    const effortModelWithOverride: ModelAlias = {
      provider: 'managed:multiai',
      model: 'kimi-k2',
      maxContextSize: 262144,
      supportEfforts: ['low', 'high', 'max'],
      defaultEffort: 'max',
      overrides: { supportEfforts: ['low', 'high'], defaultEffort: 'high' },
    };
    const state: AppState = {
      ...appState,
      thinkingEffort: 'high',
      availableModels: { 'kimi-k2': effortModelWithOverride },
    };
    const footer = new FooterComponent(state);

    expect(footer.render(120).join('\n')).toContain('thinking: high');
  });
});

describe('FooterComponent displayName override', () => {
  it('renders the overridden display name', () => {
    const state: AppState = {
      ...appState,
      model: 'kimi-k2',
      availableModels: {
        'kimi-k2': {
          provider: 'managed:multiai',
          model: 'kimi-k2',
          maxContextSize: 262144,
          displayName: 'Remote Name',
          overrides: { displayName: 'Custom Name' },
        },
      },
    };
    const footer = new FooterComponent(state);

    expect(footer.render(120).join('\n')).toContain('Custom Name');
    expect(footer.render(120).join('\n')).not.toContain('Remote Name');
  });
});

describe('formatWorkingDuration', () => {
  it('formats sub-minute live durations with 1 decimal place', () => {
    expect(formatWorkingDuration(5400, true)).toMatch(/5\.4[sс]/);
    expect(formatWorkingDuration(59900, true)).toMatch(/59\.9[sс]/);
  });

  it('formats sub-minute completed durations', () => {
    expect(formatWorkingDuration(4200, false)).toMatch(/4\.2[sс]/);
    expect(formatWorkingDuration(45000, false)).toMatch(/45[sс]/);
  });

  it('formats minute and second durations', () => {
    const res = formatWorkingDuration(65000, true);
    expect(res).toMatch(/1[mм] 5[sс]/);
  });

  it('formats hour, minute, and second durations', () => {
    const res1 = formatWorkingDuration(3605000, true);
    expect(res1).toMatch(/1[hч] 0[mм] 5[sс]/);

    const res2 = formatWorkingDuration(7350000, true);
    expect(res2).toMatch(/2[hч] 2[mм] 30[sс]/);
  });

  it('formats day, hour, minute, and second durations', () => {
    const res1 = formatWorkingDuration(86400000 + 5000, true);
    expect(res1).toMatch(/1[dд] 0[hч] 0[mм] 5[sс]/);

    const res2 = formatWorkingDuration(90065000, true);
    expect(res2).toMatch(/1[dд] 1[hч] 1[mм] 5[sс]/);

    const res3 = formatWorkingDuration(2 * 86400000 + 3 * 3600000 + 15 * 60000 + 30000, false);
    expect(res3).toMatch(/2[dд] 3[hч] 15[mм] 30[sс]/);
  });

  it('renders Working status in footer with formatted duration when streaming', () => {
    const now = Date.now();
    const state: AppState = {
      ...appState,
      streamingPhase: 'thinking',
      streamingStartTime: now - 65000, // 1m 5s ago
    };
    const footer = new FooterComponent(state);
    const text = footer.render(120).join('\n');
    expect(text).toMatch(/(Working|Работает).*(1[mм] 5[sс])/);
  });

  it('renders Done status in footer with formatted duration when turn finishes', () => {
    const state: AppState = {
      ...appState,
      streamingPhase: 'idle',
      lastTurnDurationMs: 3665000, // 1h 1m 5s
    };
    const footer = new FooterComponent(state);
    const text = footer.render(120).join('\n');
    expect(text).toMatch(/(Done in|Выполнено за).*(1[hч] 1[mм] 5[sс])/);
  });
});
