/**
 * Color palette definitions for dark and light themes.
 *
 * `darkColors` / `lightColors` are the semantic `ColorPalette` consumed by
 * every UI component via the global Theme singleton. Each token holds its hex
 * value directly — see the per-token docs on `ColorPalette` for what each one
 * controls.
 *
 * Light palette values are tuned for ≥ 4.5:1 contrast against #FFFFFF
 * for text tokens and ≥ 3:1 for chrome (border / large text), matching
 * WCAG AA.
 */

// Each token below documents where it is actually consumed, so theme authors
// know what changing it affects. "Widely" means the token is read across most
// dialogs/messages rather than in one specific place.
export interface ColorPalette {
  // ── Brand ──
  /** Dominant interactive/brand colour: links & inline code, the selected item
   *  in nearly every dialog, the focused editor border, plan/"running" badges,
   *  spinners. The most widely used token. */
  primary: string;
  /** Secondary highlight: approval "▶" prefix, device-code box, image
   *  placeholder, BTW / queue panes, custom-registry import. */
  accent: string;

  // ── Text ──
  /** Default body text: dialog bodies, todo titles, footer model label,
   *  markdown headings, tool/read output, and assistant-side message bullets
   *  (assistant / tool / agent / read) plus markdown list bullets. */
  text: string;
  /** Emphasised / bold text: input dialogs, status messages. */
  textStrong: string;
  /** Secondary, dimmed text (the most widely used dim shade): thinking blocks,
   *  hints, descriptions, completed todos, markdown quotes, and the footer
   *  status bar (cwd path, git badge). */
  textDim: string;
  /** Faintest text: counters, scroll info, descriptions, markdown link URLs,
   *  code-block borders. */
  textMuted: string;

  // ── Surface ──
  /** Borders: pane & editor borders, markdown horizontal rule. */
  border: string;
  /** Focus / attention border — currently only the approval panel. */
  borderFocus: string;

  // ── State ──
  /** Success: ✓ marks, "enabled", completed states. */
  success: string;
  /** Warning: auto/yolo badges, stale markers, plan-mode hint. */
  warning: string;
  /** Error: error messages, failed tool output. */
  error: string;

  // ── Diff (all consumed by components/media/diff-preview.ts) ──
  /** Added lines. */
  diffAdded: string;
  /** Removed lines. */
  diffRemoved: string;
  /** Added lines — intra-line changed words (bold). */
  diffAddedStrong: string;
  /** Removed lines — intra-line changed words (bold). */
  diffRemovedStrong: string;
  /** Line-number gutter (also approval panel/preview). */
  diffGutter: string;
  /** Meta / hunk headers. */
  diffMeta: string;

  // ── Roles ──
  /** User message: bullet & text, skill-activation name. The one role colour
   *  with its own hue — assistant/thinking/status bullets reuse text/textDim. */
  roleUser: string;

  // ── Shell mode ──
  /** Shell mode (`!`): the `!` prompt symbol, bash-mode editor border, and the
   *  echoed `$ command` line. Its own hue (violet), distinct from
   *  plan-mode (primary) and the user role (roleUser). */
  shellMode: string;
}

export const darkColors: ColorPalette = {
  primary: '#22C55E',
  accent: '#4ADE80',

  text: '#F8FAFC',
  textStrong: '#FFFFFF',
  textDim: '#94A3B8',
  textMuted: '#64748B',

  border: '#334155',
  borderFocus: '#22C55E',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  diffAdded: '#22C55E',
  diffRemoved: '#EF4444',
  diffAddedStrong: '#4ADE80',
  diffRemovedStrong: '#F87171',
  diffGutter: '#64748B',
  diffMeta: '#94A3B8',

  roleUser: '#FFFFFF',
  shellMode: '#4ADE80',
};

export const lightColors: ColorPalette = {
  primary: '#16A34A',
  accent: '#15803D',

  text: '#0F172A',
  textStrong: '#020617',
  textDim: '#475569',
  textMuted: '#64748B',

  border: '#94A3B8',
  borderFocus: '#16A34A',

  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',

  diffAdded: '#16A34A',
  diffRemoved: '#DC2626',
  diffAddedStrong: '#22C55E',
  diffRemovedStrong: '#EF4444',
  diffGutter: '#94A3B8',
  diffMeta: '#64748B',

  roleUser: '#0F172A',
  shellMode: '#16A34A',
};

export type ResolvedTheme = 'dark' | 'light';

/** Synchronous palette lookup for built-in themes only. */
export function getBuiltInPalette(resolved: ResolvedTheme): ColorPalette {
  return resolved === 'dark' ? darkColors : lightColors;
}
