import {
  MULTIAI_PROVIDER_NAME,
  applyManagedMultiAIModelProfiles,
} from '@multiai/oauth';
import type { CreateSessionOptions, MultiAIConfig, MultiAIHarness, Session } from '@multiai/sdk';

import { createMultiAICliUserAgent } from '#/cli/version';

import type { SkillListSession } from '../commands';
import { t } from '../i18n';

import { oauthLoginRequiredStartupNotice } from '../constant/multiai-tui';
import {
  refreshAllProviderModels,
  type RefreshResult,
} from '../utils/refresh-providers';
import { thinkingEffortFromConfig } from '../utils/thinking-config';
import type { SessionEventHandler } from './session-event-handler';
import type { AppState, MultiAITUIOptions } from '../types';
import type { TUIState } from '../tui-state';

type MutableCreateSessionOptions = {
  -readonly [P in keyof CreateSessionOptions]: CreateSessionOptions[P];
};

export interface AuthFlowHost {
  state: TUIState;
  session: Session | undefined;
  readonly harness: MultiAIHarness;
  readonly options: MultiAITUIOptions;

  setAppState(patch: Partial<AppState>): void;
  setStartupReady(): void;
  resetSessionRuntime(): void;
  setSession(session: Session): Promise<void>;
  syncRuntimeState(session?: Session): Promise<void>;
  closeSession(reason: string): Promise<void>;
  appendStartupNotice(extra: string): void;
  readonly sessionEventHandler: SessionEventHandler;
  fetchSessions(): Promise<void>;
  updateTerminalTitle(): void;
  refreshSkillCommands(session?: SkillListSession): Promise<void>;
  refreshPluginCommands(session?: Session): Promise<void>;
  showStatus(message: string, color?: string): void;
}

export class AuthFlowController {
  constructor(private readonly host: AuthFlowHost) {}

  async refreshAvailableModels(): Promise<MultiAIConfig> {
    const config = await this.loadConfigWithManagedProfiles();
    this.host.setAppState({
      availableModels: config.models ?? {},
      availableProviders: config.providers ?? {},
    });
    return config;
  }

  enterLoginRequiredStartupState(): void {
    this.host.resetSessionRuntime();
    this.host.setAppState({
      sessionId: '',
      model: '',
      thinkingEffort: 'off',
      contextTokens: 0,
      maxContextTokens: 0,
      contextUsage: 0,
      sessionTitle: null,
    });
    this.host.appendStartupNotice(oauthLoginRequiredStartupNotice());
    this.host.setStartupReady();
  }

  async activateModelAfterLogin(model: string, effort?: string): Promise<void> {
    const { host } = this;
    if (host.session !== undefined) {
      await host.session.setModel(model);
      if (effort !== undefined) {
        await host.session.setThinking(effort);
      }
      return;
    }

    const options: MutableCreateSessionOptions = {
      workDir: host.state.appState.workDir,
      model,
      thinking: effort,
      permission: host.options.startup.auto
        ? 'auto'
        : host.options.startup.yolo
          ? 'yolo'
          : undefined,
      planMode: host.state.appState.planMode ? true : undefined,
    };
    if (host.state.appState.additionalDirs.length > 0) {
      options.additionalDirs = [...host.state.appState.additionalDirs];
    }
    const session = await host.harness.createSession(options);
    await host.setSession(session);
    host.setAppState({
      sessionId: session.id,
      sessionTitle: session.summary?.title ?? null,
    });
    await host.syncRuntimeState(session);
    host.sessionEventHandler.startSubscription();
    void host.fetchSessions();
    host.updateTerminalTitle();
    void host.refreshSkillCommands(host.session);
    void host.refreshPluginCommands(host.session);
  }

  async clearActiveSessionAfterLogout(): Promise<void> {
    await this.host.closeSession('logged out');
    this.host.resetSessionRuntime();
    this.host.setAppState({
      sessionId: '',
      model: '',
      sessionTitle: null,
    });
    await this.host.refreshSkillCommands();
    await this.host.refreshPluginCommands();
  }

  async refreshConfigAfterLogin(): Promise<void> {
    const { host } = this;
    const config = await this.loadConfigWithManagedProfiles();
    const availableModels = config.models ?? {};
    const availableProviders = config.providers ?? {};
    const defaultModel = host.options.startup.model ?? config.defaultModel;
    const selected = defaultModel !== undefined ? availableModels[defaultModel] : undefined;

    if (defaultModel === undefined || selected === undefined) {
      host.setAppState({ availableModels, availableProviders });
      return;
    }

    await this.activateModelAfterLogin(defaultModel, thinkingEffortFromConfig(config.thinking));
    const appStatePatch: Partial<AppState> = {
      availableModels,
      availableProviders,
      model: defaultModel,
      maxContextTokens: selected.maxContextSize,
    };
    host.setAppState(appStatePatch);
  }

