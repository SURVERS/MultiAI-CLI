/**
 * `multiai provider` sub-command — non-interactive provider management.
 *
 * Mirrors the TUI `/provider` flow (apps/multiai-cli/src/tui/commands/provider.ts)
 * for the custom-registry path so users can import an api.json document, drop
 * a provider, or inspect what is configured without launching the TUI.
 *
 * `add` writes the same `source = { kind: 'apiJson', url, apiKey }` blob the
 * TUI does; the next launch's `refreshAllProviderModels`
 * (apps/multiai-cli/src/tui/utils/refresh-providers.ts) groups by URL, retries
 * available API-key candidates, and re-fetches the model list, so periodic
 * refresh is automatic.
 */

import {
  applyCustomRegistryProvider,
  CustomRegistryApiError,
  fetchCustomRegistry,
  type CustomRegistrySource,
  type ProviderDiscoveryConfigShape,
} from '@multiai/oauth';
import {
  applyCatalogProvider,
  catalogProviderModels,
  CatalogFetchError,
  createMultiAIHarness,
  DEFAULT_CATALOG_URL,
  fetchCatalog,
  resolveCatalogImport,
  type Catalog,
  type CatalogProviderEntry,
  type MultiAIConfig,
  type MultiAIHarness,
} from '@multiai/sdk';
import type { Command } from 'commander';

import { createMultiAIHostIdentity, createMultiAICliUserAgent } from '#/cli/version';
import { t } from '#/tui/i18n';

interface WritableLike {
  write(chunk: string): boolean;
}

export interface ProviderDeps {
  readonly getHarness: () => MultiAIHarness;
  readonly stdout: WritableLike;
  readonly stderr: WritableLike;
  readonly env: NodeJS.ProcessEnv;
  readonly exit: (code: number) => never;
}

interface AddOptions {
  readonly apiKey?: string;
}

interface ListOptions {
  readonly json: boolean;
}

interface CatalogListOptions {
  readonly json: boolean;
  readonly filter?: string;
  readonly url?: string;
}

interface CatalogAddOptions {
  readonly apiKey?: string;
  readonly defaultModel?: string;
  readonly url?: string;
  readonly baseUrl?: string;
}

export async function handleProviderAdd(
  deps: ProviderDeps,
  url: string,
  opts: AddOptions,
): Promise<void> {
  const apiKey = resolveApiKey(opts.apiKey, deps.env);
  if (apiKey === undefined) {
    deps.stderr.write(
      `${t('Missing API key. Pass --api-key <key> or set MULTIAI_REGISTRY_API_KEY.', 'Отсутствует API-ключ. Передайте --api-key <key> или задайте MULTIAI_REGISTRY_API_KEY.')}\n`,
    );
    deps.exit(1);
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    deps.stderr.write(`${t('Registry URL is required.', 'Необходимо указать URL реестра.')}\n`);
    deps.exit(1);
  }

  const source: CustomRegistrySource = {
    kind: 'apiJson',
    url: trimmedUrl,
    apiKey,
  };

  const harness = deps.getHarness();
  await harness.ensureConfigFile();

  let entries: Awaited<ReturnType<typeof fetchCustomRegistry>>;
  try {
    entries = await fetchCustomRegistry(source, { userAgent: createMultiAICliUserAgent() });
  } catch (error) {
    const suffix = error instanceof CustomRegistryApiError ? ` (HTTP ${String(error.status)})` : '';
    deps.stderr.write(`${t(`Failed to fetch registry${suffix}:`, `Не удалось загрузить реестр${suffix}:`)} ${errorMessage(error)}\n`);
    deps.exit(1);
  }

  const entryList = Object.values(entries);
  if (entryList.length === 0) {
    deps.stderr.write(`${t(`Registry at ${trimmedUrl} contained no usable providers.`, `Реестр по адресу ${trimmedUrl} не содержит подходящих провайдеров.`)}\n`);
    deps.exit(1);
  }

  // `harness.removeProvider` reloads the config from disk on each call (see
  // `core-impl.ts removeProvider`), so calling it inside the apply loop
  // would discard providers we already applied in memory but have not yet
  // persisted. Drop every stale id up front in a single batch instead, then
  // apply against the resulting fresh config.
  let config = await harness.getConfig();
  const staleIds = entryList
    .filter((entry) => config.providers[entry.id] !== undefined)
    .map((entry) => entry.id);
  for (const id of staleIds) {
    config = await harness.removeProvider(id);
  }

  const addedProviderIds: string[] = [];
  let modelCount = 0;
  for (const entry of entryList) {
    applyCustomRegistryProvider(asManaged(config), entry, source);
    addedProviderIds.push(entry.id);
    modelCount += Object.keys(entry.models).length;
  }

  await harness.setConfig({
    providers: config.providers,
    models: config.models,
  });

  deps.stdout.write(
    `${t(
      `Imported ${String(addedProviderIds.length)} provider${addedProviderIds.length === 1 ? '' : 's'} (${String(modelCount)} model${modelCount === 1 ? '' : 's'}) from ${trimmedUrl}:`,
      `Импортировано провайдеров: ${String(addedProviderIds.length)} (моделей: ${String(modelCount)}) из ${trimmedUrl}:`,
    )}\n`,
  );
  for (const id of addedProviderIds) {
    deps.stdout.write(`  - ${id}\n`);
  }
}

