import {
  effectiveModelAlias,
  type ExperimentalFeatureState,
  type ModelAlias,
  type PermissionMode,
  type Session,
  type ThinkingEffort,
} from '@multiai/sdk';

import { EditorSelectorComponent } from '../components/dialogs/editor-selector';
import { EffortSelectorComponent } from '../components/dialogs/effort-selector';
import {
  ExperimentsSelectorComponent,
  type ExperimentalFeatureDraftChange,
} from '../components/dialogs/experiments-selector';
import { LanguageSelectorComponent } from '../components/dialogs/language-selector';
import { modelDisplayName, segmentsFor } from '../components/dialogs/model-selector';
import { TabbedModelSelectorComponent } from '../components/dialogs/tabbed-model-selector';
import { PermissionSelectorComponent } from '../components/dialogs/permission-selector';
import { SettingsSelectorComponent, type SettingsSelection } from '../components/dialogs/settings-selector';
import { ThemeSelectorComponent } from '../components/dialogs/theme-selector';
import { UpdatePreferenceSelectorComponent } from '../components/dialogs/update-preference-selector';
import { DEFAULT_TUI_CONFIG, saveTuiConfig, type TuiConfig } from '../config';
import { formatTuiLanguage, setTuiLanguage, t, type TuiLanguage } from '../i18n';
import type { ThemeName } from '#/tui/theme';
import { currentTheme, isBuiltInTheme, lightColors, loadCustomThemeMerged } from '#/tui/theme';
import { noActiveSessionMessage } from '../constant/multiai-tui';
import { formatErrorMessage } from '../utils/event-payload';
import { thinkingEffortToConfig } from '../utils/thinking-config';
import { showUsage } from './info';
import { setExperimentalFeatures } from './experimental-flags';
import type { SlashCommandHost } from './dispatch';

// ---------------------------------------------------------------------------
// Plan / Config commands
// ---------------------------------------------------------------------------

const MODEL_PICKER_REFRESH_TIMEOUT_MS = 2_000;

const modelSwitchCacheWarning = (): string =>
  t(
    'Note: Switching models invalidates the existing prompt cache. Use /new to avoid extra token costs.',
    'Примечание: смена модели сбрасывает текущий кэш промпта. Используйте /new, чтобы избежать лишних затрат токенов.',
  );
const effortSwitchCacheWarning = (): string =>
  t(
    'Note: Switching effort invalidates the existing prompt cache. Use /new to avoid extra token costs.',
    'Примечание: смена уровня усилий сбрасывает текущий кэш промпта. Используйте /new, чтобы избежать лишних затрат токенов.',
  );

/** True once the conversation has at least one user message: a switch from
 * then on resends the accumulated context, losing the cache. Shell-command
 * echoes are also 'user' transcript entries but carry an empty `bullet`, so
 * they're excluded. */
function hasConversationHistory(host: SlashCommandHost): boolean {
  return host.state.transcriptEntries.some(
    (entry) => entry.kind === 'user' && entry.bullet !== '',
  );
}

function currentTuiConfig(host: SlashCommandHost): TuiConfig {
  return {
    language: host.state.appState.language ?? DEFAULT_TUI_CONFIG.language,
    theme: host.state.appState.theme,
    editorCommand: host.state.appState.editorCommand,
    disablePasteBurst: host.state.appState.disablePasteBurst ?? DEFAULT_TUI_CONFIG.disablePasteBurst,
    notifications: host.state.appState.notifications,
    upgrade: host.state.appState.upgrade,
  };
}

export function effectiveModelForHost(host: SlashCommandHost, model: ModelAlias): ModelAlias {
  const providerType = host.state.appState.availableProviders[model.provider]?.type;
  // Flat models (no named provider, e.g. inline base_url served by a v2
  // backend) have no provider entry to look up; their own protocol declaration
  // plays the provider-identity role, mirroring the resolver.
  return effectiveModelAlias(model, providerType ?? model.protocol);
}