  async refreshConfigAfterLogout(): Promise<void> {
    const config = await this.host.harness.getConfig({ reload: true });
    this.host.setAppState({
      availableModels: config.models ?? {},
      availableProviders: config.providers ?? {},
      model: '',
      thinkingEffort: 'off',
      maxContextTokens: 0,
      contextUsage: 0,
      contextTokens: 0,
    });
  }

  private async loadConfigWithManagedProfiles(): Promise<MultiAIConfig> {
    const { host } = this;
    const config = await host.harness.getConfig({ reload: true });
    const next = structuredClone(config);
    if (!applyManagedMultiAIModelProfiles(next)) return config;
    return host.harness.setConfig({ models: next.models });
  }

  /**
   * Re-fetch model lists from every provider whose upstream supports it
   * (managed OAuth, open platforms, custom registries) and update local
   * config.  Runs best-effort: individual provider failures are collected
   * and returned instead of thrown.
   */
  async refreshProviderModels(): Promise<RefreshResult> {
    const oauth = await this.refreshOAuthProviderModels();
    const discovered = await this.refreshDiscoverableProviderModels();
    return {
      changed: [...oauth.changed, ...discovered.changed],
      unchanged: [...oauth.unchanged, ...discovered.unchanged],
      failed: [...oauth.failed, ...discovered.failed],
    };
  }

  async refreshOAuthProviderModels(): Promise<RefreshResult> {
    const { host } = this;
    const previousManagedAliases = new Set(
      Object.entries(host.state.appState.availableModels)
        .filter(([, model]) => model.provider === MULTIAI_PROVIDER_NAME)
        .map(([alias]) => alias),
    );
    const result = await host.harness.auth.refreshModels();
    const config = await this.refreshAvailableModels();
    await this.reconcileDisabledActiveModel(previousManagedAliases, config);
    return result;
  }

  private async refreshDiscoverableProviderModels(): Promise<RefreshResult> {
    const { host } = this;
    const result = await refreshAllProviderModels(
      {
        getConfig: () => host.harness.getConfig({ reload: true }),
        removeProvider: (id) => host.harness.removeProvider(id),
        setConfig: (patch) => host.harness.setConfig(patch),
        resolveOAuthToken: async (providerName, oauthRef) => {
          const tokenProvider = host.harness.auth.resolveOAuthTokenProvider(providerName, oauthRef);
          return tokenProvider.getAccessToken();
        },
        userAgent: createMultiAICliUserAgent(),
      },
      { scope: 'all' },
    );
    if (result.changed.length > 0) {
      await this.refreshAvailableModels();
    }
    return result;
  }

  private async reconcileDisabledActiveModel(
    previousManagedAliases: ReadonlySet<string>,
    config: MultiAIConfig,
  ): Promise<void> {
    const { host } = this;
    const activeModel = host.state.appState.model;
    const availableModels = config.models ?? {};
    if (!previousManagedAliases.has(activeModel) || availableModels[activeModel] !== undefined) {
      return;
    }

    const fallback =
      config.defaultModel !== undefined && availableModels[config.defaultModel] !== undefined
        ? config.defaultModel
        : Object.keys(availableModels)[0];
    if (fallback === undefined) {
      host.setAppState({ model: '', thinkingEffort: 'off', maxContextTokens: 0 });
      host.showStatus(
        t(`${activeModel} is no longer available. Select another provider after one is configured.`, `${activeModel} больше недоступна. Выберите другого провайдера после его настройки.`),
        'warning',
      );
      return;
    }

    if (host.session === undefined) {
      host.setAppState({ model: fallback });
      return;
    }
    if (host.state.appState.streamingPhase !== 'idle') {
      host.showStatus(
        t(`${activeModel} is no longer available. Switch to ${fallback} after the current response finishes.`, `${activeModel} больше недоступна. Переключитесь на ${fallback} после завершения текущего ответа.`),
        'warning',
      );
      return;
    }

    try {
      await host.session.setModel(fallback);
      await host.syncRuntimeState(host.session);
      host.showStatus(t(`${activeModel} is no longer available. Switched to ${fallback}.`, `${activeModel} больше недоступна. Выполнено переключение на ${fallback}.`), 'warning');
    } catch (error) {
      host.showStatus(
        `Could not switch from disabled model ${activeModel}: ${error instanceof Error ? error.message : String(error)}`,
        'warning',
      );
    }
  }
}