export async function handleProviderRemove(
  deps: ProviderDeps,
  providerId: string,
): Promise<void> {
  const harness = deps.getHarness();
  await harness.ensureConfigFile();
  const config = await harness.getConfig();
  if (config.providers[providerId] === undefined) {
    deps.stderr.write(`${t(`Provider "${providerId}" not found.`, `Провайдер «${providerId}» не найден.`)}\n`);
    deps.exit(1);
  }
  await harness.removeProvider(providerId);
  deps.stdout.write(`${t(`Removed provider "${providerId}".`, `Провайдер «${providerId}» удалён.`)}\n`);
}

export async function handleProviderList(
  deps: ProviderDeps,
  opts: ListOptions,
): Promise<void> {
  const harness = deps.getHarness();
  await harness.ensureConfigFile();
  const config = await harness.getConfig();

  if (opts.json) {
    deps.stdout.write(
      `${JSON.stringify({ providers: config.providers, models: config.models ?? {} }, null, 2)}\n`,
    );
    return;
  }

  const modelsByProvider = new Map<string, string[]>();
  for (const [alias, model] of Object.entries(config.models ?? {})) {
    const list = modelsByProvider.get(model.provider) ?? [];
    list.push(alias);
    modelsByProvider.set(model.provider, list);
  }

  const providerIds = Object.keys(config.providers).toSorted();
  if (providerIds.length === 0) {
    deps.stdout.write(`${t('No providers configured.', 'Провайдеры не настроены.')}\n`);
    return;
  }

  for (const id of providerIds) {
    const provider = config.providers[id]!;
    const aliases = modelsByProvider.get(id) ?? [];
    const sourceLabel = providerSourceLabel(provider);
    deps.stdout.write(
      `${id}  type=${provider.type}  models=${String(aliases.length)}  source=${sourceLabel}\n`,
    );
  }
  if (config.defaultModel !== undefined) {
    deps.stdout.write(`\n${t('Default model:', 'Модель по умолчанию:')} ${config.defaultModel}\n`);
  }
}

/**
 * Fetches the models.dev-style public catalog and lists providers, or — when
 * `providerId` is given — drills into one provider and lists its models. This
 * mirrors the discovery half of the TUI "Known third-party provider" flow.
 */
