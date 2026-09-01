import {
  applyCustomRegistryEntries,
  fetchCustomRegistry,
  type CustomRegistrySource,
  type ProviderDiscoveryConfigShape,
} from '@multiai/oauth';
import {
  applyCatalogProvider,
  catalogProviderModels,
  CatalogFetchError,
  DEFAULT_CATALOG_URL,
  fetchCatalog,
  resolveCatalogImport,
  type Catalog,
  type ThinkingEffort,
} from '@multiai/sdk';

import { createMultiAICliUserAgent } from '#/cli/version';
import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import {
  CustomRegistryImportDialogComponent,
  type CustomRegistryImportResult,
} from '../components/dialogs/custom-registry-import';
import {
  ProviderManagerComponent,
  type ProviderManagerOptions,
} from '../components/dialogs/provider-manager';
import { TabbedModelSelectorComponent } from '../components/dialogs/tabbed-model-selector';
import { DEFAULT_OAUTH_PROVIDER_NAME } from '../constant/multiai-tui';
import { t } from '../i18n';
import { formatErrorMessage } from '../utils/event-payload';
import { thinkingEffortToConfig } from '../utils/thinking-config';
import { effectiveModelForHost } from './config';
import {
  promptApiKey,
  promptBaseUrl,
  promptCatalogProviderSelection,
} from './prompts';
import type { SlashCommandHost } from './dispatch';

// ---------------------------------------------------------------------------
// /provider command
// ---------------------------------------------------------------------------

export async function handleProviderCommand(host: SlashCommandHost): Promise<void> {
  const options = buildProviderManagerOptions(host);
  const component = new ProviderManagerComponent(options);
  host.mountEditorReplacement(component);
}

function buildProviderManagerOptions(host: SlashCommandHost): ProviderManagerOptions {
  const activeProviderId =
    host.state.appState.availableModels[host.state.appState.model]?.provider;
  return {
    providers: host.state.appState.availableProviders,
    activeProviderId,
    onAdd: () => {
      void handleProviderAdd(host).catch((error: unknown) => {
        host.showError(t(`Add provider failed: ${formatErrorMessage(error)}`, `Не удалось добавить провайдера: ${formatErrorMessage(error)}`));
      });
    },
    onDeleteSource: (providerIds) => {
      void handleProviderManagerDeleteSource(host, providerIds).catch((error: unknown) => {
        host.showError(t(`Remove provider failed: ${formatErrorMessage(error)}`, `Не удалось удалить провайдера: ${formatErrorMessage(error)}`));
      });
    },
    onClose: () => {
      host.restoreEditor();
    },
  };
}

async function handleProviderManagerDeleteSource(
  host: SlashCommandHost,
  providerIds: readonly string[],
): Promise<void> {
  for (const providerId of providerIds) {
    try {
      await handleProviderDelete(host, providerId);
    } catch (error) {
      const msg = formatErrorMessage(error);
      host.showError(t(`Failed to delete provider ${providerId}: ${msg}`, `Не удалось удалить провайдера ${providerId}: ${msg}`));
    }
  }
  reopenProviderManager(host);
}

async function handleProviderDelete(host: SlashCommandHost, providerId: string): Promise<void> {
  if (providerId === DEFAULT_OAUTH_PROVIDER_NAME) {
    await host.harness.auth.logout();
    await host.authFlow.refreshConfigAfterLogout();
    await host.authFlow.clearActiveSessionAfterLogout();
    return;
  }

  const activeProvider =
    host.state.appState.availableModels[host.state.appState.model]?.provider;
  const config = await host.harness.removeProvider(providerId);
  if (activeProvider === providerId) {
    await host.authFlow.refreshConfigAfterLogout();
    await host.authFlow.clearActiveSessionAfterLogout();
  } else {
    host.setAppState({
      availableProviders: config.providers ?? {},
      availableModels: config.models ?? {},
    });
  }
}

async function handleProviderAdd(host: SlashCommandHost): Promise<void> {
  const source = await promptProviderAddSource(host);
  if (source === undefined) {
    reopenProviderManager(host);
    return;
  }

  if (source === 'known') {
    await handleCatalogProviderAdd(host);
    return;
  }
  const handled = await handleCustomRegistryAddViaDialog(host);
  if (!handled) {
    reopenProviderManager(host);
  }
}

function reopenProviderManager(host: SlashCommandHost): void {
  const options = buildProviderManagerOptions(host);
  const component = new ProviderManagerComponent(options);
  host.mountEditorReplacement(component);
}

