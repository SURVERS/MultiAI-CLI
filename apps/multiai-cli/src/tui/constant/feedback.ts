/**
 * Constants for the /feedback command — endpoints, telemetry keys, and
 * the status messages shown around the feedback submission flow.
 *
 * Dialog-internal copy (the box title, subtitle, footer) lives next to
 * the dialog component itself, since it is part of that component's
 * visual contract.
 */

import { FEEDBACK_VERSION_PREFIX } from '#/constant/app';

import { t } from '../i18n';

export {
  FEEDBACK_ISSUE_URL,
  FEEDBACK_TELEMETRY_EVENT,
  FEEDBACK_VERSION_PREFIX,
} from '#/constant/app';

export const feedbackStatusSubmitting = (): string => t('Submitting feedback…', 'Отправка отзыва…');
export const feedbackStatusUploading = (): string => t('Uploading attachments, this could take a few minutes…', 'Загрузка вложений — это может занять несколько минут…');
export const feedbackStatusSuccess = (): string => t('Feedback submitted, thank you!', 'Отзыв отправлен, спасибо!');
export const feedbackStatusCancelled = (): string => t('Feedback cancelled.', 'Отправка отзыва отменена.');
export const feedbackStatusNetworkError = (): string => t('Network error, failed to submit feedback.', 'Ошибка сети: не удалось отправить отзыв.');
export const feedbackStatusFallback = (): string => t('Opening GitHub Issues as fallback…', 'Открываем GitHub Issues как запасной вариант…');
export const feedbackStatusNotSignedIn = (): string => t(
  "You're not signed in. Opening GitHub Issues for feedback…",
  'Вы не вошли в систему. Открываем GitHub Issues для отправки отзыва…',
);
export const feedbackStatusUploadFailed = (): string => t(
  'Feedback sent; attachment upload failed — see feedback-upload.log.',
  'Отзыв отправлен, но вложения загрузить не удалось — см. feedback-upload.log.',
);

export function feedbackHttpErrorMessage(status: number): string {
  return t(`Failed to submit feedback (HTTP ${String(status)}).`, `Не удалось отправить отзыв (HTTP ${String(status)}).`);
}

export function feedbackSessionLine(sessionId: string): string {
  return t(`Session: ${sessionId}`, `Сессия: ${sessionId}`);
}

export function feedbackIdLine(feedbackId: number): string {
  return t(`Feedback ID: ${String(feedbackId)}`, `ID отзыва: ${String(feedbackId)}`);
}

// Hint shown beneath session-level error messages in the TUI to point users
// at the `/export-debug-zip` workflow so they can share diagnostics with us.
export function errorReportHintLine(): string {
  return t(
    "If this persists, run `/export-debug-zip` and share the file with us for diagnosis. Please don't share it publicly.",
    'Если проблема сохраняется, выполните `/export-debug-zip` и отправьте нам файл для диагностики. Не публикуйте его открыто.',
  );
}

export function withFeedbackVersionPrefix(version: string): string {
  return `${FEEDBACK_VERSION_PREFIX}${version}`;
}