export async function handleCatalogList(
  deps: ProviderDeps,
  providerId: string | undefined,
  opts: CatalogListOptions,
): Promise<void> {
  const url = opts.url ?? DEFAULT_CATALOG_URL;
  const catalog = await loadCatalogOrExit(deps, url);

  if (providerId !== undefined) {
    const entry = catalog[providerId];
    if (entry === undefined) {
      deps.stderr.write(`${t(`Provider "${providerId}" not found in catalog at ${url}.`, `Провайдер «${providerId}» не найден в каталоге по адресу ${url}.`)}\n`);
      deps.exit(1);
    }
    const models = catalogProviderModels(entry);
    if (opts.json) {
      deps.stdout.write(
        `${JSON.stringify({ providerId, name: entry.name ?? providerId, models }, null, 2)}\n`,
      );
      return;
    }
    if (models.length === 0) {
      deps.stdout.write(`${t(`Provider "${providerId}" lists no usable models in this catalog.`, `У провайдера «${providerId}» нет подходящих моделей в этом каталоге.`)}\n`);
      return;
    }
    deps.stdout.write(`${entry.name ?? providerId} (${providerId})\n`);
    for (const model of models) {
      const cap: string[] = [];
      if (model.capability.tool_use) cap.push('tool_use');
      if (model.capability.thinking) cap.push('thinking');
      if (model.capability.image_in) cap.push('image_in');
      const ctx =
        typeof model.capability.max_context_tokens === 'number'
          ? String(model.capability.max_context_tokens)
          : '?';
      const capLabel = cap.length > 0 ? ` [${cap.join(',')}]` : '';
      deps.stdout.write(`  ${model.id}  ctx=${ctx}${capLabel}\n`);
    }
    return;
  }

  const filter = opts.filter?.toLowerCase();
  const entries = Object.entries(catalog)
    .filter(([id, entry]) => {
      if (filter === undefined) return true;
      const haystack = `${id} ${entry.name ?? ''}`.toLowerCase();
      return haystack.includes(filter);
    })
    .toSorted(([a], [b]) => a.localeCompare(b));

  if (opts.json) {
    const out: Record<string, CatalogProviderEntry> = {};
    for (const [id, entry] of entries) out[id] = entry;
    deps.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  }

  if (entries.length === 0) {
    if (filter !== undefined) {
      deps.stdout.write(`${t(`No providers in catalog match "${filter}".`, `В каталоге нет провайдеров, соответствующих «${filter}».`)}\n`);
    } else {
      deps.stdout.write(`${t('Catalog is empty.', 'Каталог пуст.')}\n`);
    }
    return;
  }

  for (const [id, entry] of entries) {
    const modelCount = entry.models === undefined ? 0 : Object.keys(entry.models).length;
    const resolution = resolveCatalogImport(entry);
    const wireLabel =
      resolution.kind === 'invalid'
        ? '?'
        : resolution.guessed
          ? `${resolution.wire} (guessed)`
          : resolution.wire;
    deps.stdout.write(
      `${id}  wire=${wireLabel}  models=${String(modelCount)}  ${entry.name ?? ''}\n`,
    );
  }
}

/**
 * Imports a known provider from the models.dev catalog by id. Unlike
 * `provider add` (which expects a custom api.json), this command relies on
 * the catalog's normalized metadata to fill in context limits and capabilities.
 */