export async function handlePlanCommand(host: SlashCommandHost, args: string): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  const subcmd = args.trim().toLowerCase();
  if (subcmd === 'clear') {
    await session.clearPlan();
    host.showNotice(t('Plan cleared', 'План очищен'));
    return;
  }

  let enabled: boolean;
  if (subcmd.length === 0) enabled = !host.state.appState.planMode;
  else if (subcmd === 'on') enabled = true;
  else if (subcmd === 'off') enabled = false;
  else {
    host.showError(t(`Unknown plan subcommand: ${subcmd}`, `Неизвестная подкоманда плана: ${subcmd}`));
    return;
  }

  await applyPlanMode(host, session, enabled);
}

async function applyPlanMode(host: SlashCommandHost, session: Session, enabled: boolean): Promise<void> {
  try {
    await session.setPlanMode(enabled);
    host.setAppState({ planMode: enabled });
    if (enabled) {
      const plan = await session.getPlan().catch(() => null);
      host.showNotice(
        t('Plan mode: ON', 'Режим плана: ВКЛ.'),
        plan?.path !== undefined
          ? t(`Plan will be created here: ${plan.path}`, `План будет создан здесь: ${plan.path}`)
          : undefined,
      );
      return;
    }
    host.showNotice(t('Plan mode: OFF', 'Режим плана: ВЫКЛ.'));
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to set plan mode: ${msg}`, `Не удалось изменить режим плана: ${msg}`));
  }
}

export async function handleYoloCommand(host: SlashCommandHost, args: string): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  const subcmd = args.trim().toLowerCase();
  const currentMode = host.state.appState.permissionMode;

  if (subcmd === 'on') {
    if (currentMode === 'yolo') {
      host.showNotice(t('YOLO mode is already on', 'Режим YOLO уже включён.'));
      return;
    }
    await session.setPermission('yolo');
    host.setAppState({ permissionMode: 'yolo' });
    host.showNotice(t('YOLO mode: ON', 'Режим YOLO: ВКЛ.'), t('Tool actions auto-approved; the agent may still ask you questions.', 'Действия инструментов подтверждаются автоматически; агент всё ещё может задавать вопросы.'));
    return;
  }

  if (subcmd === 'off') {
    if (currentMode !== 'yolo') {
      host.showNotice(t('YOLO mode is already off', 'Режим YOLO уже выключен.'));
      return;
    }
    await session.setPermission('manual');
    host.setAppState({ permissionMode: 'manual' });
    host.showNotice(t('YOLO mode: OFF', 'Режим YOLO: ВЫКЛ.'));
    return;
  }

  // toggle
  if (currentMode === 'yolo') {
    await session.setPermission('manual');
    host.setAppState({ permissionMode: 'manual' });
    host.showNotice(t('YOLO mode: OFF', 'Режим YOLO: ВЫКЛ.'));
  } else {
    await session.setPermission('yolo');
    host.setAppState({ permissionMode: 'yolo' });
    host.showNotice(t('YOLO mode: ON', 'Режим YOLO: ВКЛ.'), t('Tool actions auto-approved; the agent may still ask you questions.', 'Действия инструментов подтверждаются автоматически; агент всё ещё может задавать вопросы.'));
  }
}

export async function handleAutoCommand(host: SlashCommandHost, args: string): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  const subcmd = args.trim().toLowerCase();
  const currentMode = host.state.appState.permissionMode;

  if (subcmd === 'on') {
    if (currentMode === 'auto') {
      host.showNotice(t('Auto mode is already on', 'Автоматический режим уже включён.'));
      return;
    }
    await session.setPermission('auto');
    host.setAppState({ permissionMode: 'auto' });
    host.showNotice(t('Auto mode: ON', 'Автоматический режим: ВКЛ.'), t('All actions auto-approved; the agent will not ask you questions.', 'Все действия подтверждаются автоматически; агент не будет задавать вопросы.'));
    return;
  }

  if (subcmd === 'off') {
    if (currentMode !== 'auto') {
      host.showNotice(t('Auto mode is already off', 'Автоматический режим уже выключен.'));
      return;
    }
    await session.setPermission('manual');
    host.setAppState({ permissionMode: 'manual' });
    host.showNotice(t('Auto mode: OFF', 'Автоматический режим: ВЫКЛ.'));
    return;
  }

  // toggle
  if (currentMode === 'auto') {
    await session.setPermission('manual');
    host.setAppState({ permissionMode: 'manual' });
    host.showNotice(t('Auto mode: OFF', 'Автоматический режим: ВЫКЛ.'));
  } else {
    await session.setPermission('auto');
    host.setAppState({ permissionMode: 'auto' });
    host.showNotice(t('Auto mode: ON', 'Автоматический режим: ВКЛ.'), t('All actions auto-approved; the agent will not ask you questions.', 'Все действия подтверждаются автоматически; агент не будет задавать вопросы.'));
  }
}

export async function handleCompactCommand(host: SlashCommandHost, args: string): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }
  const customInstruction = args.trim() || undefined;
  await session.compact({ instruction: customInstruction });
}

export async function handleEditorCommand(host: SlashCommandHost, args: string): Promise<void> {
  const command = args.trim();
  if (command.length === 0) {
    showEditorPicker(host);
    return;
  }
  await applyEditorChoice(host, command);
}

export async function handleThemeCommand(host: SlashCommandHost, args: string): Promise<void> {
  const theme = args.trim();
  if (theme.length === 0) {
    showThemePicker(host);
    return;
  }
  if (!isBuiltInTheme(theme)) {
    const custom = await loadCustomThemeMerged(theme);
    if (custom === null) {
      host.showError(t(`Unknown theme: ${theme}`, `Неизвестная тема: ${theme}`));
      return;
    }
  }
  await applyThemeChoice(host, theme);
}

export async function handleModelCommand(host: SlashCommandHost, args: string): Promise<void> {
  const alias = args.trim();
  await refreshModelsForPicker(host);
  if (alias.length === 0) {
    showModelPicker(host);
    return;
  }
  if (host.state.appState.availableModels[alias] === undefined) {
    host.showError(t(`Unknown model alias: ${alias}`, `Неизвестный псевдоним модели: ${alias}`));
    return;
  }
  showModelPicker(host, alias);
}

export async function handleEffortCommand(host: SlashCommandHost, args: string): Promise<void> {
  const alias = host.state.appState.model;
  const model = host.state.appState.availableModels[alias];
  if (model === undefined) {
    host.showError(t('No model selected. Run /model to select one first.', 'Модель не выбрана. Сначала выполните /model.'));
    return;
  }
  const effective = effectiveModelForHost(host, model);
  const segments = segmentsFor(effective);
  const arg = args.trim().toLowerCase();
  if (arg.length === 0) {
    showEffortPicker(host, effective, segments);
    return;
  }
  if (!segments.includes(arg)) {
    const providerType = host.state.appState.availableProviders[effective.provider]?.type;
    const protocol = effective.protocol ?? providerType;
    if (protocol !== 'anthropic') {
      host.showError(
        t(
          `Unsupported thinking effort "${arg}" for ${alias}. Available: ${segments.join(', ')}`,
          `Уровень усилий мышления "${arg}" не поддерживается для ${alias}. Доступно: ${segments.join(', ')}`,
        ),
      );
      return;
    }
    const knownEfforts = effective.supportEfforts?.join(', ') ?? t('none declared', 'не заявлены');
    host.showStatus(
      t(
        `Thinking effort "${arg}" is not listed for ${alias} (known: ${knownEfforts}). Sending "${arg}" unchanged; the configured provider will validate it.`,
        `Уровень усилий мышления "${arg}" не указан для ${alias} (известные: ${knownEfforts}). Значение "${arg}" будет отправлено без изменений; настроенный провайдер проверит его.`,
      ),
      'warning',
    );
  }
  await performModelSwitch(host, alias, arg, true);
}

function showEffortPicker(
  host: SlashCommandHost,
  model: ModelAlias,
  segments: readonly string[],
): void {
  const liveEffort = host.state.appState.thinkingEffort;
  const currentValue = segments.includes(liveEffort) ? liveEffort : (segments[0] ?? 'off');
  const alias = host.state.appState.model;
  host.mountEditorReplacement(
    new EffortSelectorComponent({
      efforts: segments,
      currentValue,
      warning: hasConversationHistory(host) ? effortSwitchCacheWarning() : undefined,
      onSelect: (effort) => {
        host.restoreEditor();
        void performModelSwitch(host, alias, effort, true);
      },
      onSessionOnlySelect: (effort) => {
        host.restoreEditor();
        void performModelSwitch(host, alias, effort, false);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Pickers & config apply
// ---------------------------------------------------------------------------

function showEditorPicker(host: SlashCommandHost): void {
  const currentValue = host.state.appState.editorCommand ?? '';
  host.mountEditorReplacement(
    new EditorSelectorComponent({
      currentValue,
      onSelect: (value) => {
        host.restoreEditor();
        void applyEditorChoice(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

async function refreshModelsForPicker(host: SlashCommandHost): Promise<void> {
  try {
    const result = await withTimeout(
      host.authFlow.refreshOAuthProviderModels(),
      MODEL_PICKER_REFRESH_TIMEOUT_MS,
    );
    if (result === undefined) return;
    for (const f of result.failed) {
      host.showStatus(t(`Skipped refreshing ${f.provider}: ${f.reason}`, `Не удалось обновить ${f.provider}: ${f.reason}`), 'warning');
    }
  } catch (error) {
    host.showStatus(t(`Skipped refreshing models: ${formatErrorMessage(error)}`, `Не удалось обновить модели: ${formatErrorMessage(error)}`), 'warning');
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => {
          resolve(undefined);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function applyEditorChoice(host: SlashCommandHost, value: string): Promise<void> {
  const previous = host.state.appState.editorCommand ?? '';
  if (value === previous && value.length > 0) {
    host.showStatus(t(`Editor unchanged: ${value.length > 0 ? value : 'auto-detect'}`, `Редактор не изменён: ${value.length > 0 ? value : 'автоопределение'}`));
    return;
  }

  const editorCommand = value.length > 0 ? value : null;
  try {
    await saveTuiConfig({
      ...currentTuiConfig(host),
      editorCommand,
    });
  } catch (error) {
    host.showStatus(
      t(`Failed to save editor: ${formatErrorMessage(error)}`, `Не удалось сохранить редактор: ${formatErrorMessage(error)}`),
      'error',
    );
    return;
  }

  host.setAppState({ editorCommand });
  host.showStatus(
    value.length > 0
      ? t(`Editor set to "${value}".`, `Редактор установлен на "${value}".`)
      : t('Editor set to auto-detect ($VISUAL / $EDITOR).', 'Включено автоопределение редактора ($VISUAL / $EDITOR).'),
  );
}

export function showModelPicker(host: SlashCommandHost, selectedValue: string = host.state.appState.model): void {
  const models = Object.fromEntries(
    Object.entries(host.state.appState.availableModels).map(([alias, model]) => [
      alias,
      effectiveModelForHost(host, model),
    ]),
  );
  const entries = Object.entries(models);
  if (entries.length === 0) {
    host.showNotice(
      t('No models configured', 'Модели не настроены'),
      t(
        'Run /login to sign in to MultiAI, or /provider to add another provider from a model catalog.',
        'Выполните /login, чтобы войти в MultiAI, или /provider, чтобы добавить другого провайдера из каталога моделей.',
      ),
    );
    return;
  }
  host.mountEditorReplacement(
    new TabbedModelSelectorComponent({
      models,
      currentValue: host.state.appState.model,
      selectedValue,
      currentThinkingEffort: host.state.appState.thinkingEffort,
      warning: hasConversationHistory(host) ? modelSwitchCacheWarning() : undefined,
      onSelect: ({ alias, thinking }) => {
        host.restoreEditor();
        void performModelSwitch(host, alias, thinking, true);
      },
      onSessionOnlySelect: ({ alias, thinking }) => {
        host.restoreEditor();
        void performModelSwitch(host, alias, thinking, false);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

async function performModelSwitch(
  host: SlashCommandHost,
  alias: string,
  effort: ThinkingEffort,
  persist: boolean,
): Promise<void> {
  if (host.state.appState.streamingPhase !== 'idle') {
    host.showError(t('Cannot switch models while streaming — press Esc or Ctrl-C first.', 'Нельзя сменить модель во время генерации — сначала нажмите Esc или Ctrl-C.'));
    return;
  }

  const prevModel = host.state.appState.model;
  const prevEffort = host.state.appState.thinkingEffort;
  const modelChanged = alias !== prevModel;
  const effortChanged = effort !== prevEffort;
  const runtimeChanged = modelChanged || effortChanged;
  let effectiveAlias = alias;
  let effectiveEffort = effort;

  const session = host.session;
  try {
    if (session === undefined && runtimeChanged) {
      await host.authFlow.activateModelAfterLogin(alias, effort);
    } else if (session !== undefined) {
      if (alias !== prevModel) {
        await session.setModel(alias);
      }
      if (effort !== prevEffort) {
        await session.setThinking(effort);
      }
      const status = await session.getStatus();
      effectiveAlias = status.model ?? alias;
      effectiveEffort = status.thinkingEffort;
    }
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to switch model: ${msg}`, `Не удалось сменить модель: ${msg}`));
    return;
  }

  if (session === undefined) {
    effectiveAlias = host.state.appState.model;
    effectiveEffort = host.state.appState.thinkingEffort;
  }
  const effectiveModelChanged = effectiveAlias !== prevModel;
  const effectiveEffortChanged = effectiveEffort !== prevEffort;
  const displayName = modelDisplayName(
    effectiveAlias,
    host.state.appState.availableModels[effectiveAlias],
  );
  host.setAppState({ model: effectiveAlias, thinkingEffort: effectiveEffort });
  if (session === undefined && runtimeChanged) {
    if (effectiveModelChanged) {
      host.track('model_switch', { model: effectiveAlias });
    }
    if (effectiveEffortChanged) {
      host.track('thinking_toggle', {
        enabled: effectiveEffort !== 'off',
        effort: effectiveEffort,
        from: prevEffort,
      });
    }
  }

  let persisted = false;
  if (persist) {
    try {
      persisted = await persistModelSelection(
        host,
        effectiveAlias,
        effectiveEffort,
        effectiveEffortChanged,
      );
    } catch (error) {
      const msg = formatErrorMessage(error);
      host.showError(t(`Switched to ${displayName}, but failed to save default: ${msg}`, `Модель переключена на ${displayName}, но не удалось сохранить её по умолчанию: ${msg}`));
      return;
    }
  }

  let status: string;
  if (effectiveModelChanged) {
    status = persist
      ? t(`Switched to ${displayName} with thinking ${effectiveEffort}.`, `Модель переключена на ${displayName}, мышление: ${effectiveEffort}.`)
      : t(`Switched to ${displayName} with thinking ${effectiveEffort} for this session only.`, `Модель переключена на ${displayName}, мышление: ${effectiveEffort}, только для этого сеанса.`);
  } else if (effectiveEffortChanged) {
    status = persist
      ? t(`Thinking set to ${effectiveEffort}.`, `Уровень мышления установлен на ${effectiveEffort}.`)
      : t(`Thinking set to ${effectiveEffort} for this session only.`, `Уровень мышления установлен на ${effectiveEffort} только для этого сеанса.`);
  } else if (persist && persisted) {
    status = t(`Saved ${displayName} with thinking ${effectiveEffort} as default.`, `${displayName} с уровнем мышления ${effectiveEffort} сохранена по умолчанию.`);
  } else {
    status = t(`Already using ${displayName} with thinking ${effectiveEffort}.`, `Уже используется ${displayName} с уровнем мышления ${effectiveEffort}.`);
  }
  host.showStatus(status, 'success');
}

