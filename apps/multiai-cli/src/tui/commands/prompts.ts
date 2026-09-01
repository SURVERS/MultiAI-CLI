import {
  catalogModelToAlias,
  resolveCatalogImport,
  type Catalog,
  type CatalogModel,
  type ModelAlias,
  type ThinkingEffort,
} from '@multiai/sdk';
import { capabilitiesForModel } from '@multiai/oauth';
import type {
  ProviderDiscoveryModelInfo,
  OpenPlatformDefinition,
} from '@multiai/oauth';

import { ApiKeyInputDialogComponent, type ApiKeyInputResult } from '../components/dialogs/api-key-input-dialog';
import { ChoicePickerComponent, type ChoiceOption } from '../components/dialogs/choice-picker';
import { FeedbackInputDialogComponent, type FeedbackInputDialogResult } from '../components/dialogs/feedback-input-dialog';
import { ModelSelectorComponent } from '../components/dialogs/model-selector';
import { PlatformSelectorComponent } from '../components/dialogs/platform-selector';
import { t } from '../i18n';
import type { SlashCommandHost } from './dispatch';

export function promptPlatformSelection(host: SlashCommandHost): Promise<string | undefined> {
  return new Promise((resolve) => {
    const selector = new PlatformSelectorComponent({
      onSelect: (platformId) => {
        host.restoreEditor();
        resolve(platformId);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(selector);
  });
}

export function promptLogoutProviderSelection(
  host: SlashCommandHost,
  options: readonly ChoiceOption[],
  currentValue: string | undefined,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const picker = new ChoicePickerComponent({
      title: t('Select a provider to log out', 'Выберите провайдера для выхода'),
      options,
      currentValue,
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(picker);
  });
}

/** @deprecated The feedback command is not registered in MultiAI CLI. */
export interface FeedbackPromptResult {
  readonly value: string;
}

/** @deprecated The feedback command is not registered in MultiAI CLI. */
export function promptFeedbackInput(host: SlashCommandHost): Promise<FeedbackPromptResult | undefined> {
  return new Promise((resolve) => {
    const dialog = new FeedbackInputDialogComponent((result: FeedbackInputDialogResult) => {
      host.restoreEditor();
      resolve(result.kind === 'ok' ? { value: result.value } : undefined);
    });
    host.mountEditorReplacement(dialog);
  });
}

/** @deprecated The feedback command is not registered in MultiAI CLI. */
export type FeedbackAttachmentLevel = 'none' | 'logs' | 'logs+codebase';

const FEEDBACK_ATTACHMENT_OPTIONS: readonly ChoiceOption[] = [
  { value: 'none', label: t('No attachment', 'Без вложений'), description: t('Text feedback only', 'Только текстовый отзыв') },
  { value: 'logs', label: t('Logs only', 'Только журналы'), description: t('Attach session diagnostics', 'Приложить диагностику сессии') },
  { value: 'logs+codebase', label: t('Logs + codebase', 'Журналы + кодовая база'), description: t('Attach diagnostics and codebase', 'Приложить диагностику и кодовую базу') },
];

/** @deprecated The feedback command is not registered in MultiAI CLI. */
export function promptFeedbackAttachment(
  host: SlashCommandHost,
): Promise<FeedbackAttachmentLevel | undefined> {
  return new Promise((resolve) => {
    const picker = new ChoicePickerComponent({
      title: t('Share diagnostic info?', 'Поделиться диагностической информацией?'),
      options: FEEDBACK_ATTACHMENT_OPTIONS,
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value as FeedbackAttachmentLevel);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(picker);
  });
}

export function promptApiKey(
  host: SlashCommandHost,
  platformName: string,
  subtitleLines: readonly string[] = [t('Your key will be saved to ~/.multiai/config.toml', 'Ваш ключ будет сохранён в ~/.multiai/config.toml')],
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const dialog = new ApiKeyInputDialogComponent(
      platformName,
      subtitleLines,
      (result: ApiKeyInputResult) => {
        host.restoreEditor();
        resolve(result.kind === 'ok' ? result.value : undefined);
      },
    );
    host.mountEditorReplacement(dialog);
  });
}

/**
 * Asks for the provider endpoint the catalog did not declare (or declared
 * only as an env placeholder) — required for catalog imports whose protocol
 * was guessed, where the built-in default endpoint would point at the wrong
 * host. Esc cancels the import.
 */
export function promptBaseUrl(host: SlashCommandHost, platformName: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const dialog = new ApiKeyInputDialogComponent(
      platformName,
      [t('The catalog declares no endpoint for this provider — enter its base URL.', 'В каталоге не указан адрес этого провайдера — введите его базовый URL.')],
      (result: ApiKeyInputResult) => {
        host.restoreEditor();
        resolve(result.kind === 'ok' ? result.value : undefined);
      },
      {
        title: t(`Enter base URL for ${platformName}`, `Введите базовый URL для ${platformName}`),
        mask: false,
        emptyHint: t('Base URL cannot be empty.', 'Базовый URL не может быть пустым.'),
      },
    );
    host.mountEditorReplacement(dialog);
  });
}