export async function handleCatalogAdd(
  deps: ProviderDeps,
  providerId: string,
  opts: CatalogAddOptions,
): Promise<void> {
  const apiKey = resolveApiKey(opts.apiKey, deps.env);
  if (apiKey === undefined) {
    deps.stderr.write(
      `${t('Missing API key. Pass --api-key <key> or set MULTIAI_REGISTRY_API_KEY.', 'Отсутствует API-ключ. Передайте --api-key <key> или задайте MULTIAI_REGISTRY_API_KEY.')}\n`,
    );
    deps.exit(1);
  }

  const url = opts.url ?? DEFAULT_CATALOG_URL;
  const catalog = await loadCatalogOrExit(deps, url);

  const entry = catalog[providerId];
  if (entry === undefined) {
    deps.stderr.write(`${t(`Provider "${providerId}" not found in catalog at ${url}.`, `Провайдер «${providerId}» не найден в каталоге по адресу ${url}.`)}\n`);
    deps.exit(1);
  }

  const resolution = resolveCatalogImport(entry, opts.baseUrl);
  if (resolution.kind === 'invalid') {
    switch (resolution.reason) {
      case 'unknown-explicit-type':
        deps.stderr.write(
          `Provider "${providerId}" declares protocol "${entry.type}" in the catalog, which this client version does not support.\n`,
        );
        break;
      case 'proprietary-sdk':
        deps.stderr.write(
          `Provider "${providerId}" uses a proprietary SDK this client cannot speak (e.g. Amazon Bedrock or Cohere); it cannot be imported from the catalog.\n`,
        );
        break;
      case 'empty-base-url':
        deps.stderr.write(`${t('--base-url cannot be empty.', '--base-url не может быть пустым.')}\n`);
        break;
      case 'placeholder-base-url':
        deps.stderr.write(
          `Base URL "${opts.baseUrl}" contains an env placeholder. Pass --base-url with the resolved value.\n`,
        );
        break;
    }
    deps.exit(1);
  }
  if (resolution.kind === 'needs-base-url') {
    deps.stderr.write(
      `The catalog does not declare an endpoint for "${providerId}". Pass --base-url <url> (e.g. the vendor's OpenAI-compatible base URL).\n`,
    );
    deps.exit(1);
  }
  const { wire, baseUrl } = resolution;

  const models = catalogProviderModels(entry);
  if (models.length === 0) {
    deps.stderr.write(`${t(`Provider "${providerId}" lists no usable models in this catalog.`, `У провайдера «${providerId}» нет подходящих моделей в этом каталоге.`)}\n`);
    deps.exit(1);
  }

  if (opts.defaultModel !== undefined && !models.some((m) => m.id === opts.defaultModel)) {
    deps.stderr.write(
      `Model "${opts.defaultModel}" is not in provider "${providerId}". Run "multiai provider catalog list ${providerId}" to see available ids.\n`,
    );
    deps.exit(1);
  }

  const harness = deps.getHarness();
  await harness.ensureConfigFile();

  let config = await harness.getConfig();

  // Capture defaults BEFORE `removeProvider`, because that call clears
  // `defaultModel` when it points at one of this provider's aliases (see
  // `core-impl.ts removeProvider`). Without this, re-importing an
  // already-configured provider would lose the user's previously-set default
  // even when `--default-model` is not supplied.
  const previousDefaultModel = config.defaultModel;
  const previousThinking = config.thinking;

  if (config.providers[providerId] !== undefined) {
    config = await harness.removeProvider(providerId);
  }

  // `applyCatalogProvider` always overwrites both `defaultModel` and
  // `[thinking]`. The values we pass here are temporary; we restore
  // a consistent state in the post-apply block below.
  applyCatalogProvider(config, {
    providerId,
    wire,
    ...(baseUrl === undefined ? {} : { baseUrl }),
    apiKey,
    models,
    selectedModelId: opts.defaultModel ?? '',
    thinking: false,
  });

  // Resolve the final `defaultModel`:
  //   - If the caller asked for one, `applyCatalogProvider` already set it.
  //   - Else, restore the previous default ONLY when its alias still resolves
  //     after the catalog refresh; the catalog may have dropped the old
  //     model, in which case restoring would point default_model at a
  //     non-existent alias and break the next session.
  if (opts.defaultModel === undefined) {
    const stillResolves =
      previousDefaultModel !== undefined &&
      config.models?.[previousDefaultModel] !== undefined;
    config.defaultModel = stillResolves ? previousDefaultModel : undefined;
  }

  // Always restore `[thinking]` from what was there before — including
  // `undefined`. Persisting `enabled: false` when the user never set it would
  // make `resolveThinkingEffort` (agent-core/src/agent/config/thinking.ts) treat
  // it as an explicit "off" request and silently disable thinking, even for
  // thinking-capable models.
  config.thinking = previousThinking;

  await harness.setConfig({
    providers: config.providers,
    models: config.models,
    defaultModel: config.defaultModel,
    thinking: config.thinking,
  });

  const displayName = entry.name ?? providerId;
  deps.stdout.write(
    `Imported ${displayName} (${providerId}) with ${String(models.length)} model${models.length === 1 ? '' : 's'} from ${url}.\n`,
  );
  if (resolution.guessed) {
    deps.stdout.write(
      `Note: the catalog does not declare a protocol for "${providerId}"; guessed "openai". Edit "type" in config.toml if requests fail.\n`,
    );
  }
  if (opts.defaultModel !== undefined) {
    deps.stdout.write(`${t(`Default model set to ${providerId}/${opts.defaultModel}.`, `Модель по умолчанию установлена: ${providerId}/${opts.defaultModel}.`)}\n`);
  }
}