async function persistModelSelection(
  host: SlashCommandHost,
  alias: string,
  effort: ThinkingEffort,
  effortChanged: boolean,
): Promise<boolean> {
  const config = await host.harness.getConfig({ reload: true });
  const model = host.state.appState.availableModels[alias];
  const full = thinkingEffortToConfig(
    effort,
    model === undefined ? undefined : effectiveModelForHost(host, model).supportEfforts,
  );
  // Re-confirming the effort shown when the picker opened is not an explicit
  // choice — persist the model but leave the stored effort preference alone.
  const patch = effortChanged ? full : { enabled: full.enabled };
  if (
    config.defaultModel === alias &&
    config.thinking?.enabled === patch.enabled &&
    (!effortChanged || config.thinking?.effort === patch.effort)
  ) {
    return false;
  }
  await host.harness.setConfig({
    defaultModel: alias,
    thinking: patch,
  });
  return true;
}

function showThemePicker(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new ThemeSelectorComponent({
      currentValue: host.state.appState.theme,
      onSelect: (value) => {
        host.restoreEditor();
        void applyThemeChoice(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

async function applyThemeChoice(host: SlashCommandHost, theme: ThemeName): Promise<void> {
  if (theme === host.state.appState.theme) {
    if (theme === 'auto') host.refreshTerminalThemeTracking();
    host.showStatus(t(`Theme unchanged: "${theme}".`, `Тема не изменена: "${theme}".`));
    return;
  }

  // Validate custom themes up front so a missing / malformed file reports an
  // error instead of silently persisting a name that resolves to the dark
  // fallback.
  if (!isBuiltInTheme(theme)) {
    const palette = await loadCustomThemeMerged(theme);
    if (palette === null) {
      host.showStatus(t(`Theme "${theme}" could not be loaded.`, `Не удалось загрузить тему "${theme}".`), 'error');
      return;
    }
  }

  try {
    await saveTuiConfig({
      ...currentTuiConfig(host),
      theme,
    });
  } catch (error) {
    host.showStatus(
      t(`Failed to save theme: ${formatErrorMessage(error)}`, `Не удалось сохранить тему: ${formatErrorMessage(error)}`),
      'error',
    );
    return;
  }

  const resolved = theme === 'auto'
    ? (currentTheme.palette === lightColors ? 'light' : 'dark')
    : undefined;
  await host.applyTheme(theme, resolved);
  host.refreshTerminalThemeTracking();
  host.track('theme_switch', { theme });
  const detail = theme === 'auto'
    ? t(` (tracking terminal; current: ${resolved})`, ` (отслеживается терминал; текущая: ${resolved})`)
    : '';
  host.showStatus(t(`Theme set to "${theme}"${detail}.`, `Тема установлена на "${theme}"${detail}.`));
}

export function showPermissionPicker(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new PermissionSelectorComponent({
      currentValue: host.state.appState.permissionMode,
      onSelect: (value) => {
        host.restoreEditor();
        void applyPermissionChoice(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

export function showUpdatePreferencePicker(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new UpdatePreferenceSelectorComponent({
      currentValue: host.state.appState.upgrade.autoInstall,
      onSelect: (value) => {
        host.restoreEditor();
        void applyUpdatePreferenceChoice(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

export async function showExperimentsPanel(host: SlashCommandHost): Promise<void> {
  let features: readonly ExperimentalFeatureState[];
  try {
    features = await host.harness.getExperimentalFeatures();
  } catch (error) {
    host.showError(t(`Failed to load experimental features: ${formatErrorMessage(error)}`, `Не удалось загрузить экспериментальные функции: ${formatErrorMessage(error)}`));
    return;
  }
  mountExperimentsPanel(host, features);
}

export async function applyExperimentalFeatureChanges(
  host: SlashCommandHost,
  changes: readonly ExperimentalFeatureDraftChange[],
): Promise<void> {
  if (changes.length === 0) {
    host.showStatus(
      t('No experimental feature changes to apply.', 'Нет изменений экспериментальных функций для применения.'),
      'textMuted',
    );
    return;
  }

  const experimental: Record<string, boolean> = {};
  for (const change of changes) {
    experimental[change.id] = change.enabled;
  }

  try {
    await host.harness.setConfig({ experimental });
    const features = await host.harness.getExperimentalFeatures();
    setExperimentalFeatures(features);
    host.refreshSlashCommandAutocomplete();
    host.restoreEditor();
    if (host.session !== undefined) {
      await host.session.reloadSession();
      await host.reloadCurrentSessionView(
        host.session,
        t('Experimental features updated. Session reloaded.', 'Экспериментальные функции обновлены. Сеанс перезагружен.'),
      );
    } else {
      host.showStatus(t('Experimental features updated.', 'Экспериментальные функции обновлены.'), 'success');
    }
    host.track('experimental_features_apply', { changed: changes.length });
  } catch (error) {
    host.showError(t(`Failed to update experimental features: ${formatErrorMessage(error)}`, `Не удалось обновить экспериментальные функции: ${formatErrorMessage(error)}`));
  }
}

function mountExperimentsPanel(
  host: SlashCommandHost,
  features: readonly ExperimentalFeatureState[],
): void {
  host.mountEditorReplacement(
    new ExperimentsSelectorComponent({
      features,
      onApply: (changes) => {
        void applyExperimentalFeatureChanges(host, changes);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

type UpdatePreferenceHost = {
  readonly state: {
    readonly appState: Pick<
      SlashCommandHost['state']['appState'],
      'theme' | 'editorCommand' | 'notifications' | 'upgrade'
    >;
  };
  setAppState(patch: Pick<SlashCommandHost['state']['appState'], 'upgrade'>): void;
  showStatus(msg: string, color?: string): void;
  track: SlashCommandHost['track'];
};

export async function applyUpdatePreferenceChoice(
  host: UpdatePreferenceHost,
  autoInstall: boolean,
): Promise<void> {
  if (autoInstall === host.state.appState.upgrade.autoInstall) {
    host.showStatus(t(`Automatic updates already ${autoInstall ? 'enabled' : 'disabled'}.`, `Автоматические обновления уже ${autoInstall ? 'включены' : 'отключены'}.`));
    return;
  }

  const upgrade = { autoInstall };
  try {
    await saveTuiConfig({
      ...currentTuiConfig(host as unknown as SlashCommandHost),
      upgrade,
    });
  } catch (error) {
    host.showStatus(
      t(`Failed to save automatic update setting: ${formatErrorMessage(error)}`, `Не удалось сохранить настройку автоматических обновлений: ${formatErrorMessage(error)}`),
      'error',
    );
    return;
  }

  host.setAppState({ upgrade });
  host.track('upgrade_preference_changed', { auto_install: autoInstall });
  host.showStatus(t(`Automatic updates ${autoInstall ? 'enabled' : 'disabled'}.`, `Автоматические обновления ${autoInstall ? 'включены' : 'отключены'}.`));
}

async function applyPermissionChoice(host: SlashCommandHost, mode: PermissionMode): Promise<void> {
  if (mode === host.state.appState.permissionMode) {
    host.showStatus(t(`Permission mode unchanged: ${mode}.`, `Режим разрешений не изменён: ${mode}.`));
    return;
  }

  try {
    await host.requireSession().setPermission(mode);
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to set permission mode: ${msg}`, `Не удалось установить режим разрешений: ${msg}`));
    return;
  }

  host.setAppState({ permissionMode: mode });
  host.showNotice(t(`Permission mode: ${mode}`, `Режим разрешений: ${mode}`));
}

export async function applyLanguageChoice(
  host: SlashCommandHost,
  language: TuiLanguage,
): Promise<void> {
  try {
    await saveTuiConfig({ ...currentTuiConfig(host), language });
  } catch (error) {
    host.showError(
      `${t('Failed to save language:', 'Не удалось сохранить язык:')} ${formatErrorMessage(error)}`,
    );
    return;
  }

  setTuiLanguage(language);
  host.setAppState({ language });
  host.showStatus(
    `${t('Interface language:', 'Язык интерфейса:')} ${formatTuiLanguage(language)}.`,
  );
}

export function showLanguagePicker(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new LanguageSelectorComponent({
      current: host.state.appState.language ?? DEFAULT_TUI_CONFIG.language ?? 'en',
      onSelect: (language) => {
        host.restoreEditor();
        void applyLanguageChoice(host, language);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

export async function handleLanguageCommand(
  host: SlashCommandHost,
  args: string,
): Promise<void> {
  const language = args.trim().toLowerCase();
  if (language === '') {
    showLanguagePicker(host);
    return;
  }
  if (language !== 'en' && language !== 'ru') {
    host.showError(t('Use /language en or /language ru.', 'Используй /language en или /language ru.'));
    return;
  }
  await applyLanguageChoice(host, language);
}

export function showSettingsSelector(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new SettingsSelectorComponent({
      onSelect: (value) => {
        handleSettingsSelection(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

function handleSettingsSelection(host: SlashCommandHost, value: SettingsSelection): void {
  host.restoreEditor();
  switch (value) {
    case 'model': showModelPicker(host); return;
    case 'language': showLanguagePicker(host); return;
    case 'permission': showPermissionPicker(host); return;
    case 'theme': showThemePicker(host); return;
    case 'editor': showEditorPicker(host); return;
    case 'experiments': void showExperimentsPanel(host); return;
    case 'upgrade': showUpdatePreferencePicker(host); return;
    case 'usage': void showUsage(host); return;
  }
}