function promptProviderAddSource(
  host: SlashCommandHost,
): Promise<'known' | 'custom' | undefined> {
  return new Promise((resolve) => {
    const picker = new ChoicePickerComponent({
      title: t('Add provider', 'Добавить провайдера'),
      options: [
        { value: 'known', label: t('Known third-party provider', 'Известный сторонний провайдер') },
        { value: 'custom', label: t('Custom registry (api.json)', 'Пользовательский реестр (api.json)') },
      ],
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value === 'known' || value === 'custom' ? value : undefined);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(picker);
  });
}

async function handleCatalogProviderAdd(host: SlashCommandHost): Promise<void> {
  const controller = new AbortController();
  const cancel = (): void => {
    controller.abort();
  };
  host.cancelInFlight = cancel;

  const spinner = host.showLoginProgressSpinner(t(`Fetching catalog from ${DEFAULT_CATALOG_URL}`, `Загрузка каталога с ${DEFAULT_CATALOG_URL}`));
  let catalog: Catalog | undefined;
  try {
    catalog = await fetchCatalog(DEFAULT_CATALOG_URL, {
      signal: controller.signal,
      userAgent: createMultiAICliUserAgent(),
    });
    spinner.stop({ ok: true, label: t('Catalog loaded.', 'Каталог загружен.') });
  } catch (error) {
    if (controller.signal.aborted) {
      spinner.stop({ ok: false, label: t('Aborted.', 'Отменено.') });
    } else {
      const hint = error instanceof CatalogFetchError ? ` (HTTP ${error.status})` : '';
      spinner.stop({ ok: false, label: t('Failed to load catalog.', 'Не удалось загрузить каталог.') });
      host.showError(t(`Failed to fetch catalog${hint}: ${formatErrorMessage(error)}`, `Не удалось загрузить каталог${hint}: ${formatErrorMessage(error)}`));
    }
  } finally {
    if (host.cancelInFlight === cancel) host.cancelInFlight = undefined;
  }

  if (catalog === undefined) return;

  const providerId = await promptCatalogProviderSelection(host, catalog);
  if (providerId === undefined) return;
  const entry = catalog[providerId];
  if (entry === undefined) return;

  const models = catalogProviderModels(entry);
  if (models.length === 0) {
    host.showError(t(`Provider "${providerId}" has no usable models in this catalog.`, `У провайдера "${providerId}" нет доступных моделей в этом каталоге.`));
    return;
  }

  let resolution = resolveCatalogImport(entry);
  if (resolution.kind === 'needs-base-url') {
    const entered = await promptBaseUrl(host, entry.name ?? providerId);
    if (entered === undefined) return;
    resolution = resolveCatalogImport(entry, entered);
  }
  if (resolution.kind !== 'ok') {
    if (resolution.kind === 'invalid') {
      if (resolution.reason === 'unknown-explicit-type') {
        host.showError(
          t(`Provider "${providerId}" declares protocol "${entry.type}" in the catalog, which this client version does not support.`, `Провайдер "${providerId}" использует протокол "${entry.type}" из каталога, который не поддерживается этой версией клиента.`),
        );
      } else if (resolution.reason === 'proprietary-sdk') {
        host.showError(
          t(`Provider "${providerId}" uses a proprietary SDK this client cannot speak (e.g. Amazon Bedrock or Cohere); it cannot be imported from the catalog.`, `Провайдер "${providerId}" использует проприетарный SDK, который клиент не поддерживает (например, Amazon Bedrock или Cohere), поэтому импорт из каталога невозможен.`),
        );
      } else {
        host.showError(
          t('Base URL contains an env placeholder or is empty. Enter the resolved URL instead.', 'Базовый URL содержит переменную окружения или пуст. Введите полный URL.'),
        );
      }
    }
    return;
  }
  const { wire, baseUrl } = resolution;

  const apiKey = await promptApiKey(host, entry.name ?? providerId);
  if (apiKey === undefined) return;

  // Persist the provider and all its models immediately after the api key is
  // entered. The model selector that follows is just a convenience to pick the
  // default model; ESC leaves the provider in place without a default selection.
  const existingConfig = await host.harness.getConfig();
  if (existingConfig.providers[providerId] !== undefined) {
    await host.harness.removeProvider(providerId);
  }

  const config = await host.harness.getConfig();
  applyCatalogProvider(config, {
    providerId,
    wire,
    baseUrl,
    apiKey,
    models,
    selectedModelId: '', // no default yet; user picks in the model selector
    thinking: false,    // will be resolved by the model selector
  });

  await host.harness.setConfig({
    providers: config.providers,
    models: config.models,
  });

  await host.authFlow.refreshConfigAfterLogin();
  host.track('connect', { provider: providerId, method: 'catalog' });
  host.showStatus(t(`Provider added: ${entry.name ?? providerId}`, `Провайдер добавлен: ${entry.name ?? providerId}`));
  if (resolution.guessed) {
    host.showStatus(
      t(`Protocol guessed as "openai" for ${providerId} — edit "type" in config.toml if requests fail.`, `Для ${providerId} выбран протокол "openai" — если запросы не работают, измените "type" в config.toml.`),
    );
  }

  // Build a merged model dictionary that includes existing models plus the
  // newly-persisted provider's models, so the tabbed selector shows every
  // provider's tab (the new provider's tab starts active via initialTabId).
  const stateModels = await host.harness.getConfig().then((c) => c.models ?? {});
  const mergedModels = { ...stateModels };

  const selector = new TabbedModelSelectorComponent({
    models: mergedModels,
    currentValue: host.state.appState.model,
    selectedValue: Object.keys(mergedModels).find((a) => a.startsWith(`${providerId}/`)),
    currentThinkingEffort: host.state.appState.thinkingEffort,
    initialTabId: providerId,
    onSelect: ({ alias, thinking }) => {
      host.restoreEditor();
      void setDefaultModel(host, alias, thinking).catch((error: unknown) => {
        host.showError(t(`Set default model failed: ${formatErrorMessage(error)}`, `Не удалось задать модель по умолчанию: ${formatErrorMessage(error)}`));
      });
    },
    onCancel: () => {
      host.restoreEditor();
    },
  });
  host.mountEditorReplacement(selector);
}

async function setDefaultModel(
  host: SlashCommandHost,
  alias: string,
  effort: ThinkingEffort,
): Promise<void> {
  // Resolve efforts the same way the /model path does (effectiveModelForHost
  // applies overrides and the protocol-profile inference): catalog entries for
  // e.g. Anthropic models declare no support_efforts on the alias, and without
  // the inference a top-tier pick would slip through as a persisted effort.
  const model = host.state.appState.availableModels[alias];
  await host.harness.setConfig({
    defaultModel: alias,
    thinking: thinkingEffortToConfig(
      effort,
      model === undefined ? undefined : effectiveModelForHost(host, model).supportEfforts,
    ),
  });
  await host.authFlow.refreshConfigAfterLogin();
  host.track('model_switch', { model: alias });
  host.showStatus(t(`Default model set to ${alias} with thinking ${effort}.`, `Модель по умолчанию изменена на ${alias}, уровень рассуждений: ${effort}.`));
}

async function handleCustomRegistryAddViaDialog(host: SlashCommandHost): Promise<boolean> {
  const value = await promptCustomRegistryImport(host);
  if (value === undefined) return false;

  const source: CustomRegistrySource = {
    kind: 'apiJson',
    url: value.url,
    apiKey: value.apiKey,
  };

  let entries: Awaited<ReturnType<typeof fetchCustomRegistry>>;
  try {
    entries = await fetchCustomRegistry(source, { userAgent: createMultiAICliUserAgent() });
  } catch (error) {
    host.showError(t(`Failed to import registry: ${formatErrorMessage(error)}`, `Не удалось импортировать реестр: ${formatErrorMessage(error)}`));
    return false;
  }

  const addedProviderIds = Object.values(entries).map((entry) => entry.id);
  try {
    const config = await host.harness.getConfig();
    applyCustomRegistryEntries(
      config as unknown as ProviderDiscoveryConfigShape,
      entries,
      source,
    );
    await host.harness.setConfig({
      providers: config.providers,
      models: config.models,
    });
    await host.authFlow.refreshConfigAfterLogin();
  } catch (error) {
    host.showError(t(`Failed to apply registry: ${formatErrorMessage(error)}`, `Не удалось применить реестр: ${formatErrorMessage(error)}`));
    return false;
  }

  const count = addedProviderIds.length;
  if (count === 0) {
    host.showStatus(t('Registry contained no providers.', 'Реестр не содержит провайдеров.'));
    return false;
  }
  host.showStatus(
    count === 1
      ? t('Imported 1 provider from registry.', 'Из реестра импортирован 1 провайдер.')
      : t(`Imported ${String(count)} providers from registry.`, `Из реестра импортировано провайдеров: ${String(count)}.`),
    'success',
  );

  // Offer the model selector so the user can pick a default, just like the
  // catalog (known-provider) flow.
  const stateModels = await host.harness.getConfig().then((c) => c.models ?? {});
  const firstNewAlias = Object.keys(stateModels).find((a) =>
    addedProviderIds.some((pid) => a.startsWith(`${pid}/`)),
  );
  const firstNewProvider = firstNewAlias
    ? stateModels[firstNewAlias]?.provider
    : addedProviderIds[0];
  const selector = new TabbedModelSelectorComponent({
    models: stateModels,
    currentValue: host.state.appState.model,
    selectedValue: firstNewAlias,
    currentThinkingEffort: host.state.appState.thinkingEffort,
    initialTabId: firstNewProvider,
    onSelect: ({ alias, thinking }) => {
      host.restoreEditor();
      void setDefaultModel(host, alias, thinking).catch((error: unknown) => {
        host.showError(t(`Set default model failed: ${formatErrorMessage(error)}`, `Не удалось задать модель по умолчанию: ${formatErrorMessage(error)}`));
      });
    },
    onCancel: () => {
      host.restoreEditor();
    },
  });
  host.mountEditorReplacement(selector);
  return true;
}

function promptCustomRegistryImport(
  host: SlashCommandHost,
): Promise<{ readonly url: string; readonly apiKey: string } | undefined> {
  return new Promise((resolve) => {
    const dialog = new CustomRegistryImportDialogComponent(
      (result: CustomRegistryImportResult) => {
        host.restoreEditor();
        resolve(result.kind === 'ok' ? result.value : undefined);
      },
    );
    host.mountEditorReplacement(dialog);
  });
}
