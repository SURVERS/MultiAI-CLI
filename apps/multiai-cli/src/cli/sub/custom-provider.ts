/**
 * `multiai provider set` — direct custom-provider registration.
 *
 * Оба wire-формата: OpenAI-совместимый (`chat/completions`) и Anthropic
 * (`/v1/messages`). В отличие от `catalog add` (импорт из models.dev) здесь
 * пользователь приносит свой endpoint + ключ, а метаданные моделей добираются
 * автоматически: сначала из ответа провайдера `GET /v1/models`
 * (context_length / max_output_tokens / modalities / reasoning), затем —
 * только недостающие поля — из models.dev (тот же enrichment, что на
 * ПК-версии IDE). Модели без метаданных получают pretty-имя из id.
 */

const FETCH_TIMEOUT_MS = 20_000;
const MODELS_DEV_URL = 'https://models.dev/api.json';

export type CustomWire = 'openai' | 'anthropic';

export interface CustomProviderMeta {
	displayName?: string;
	maxContextSize?: number;
	maxOutputSize?: number;
	inputModalities?: string[];
	reasoningKey?: string;
	supportEfforts?: string[];
	defaultEffort?: string;
}

export interface CustomAliasFields {
	displayName?: string;
	maxContextSize?: number;
	maxOutputSize?: number;
	capabilities?: string[];
	reasoningKey?: string;
	supportEfforts?: string[];
	defaultEffort?: string;
}

export interface CustomProviderPlan {
	readonly providerId: string;
	readonly wire: CustomWire;
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly aliases: Record<string, CustomAliasFields>;
	readonly enrichedCount: number;
}

function toFiniteInt(value: unknown): number | undefined {
	const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
	return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = value
		.map((x) => String(x ?? '').trim().toLowerCase())
		.filter((x) => x.length > 0);
	return out.length > 0 ? out : undefined;
}

function prettyModelName(id: string): string {
	return id.replace(/[_-]+/g, ' ').replace(/(^|\s)([a-z])/g, (_, s: string, c: string) => s + c.toUpperCase());
}

/** models.dev lookup: modelId (lowercase) → meta. Первый встреченный выигрывает. */
export async function fetchModelsDevLookup(): Promise<Map<string, CustomProviderMeta>> {
	const lookup = new Map<string, CustomProviderMeta>();
	try {
		const resp = await fetch(MODELS_DEV_URL, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!resp.ok) return lookup;
		const payload = (await resp.json()) as Record<string, { models?: Record<string, Record<string, unknown>> }>;
		for (const provider of Object.values(payload)) {
		for (const [key, model] of Object.entries(provider.models ?? {})) {
			const id = String(model['id'] ?? key).trim().toLowerCase();
			if (!id || lookup.has(id)) continue;
			const limit = (model['limit'] ?? {}) as Record<string, unknown>;
			const modalities = (model['modalities'] ?? {}) as Record<string, unknown>;
			lookup.set(id, {
				displayName: typeof model['name'] === 'string' && model['name'] ? model['name'] : undefined,
				maxContextSize: toFiniteInt(limit['context']),
				maxOutputSize: toFiniteInt(limit['output']),
				inputModalities: toStringArray(modalities['input']),
			});
		}
		}
	} catch {
		// models.dev недоступен — enrichment пропускается, это не ошибка.
	}
	return lookup;
}

/** Тянет `GET <base>/v1/models` провайдера и парсит метаданные (ПК-стиль). */
export async function fetchProviderOwnMeta(
	baseUrl: string,
	apiKey: string,
	wire: CustomWire,
): Promise<Map<string, CustomProviderMeta>> {
	const lookup = new Map<string, CustomProviderMeta>();
	const base = baseUrl.trim().replace(/\/+$/, '');
	const versioned = /\/v\d+(?:beta)?$/i.test(base) ? base : `${base}/v1`;
	const url = `${versioned}/models`;
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (wire === 'anthropic') {
		headers['x-api-key'] = apiKey;
		headers['anthropic-version'] = '2023-06-01';
	} else {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}
	try {
		const resp = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (!resp.ok) return lookup;
		const payload = (await resp.json()) as { data?: unknown; models?: unknown };
		const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
		for (const row of rows) {
			if (!row || typeof row !== 'object') continue;
			const ext = row as Record<string, unknown>;
			const id = String(ext['id'] ?? ext['name'] ?? '').trim();
			if (!id || lookup.has(id.toLowerCase())) continue;
			const contextWindow =
				toFiniteInt(ext['context_length']) ??
				toFiniteInt(ext['context_window']) ??
				toFiniteInt(ext['max_context_tokens']);
			const maxOutput =
				toFiniteInt(ext['max_output_tokens']) ??
				toFiniteInt(ext['max_output_length']) ??
				toFiniteInt(ext['max_completion_tokens']);
			const ssp = toStringArray(ext['supported_sampling_parameters']) ?? [];
			const sp = toStringArray(ext['supported_parameters']) ?? [];
			let supportEfforts: string[] | undefined;
			let reasoningKey: string | undefined;
			if (ssp.includes('reasoning_effort') || sp.includes('reasoning_effort')) {
				supportEfforts = ['low', 'medium', 'high'];
				reasoningKey = 'effort';
			}
			const reasoning = ext['reasoning'];
			if (reasoning && typeof reasoning === 'object') {
				const r = reasoning as Record<string, unknown>;
				const levels = toStringArray(r['levels'] ?? r['efforts'] ?? r['supported_efforts']);
				if (levels) {
					supportEfforts = levels;
					reasoningKey = 'effort';
				}
			}
			const arch = ext['architecture'] as Record<string, unknown> | undefined;
			const inputModalities =
				toStringArray(ext['input_modalities']) ?? (arch ? toStringArray(arch['input_modalities']) : undefined);
			lookup.set(id.toLowerCase(), {
				displayName:
					typeof ext['name'] === 'string' && ext['name'] && ext['name'] !== id ? ext['name'] : undefined,
				maxContextSize: contextWindow,
				maxOutputSize: maxOutput,
				inputModalities,
				reasoningKey,
				supportEfforts,
			});
		}
	} catch {
		// Провайдер не отдал каталог — работаем через models.dev/дефолты.
	}
	return lookup;
}