export function promptCatalogProviderSelection(host: SlashCommandHost, catalog: Catalog): Promise<string | undefined> {
  return new Promise((resolve) => {
    const options: ChoiceOption[] = Object.entries(catalog)
      .filter(([, entry]) => resolveCatalogImport(entry).kind !== 'invalid')
      .map(([id, entry]) => ({
        value: id,
        label: entry.name ?? id,
        description:
          typeof entry.api === 'string' && entry.api.length > 0 ? entry.api : undefined,
      }))
      .toSorted((a, b) => a.label.localeCompare(b.label));

    if (options.length === 0) {
      host.showError(t('Catalog has no providers with supported wire types.', 'В каталоге нет провайдеров с поддерживаемыми типами протоколов.'));
      resolve(undefined);
      return;
    }

    const picker = new ChoicePickerComponent({
      title: t('Select a provider', 'Выберите провайдера'),
      options,
      searchable: true,
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(picker);
  });
}

export async function promptModelSelectionForOpenPlatform(
  host: SlashCommandHost,
  models: ProviderDiscoveryModelInfo[],
  platform: OpenPlatformDefinition,
): Promise<{ model: ProviderDiscoveryModelInfo; thinking: ThinkingEffort } | undefined> {
  const modelDict: Record<string, ModelAlias> = {};
  for (const m of models) {
    modelDict[`${platform.id}/${m.id}`] = {
      provider: platform.id,
      model: m.id,
      maxContextSize: m.contextLength,
      capabilities: capabilitiesForModel(m),
      displayName: m.displayName,
    };
  }
  const selection = await runModelSelector(host, modelDict);
  if (selection === undefined) return undefined;
  const model = models.find((m) => `${platform.id}/${m.id}` === selection.alias);
  return model ? { model, thinking: selection.thinking } : undefined;
}

export async function promptModelSelectionForCatalog(
  host: SlashCommandHost,
  providerId: string,
  models: CatalogModel[],
): Promise<{ model: CatalogModel; thinking: ThinkingEffort } | undefined> {
  const modelDict: Record<string, ModelAlias> = {};
  for (const m of models) {
    modelDict[`${providerId}/${m.id}`] = catalogModelToAlias(providerId, m);
  }
  const selection = await runModelSelector(host, modelDict);
  if (selection === undefined) return undefined;
  const model = models.find((m) => `${providerId}/${m.id}` === selection.alias);
  return model ? { model, thinking: selection.thinking } : undefined;
}

export function runModelSelector(
  host: SlashCommandHost,
  modelDict: Record<string, ModelAlias>,
): Promise<{ alias: string; thinking: ThinkingEffort } | undefined> {
  return new Promise((resolve) => {
    const firstAlias = Object.keys(modelDict)[0] ?? '';
    const caps = modelDict[firstAlias]?.capabilities ?? [];
    const initialThinking = caps.includes('always_thinking') || caps.includes('thinking');
    const selector = new ModelSelectorComponent({
      models: modelDict,
      currentValue: firstAlias,
      currentThinkingEffort: initialThinking ? 'on' : 'off',
      searchable: true,
      onSelect: ({ alias, thinking }) => {
        host.restoreEditor();
        resolve({ alias, thinking });
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(selector);
  });
}