async function loadCatalogOrExit(deps: ProviderDeps, url: string): Promise<Catalog> {
  try {
    return await fetchCatalog(url, { userAgent: createMultiAICliUserAgent() });
  } catch (error) {
    const suffix = error instanceof CatalogFetchError ? ` (HTTP ${String(error.status)})` : '';
    deps.stderr.write(`${t(`Failed to fetch catalog from ${url}${suffix}:`, `Не удалось загрузить каталог по адресу ${url}${suffix}:`)} ${errorMessage(error)}\n`);
    deps.exit(1);
  }
}

export function registerProviderCommand(parent: Command, deps?: Partial<ProviderDeps>): void {
  const provider = parent
    .command('provider')
    .description(t('Manage LLM providers non-interactively.', 'Управление провайдерами LLM без интерактивного режима.'));

  // Last-resort boundary: handlers report expected failures themselves, but
  // anything that escapes (e.g. a config write rejected because config.toml
  // is invalid) must end as a one-line error + exit 1, not an unhandled
  // rejection dumping a stack trace.
  const runAction = async (resolved: ProviderDeps, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      resolved.stderr.write(`${errorMessage(error)}\n`);
      resolved.exit(1);
    }
  };

  provider
    .command('add <url>')
    .description(t('Import every provider listed in a custom registry (api.json).', 'Импортировать всех провайдеров из пользовательского реестра (api.json).'))
    .option('--api-key <key>', t('Registry API key. Falls back to MULTIAI_REGISTRY_API_KEY.', 'API-ключ реестра. Если не указан, используется MULTIAI_REGISTRY_API_KEY.'))
    .action(async (url: string, options: { apiKey?: string }) => {
      const resolved = resolveDeps(deps);
      await runAction(resolved, () => handleProviderAdd(resolved, url, { apiKey: options.apiKey }));
    });

  provider
    .command('remove <providerId>')
    .description(t('Remove a provider and every model alias that referenced it.', 'Удалить провайдера и все связанные с ним псевдонимы моделей.'))
    .action(async (providerId: string) => {
      const resolved = resolveDeps(deps);
      await runAction(resolved, () => handleProviderRemove(resolved, providerId));
    });

  provider
    .command('list')
    .description(t('Show configured providers and their model counts.', 'Показать настроенных провайдеров и количество их моделей.'))
    .option('--json', t('Emit the raw providers/models config as JSON.', 'Вывести исходную конфигурацию провайдеров и моделей в формате JSON.'), false)
    .action(async (options: { json?: boolean }) => {
      const resolved = resolveDeps(deps);
      await runAction(resolved, () => handleProviderList(resolved, { json: options.json === true }));
    });

  const catalog = provider
    .command('catalog')
    .description(t('Discover and import providers from the public models.dev catalog.', 'Поиск и импорт провайдеров из публичного каталога models.dev.'));

  catalog
    .command('list [providerId]')
    .description(t('List providers in the catalog, or models when a providerId is given.', 'Показать провайдеров каталога или модели, если указан providerId.'))
    .option('--filter <substring>', t('Case-insensitive id/name substring filter.', 'Фильтр по подстроке ID или имени без учёта регистра.'))
    .option('--url <url>', t(`Override catalog URL. Defaults to ${DEFAULT_CATALOG_URL}.`, `Переопределить URL каталога. По умолчанию: ${DEFAULT_CATALOG_URL}.`))
    .option('--json', t('Emit the matching catalog slice as JSON.', 'Вывести подходящую часть каталога в формате JSON.'), false)
    .action(
      async (
        providerId: string | undefined,
        options: { filter?: string; url?: string; json?: boolean },
      ) => {
        const resolved = resolveDeps(deps);
        await runAction(resolved, () =>
          handleCatalogList(resolved, providerId, {
            json: options.json === true,
            ...(options.filter === undefined ? {} : { filter: options.filter }),
            ...(options.url === undefined ? {} : { url: options.url }),
          }),
        );
      },
    );

  catalog
    .command('add <providerId>')
    .description(t('Import a known provider from the catalog by id.', 'Импортировать известного провайдера из каталога по ID.'))
    .option('--api-key <key>', t('API key for the provider. Falls back to MULTIAI_REGISTRY_API_KEY.', 'API-ключ провайдера. Если не указан, используется MULTIAI_REGISTRY_API_KEY.'))
    .option('--default-model <modelId>', t('Mark the imported model as default_model after import.', 'После импорта назначить импортированную модель как default_model.'))
    .option(
      '--base-url <url>',
      t('Override the catalog endpoint. Required when the catalog declares none (or an env placeholder).', 'Переопределить адрес API из каталога. Обязательно, если адрес не указан или задан переменной окружения.'),
    )
    .option('--url <url>', t(`Override catalog URL. Defaults to ${DEFAULT_CATALOG_URL}.`, `Переопределить URL каталога. По умолчанию: ${DEFAULT_CATALOG_URL}.`))
    .action(
      async (
        providerId: string,
        options: { apiKey?: string; defaultModel?: string; url?: string; baseUrl?: string },
      ) => {
        const resolved = resolveDeps(deps);
        await runAction(resolved, () =>
          handleCatalogAdd(resolved, providerId, {
            ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
            ...(options.defaultModel === undefined ? {} : { defaultModel: options.defaultModel }),
            ...(options.url === undefined ? {} : { url: options.url }),
            ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
          }),
        );
      },
    );
}

function resolveDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  let harness: MultiAIHarness | undefined;
  const identity = createMultiAIHostIdentity();
  return {
    getHarness:
      overrides.getHarness ??
      (() => {
        harness ??= createMultiAIHarness({ identity });
        return harness;
      }),
    stdout: overrides.stdout ?? process.stdout,
    stderr: overrides.stderr ?? process.stderr,
    env: overrides.env ?? process.env,
    exit: overrides.exit ?? ((code: number) => process.exit(code)),
  };
}

function resolveApiKey(flag: string | undefined, env: NodeJS.ProcessEnv): string | undefined {
  if (typeof flag === 'string' && flag.length > 0) return flag;
  const fromEnv = env['MULTIAI_REGISTRY_API_KEY'];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return undefined;
}

function asManaged(config: MultiAIConfig): ProviderDiscoveryConfigShape {
  return config as unknown as ProviderDiscoveryConfigShape;
}

function providerSourceLabel(provider: MultiAIConfig['providers'][string]): string {
  const source = provider.source;
  if (source !== undefined) {
    if (source['kind'] === 'apiJson' && typeof source['url'] === 'string') {
      return `apiJson(${source['url']})`;
    }
  }
  if (provider.oauth !== undefined) return 'oauth';
  return 'inline';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
