/**
 * Format a `BackgroundTaskInfo` snapshot into the transcript card data
 * consumed by `BackgroundAgentStatusComponent`.
 *
 * Background tasks have several statuses (running / completed / failed /
 * timed_out / killed / lost) but the transcript card only renders three
 * visual phases (started / completed / failed). The
 * mapping packs the extra nuance — exit code, kill reason, lost-reason
 * — into the dim detail line so the user still sees it.
 */

import type { BackgroundTaskInfo, BackgroundTaskStatus } from '@multiai/sdk';

import type { BackgroundAgentStatusData, BackgroundAgentStatusPhase } from '@/tui/types';
import { t } from '../i18n';

const MAX_DETAIL_LENGTH = 240;

function truncate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const collapsed = value.trim().replaceAll(/\s+/g, ' ');
  if (collapsed.length === 0) return undefined;
  if (collapsed.length <= MAX_DETAIL_LENGTH) return collapsed;
  return `${collapsed.slice(0, MAX_DETAIL_LENGTH - 3)}...`;
}

export type BackgroundTaskTranscriptPhase = 'started' | 'updated' | 'terminal';

function phaseFromStatus(status: BackgroundTaskStatus): BackgroundAgentStatusPhase {
  switch (status) {
    case 'running':
      return 'started';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'timed_out':
    case 'killed':
    case 'lost':
      return 'failed';
  }
}

function subjectFor(info: BackgroundTaskInfo): string {
  if (info.kind === 'agent') return t('agent task', 'задача агента');
  if (info.kind === 'question') return t('question task', 'задача с вопросом');
  return t('bash task', 'задача bash');
}

function headlineFor(info: BackgroundTaskInfo): string {
  const subject = subjectFor(info);
  switch (info.status) {
    case 'running':
      return t(`${subject} started in background`, `${subject} запущена в фоне`);
    case 'completed':
      return t(`${subject} completed in background`, `${subject} завершена в фоне`);
    case 'failed':
      return t(`${subject} failed in background`, `${subject} завершилась с ошибкой в фоне`);
    case 'timed_out':
      return t(`${subject} timed out`, `${subject}: истекло время ожидания`);
    case 'killed':
      return t(`${subject} stopped`, `${subject} остановлена`);
    case 'lost':
      return t(`${subject} lost`, `${subject} потеряна`);
  }
}

function detailFor(info: BackgroundTaskInfo): string | undefined {
  const parts: string[] = [];
  const description = truncate(info.description);
  if (description !== undefined) parts.push(description);

  if (info.status === 'completed' || info.status === 'failed') {
    if (info.kind === 'process' && info.exitCode !== null) {
      parts.push(t(`exit ${info.exitCode}`, `код выхода ${info.exitCode}`));
    }
  }
  if (info.status === 'killed') {
    const reason = truncate(info.stopReason);
    parts.push(reason !== undefined ? t(`stopped — ${reason}`, `остановлена — ${reason}`) : t('stopped', 'остановлена'));
  }
  if (info.status === 'failed') {
    const reason = truncate(info.stopReason);
    if (reason !== undefined) parts.push(reason);
  }
  if (info.status === 'timed_out') parts.push(t('timed out', 'истекло время ожидания'));
  if (info.status === 'lost') {
    parts.push(t('session restarted before completion', 'сессия перезапущена до завершения'));
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Build a transcript card payload for a background task lifecycle
 * snapshot. The returned phase drives bullet color in the renderer
 * (`BackgroundAgentStatusComponent`); the detail line carries the extra
 * status nuance (exit code, kill reason, etc.).
 */
export function formatBackgroundTaskTranscript(
  info: BackgroundTaskInfo,
): BackgroundAgentStatusData {
  return {
    phase: phaseFromStatus(info.status),
    headline: headlineFor(info),
    detail: detailFor(info),
  };
}