/** Мерджи мету: поля провайдера приоритетнее models.dev; недостающее — добирается. */
export function mergeMeta(
	primary: CustomProviderMeta | undefined,
	fallback: CustomProviderMeta | undefined,
): CustomAliasFields {
	const out: CustomAliasFields = {};
	const pick = <K extends keyof CustomProviderMeta>(key: K): CustomProviderMeta[K] => primary?.[key] ?? fallback?.[key];
	const displayName = pick('displayName');
	if (displayName) out.displayName = displayName;
	const ctx = pick('maxContextSize');
	if (ctx) out.maxContextSize = ctx;
	const outTok = pick('maxOutputSize');
	if (outTok) out.maxOutputSize = outTok;
	const mods = pick('inputModalities');
	if (mods) {
		const caps: string[] = [];
		if (mods.includes('image')) caps.push('image_in');
		if (mods.includes('video')) caps.push('video_in');
		if (mods.includes('audio')) caps.push('audio_in');
		if (caps.length > 0) out.capabilities = caps;
	}
	const efforts = pick('supportEfforts');
	if (efforts) {
		out.supportEfforts = efforts;
		out.reasoningKey = pick('reasoningKey') ?? 'effort';
		out.defaultEffort = pick('defaultEffort') ?? (efforts.includes('medium') ? 'medium' : efforts[0]);
	}
	return out;
}

/**
 * Собирает план прямого добавления провайдера: список моделей = объединение id
 * из ответа провайдера и переданных --model; метаданные мерджатся
 * провайдер → models.dev.
 */
export async function planCustomProvider(options: {
	providerId: string;
	wire: CustomWire;
	baseUrl: string;
	apiKey: string;
	modelIds: string[];
	/** Оффлайн-режим: пропустить сетевой enrichment. */
	skipEnrichment?: boolean;
}): Promise<CustomProviderPlan> {
	const ownMeta = options.skipEnrichment
		? new Map<string, CustomProviderMeta>()
		: await fetchProviderOwnMeta(options.baseUrl, options.apiKey, options.wire);
	const devMeta = options.skipEnrichment
		? new Map<string, CustomProviderMeta>()
		: await fetchModelsDevLookup();

	const ids = new Set<string>();
	for (const meta of ownMeta.keys()) ids.add(meta);
	for (const raw of options.modelIds) {
		const id = raw.trim();
		if (id) ids.add(id);
	}
	if (ids.size === 0) {
		throw new Error(
			'Provider did not return a model list and no --model was given. Pass at least one --model <id>.',
		);
	}

	const aliases: Record<string, CustomAliasFields> = {};
	let enrichedCount = 0;
	for (const id of [...ids].sort()) {
		const fields = mergeMeta(ownMeta.get(id.toLowerCase()), devMeta.get(id.toLowerCase()));
		if (Object.keys(fields).length > 0) enrichedCount += 1;
		aliases[`${options.providerId}/${id}`] = {
			...fields,
			displayName: fields.displayName ?? prettyModelName(id),
		};
	}

	return {
		providerId: options.providerId,
		wire: options.wire,
		baseUrl: options.baseUrl,
		apiKey: options.apiKey,
		aliases,
		enrichedCount,
	};
}

/** Минимальная форма конфига, нужная для записи провайдера (без циклического импорта). */
export interface CustomProviderConfigShape {
	providers: Record<
		string,
		{ type: string; baseUrl?: string; apiKey?: string; [key: string]: unknown }
	>;
	models?: Record<string, Record<string, unknown> & { provider?: string; model?: string }>;
	defaultModel?: string;
}

/**
 * Пишет провайдера и алиасы в конфиг (в памяти). Персист через harness.setConfig —
 * как applyCatalogProvider, но без очистки чужих моделей.
 */
export function applyCustomDirectProvider(
	config: CustomProviderConfigShape,
	plan: CustomProviderPlan,
	defaultModel?: string,
): string {
	config.providers[plan.providerId] = {
		type: plan.wire,
		baseUrl: plan.baseUrl,
		apiKey: plan.apiKey,
	};
	const models: NonNullable<CustomProviderConfigShape['models']> = config.models ?? {};
	for (const [key, fields] of Object.entries(plan.aliases)) {
		models[key] = {
			...models[key],
			provider: plan.providerId,
			model: key.slice(plan.providerId.length + 1),
			...fields,
		};
	}
	config.models = models;
	if (defaultModel !== undefined) config.defaultModel = defaultModel;
	return defaultModel ?? Object.keys(plan.aliases)[0] ?? '';
}

/** Адаптация URL под wire-конвенцию CLI: anthropic SDK сам добавляет /v1/messages. */
export function adaptCustomBaseUrl(baseUrl: string, wire: CustomWire): string {
	return wire === 'anthropic' ? baseUrl.trim().replace(/\/v1\/?$/, '') : baseUrl.trim();
}
