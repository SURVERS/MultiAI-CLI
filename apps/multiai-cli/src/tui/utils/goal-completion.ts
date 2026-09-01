import type { GoalSnapshot } from '@multiai/sdk';

import { formatTokenCount } from '#/utils/usage/usage-format';

import { t } from '../i18n';

interface GoalCompletionStats {
  readonly terminalReason?: string | undefined;
  readonly turnsUsed: number;
  readonly tokensUsed: number;
  readonly wallClockMs: number;
}

/**
 * Deterministic goal-completion text rendered by the TUI when the model marks a
 * goal `complete`. It is built from the final snapshot, so the figures
 * (turns / tokens / time) are exact and do not depend on model prose.
 */
export function buildGoalCompletionMessage(goal: GoalSnapshot): string {
  return buildGoalCompletionMessageFromStats(goal);
}

export function buildGoalCompletionMessageFromStats(goal: GoalCompletionStats): string {
  const head = t(
    `✓ Goal complete${goal.terminalReason ? ` — ${goal.terminalReason}` : ''}.`,
    `✓ Цель выполнена${goal.terminalReason ? ` — ${goal.terminalReason}` : ''}.`,
  );
  const turns = t(
    `${goal.turnsUsed} turn${goal.turnsUsed === 1 ? '' : 's'}`,
    `${goal.turnsUsed} ${goal.turnsUsed === 1 ? 'ход' : 'ходов'}`,
  );
  const stats = t(
    `Worked ${turns} over ${formatElapsed(goal.wallClockMs)}, using ${formatTokenCount(goal.tokensUsed)} tokens.`,
    `Выполнено за ${turns} и ${formatElapsed(goal.wallClockMs)}, использовано токенов: ${formatTokenCount(goal.tokensUsed)}.`,
  );
  return `${head}\n${stats}`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${(minutes % 60).toString().padStart(2, '0')}m`;
}
