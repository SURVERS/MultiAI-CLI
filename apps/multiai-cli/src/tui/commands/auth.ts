import type { MultiAIAuthorization, MultiAIOAuthMethod, MultiAIOAuthPersistence } from '@multiai/oauth';
import { log } from '@multiai/sdk';

import { DEFAULT_OAUTH_PROVIDER_NAME } from '../constant/multiai-tui';
import { t } from '../i18n';
import type { LoginProgressSpinnerHandle } from '../types';
import { formatErrorMessage } from '../utils/event-payload';
import { openUrl } from '#/utils/open-url';
import type { SlashCommandHost } from './dispatch';

interface LoginFlags {
  readonly method: MultiAIOAuthMethod;
  readonly persistence: MultiAIOAuthPersistence;
}

function parseLoginFlags(args: string): LoginFlags {
  const flags = new Set(args.split(/\s+/).filter(Boolean));
  return {
    method: flags.has('--device') ? 'device' : 'browser',
    persistence: flags.has('--session-only') ? 'session' : 'keyring',
  };
}

export async function handleLoginCommand(
  host: SlashCommandHost,
  args: string = '',
): Promise<void> {
  const flags = parseLoginFlags(args);
  const status = await host.harness.auth.status().catch(() => ({ loggedIn: false }));
  const alreadyLoggedIn = status.loggedIn;
  const controller = new AbortController();
  let spinner: LoginProgressSpinnerHandle | undefined;

  const cancelLogin = (): void => {
    controller.abort();
  };
  host.cancelInFlight = cancelLogin;

  const showAuthorization = (authorization: MultiAIAuthorization): void => {
    if (authorization.method === 'device') {
      spinner = host.showLoginAuthorizationPrompt(authorization);
      return;
    }
    openUrl(authorization.authorizationUri);
    host.showNotice(
      t('Sign in to MultiAI', 'Войдите в MultiAI'),
      t(
        `Browser opened. If it did not open, visit:\n${authorization.authorizationUri}`,
        `Браузер открыт. Если он не открылся, перейдите по ссылке:\n${authorization.authorizationUri}`,
      ),
    );
    spinner = host.showLoginProgressSpinner(
      t('Waiting for browser authorization…', 'Ожидание авторизации в браузере…'),
    );
  };

  try {
    await host.harness.auth.login({
      method: flags.method,
      persistence: flags.persistence,
      signal: controller.signal,
      onAuthorization: showAuthorization,
    });
    spinner?.stop({ ok: true, label: t('Logged in to MultiAI.', 'Вход в MultiAI выполнен.') });
    spinner = undefined;
    await host.authFlow.refreshConfigAfterLogin();
    if (alreadyLoggedIn) {
      host.showStatus(t('MultiAI session and model catalog refreshed.', 'Сессия MultiAI и каталог моделей обновлены.'));
    }
  } catch (error) {
    const cancelled = controller.signal.aborted;
    spinner?.stop({
      ok: false,
      label: cancelled
        ? t('Login cancelled.', 'Вход отменён.')
        : t('Login failed.', 'Не удалось войти.'),
    });
    spinner = undefined;
    if (cancelled) return;
    log.warn('MultiAI login failed', {
      providerName: DEFAULT_OAUTH_PROVIDER_NAME,
      sessionId: host.session?.id,
      error,
    });
    const message = formatErrorMessage(error);
    const hint =
      flags.persistence === 'keyring' && /keyring|credential|secret service/i.test(message)
        ? t(
            ' Try /login --session-only for a process-only session.',
            ' Попробуйте /login --session-only для сессии только в текущем процессе.',
          )
        : flags.method === 'browser'
          ? t(
              ' Try /login --device if the browser callback is unavailable.',
              ' Попробуйте /login --device, если обратный вызов браузера недоступен.',
            )
          : '';
    host.showError(t(`Login failed: ${message}${hint}`, `Ошибка входа: ${message}${hint}`));
  } finally {
    if (host.cancelInFlight === cancelLogin) {
      host.cancelInFlight = undefined;
    }
  }
}

export async function handleLogoutCommand(host: SlashCommandHost): Promise<void> {
  const status = await host.harness.auth.status().catch(() => ({ loggedIn: false }));
  const config = await host.harness.getConfig();
  const hasManagedConfig = config.providers[DEFAULT_OAUTH_PROVIDER_NAME] !== undefined;
  if (!status.loggedIn && !hasManagedConfig) {
    host.showStatus(t('MultiAI account is already signed out.', 'Вы уже вышли из аккаунта MultiAI.'));
    return;
  }

  const currentModel = host.state.appState.model.trim();
  const currentProvider = host.state.appState.availableModels[currentModel]?.provider;
  await host.harness.auth.logout();

  if (currentProvider === DEFAULT_OAUTH_PROVIDER_NAME) {
    await host.authFlow.refreshConfigAfterLogout();
    await host.authFlow.clearActiveSessionAfterLogout();
  } else {
    await host.authFlow.refreshAvailableModels();
  }
  host.showStatus(t('Logged out from MultiAI.', 'Вы вышли из MultiAI.'));
}
