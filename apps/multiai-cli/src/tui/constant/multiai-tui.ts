import { DEFAULT_OAUTH_PROVIDER_NAME } from '#/constant/app';

import { t } from '../i18n';

export { DEFAULT_OAUTH_PROVIDER_NAME, OAUTH_LOGIN_REQUIRED_CODE, PRODUCT_NAME } from '#/constant/app';

export const llmNotSetMessage = (): string =>
  t('LLM not set, send "/login" to login', 'LLM не выбрана, отправьте «/login» для входа');
export const noActiveSessionMessage = (): string =>
  t('No active session. Send /login to login.', 'Нет активной сессии. Отправьте /login для входа.');
export const ctrlDHint = (): string => t('Press Ctrl+D again to exit', 'Нажмите Ctrl+D ещё раз для выхода');
export const ctrlCHint = (): string => t('Press Ctrl+C again to exit', 'Нажмите Ctrl+C ещё раз для выхода');
export const oauthLoginRequiredStartupNotice = (): string =>
  t('OAuth login expired. Send /login to login.', 'Срок действия входа через OAuth истёк. Отправьте /login для повторного входа.');
export const MAIN_AGENT_ID = 'main';
export const EXIT_CONFIRM_WINDOW_MS = 1500;
// Time window for treating two consecutive Esc presses as a double-Esc, which
// opens the undo selector. Kept short (double-click feel) so two deliberate
// presses far apart don't accidentally trigger undo.
export const DOUBLE_ESC_WINDOW_MS = 600;

export function isManagedUsageProvider(
  providerKey: string | undefined,
): providerKey is typeof DEFAULT_OAUTH_PROVIDER_NAME {
  return providerKey === DEFAULT_OAUTH_PROVIDER_NAME;
}
