import { describe, expect, it, vi } from 'vitest';
import {
	adaptCustomBaseUrl,
	applyCustomDirectProvider,
	mergeMeta,
	planCustomProvider,
	type CustomProviderMeta,
} from '../src/cli/sub/custom-provider';

describe('adaptCustomBaseUrl', () => {
	it('strips trailing /v1 for anthropic wire (SDK appends /v1/messages)', () => {
		expect(adaptCustomBaseUrl('https://api.example.com/v1', 'anthropic')).toBe('https://api.example.com');
		expect(adaptCustomBaseUrl('https://api.example.com/v1/', 'anthropic')).toBe('https://api.example.com');
	});
	it('keeps /v1 for openai wire', () => {
		expect(adaptCustomBaseUrl('https://api.example.com/v1', 'openai')).toBe('https://api.example.com/v1');
	});
});

describe('mergeMeta', () => {
	it('provider fields win over models.dev; missing fields are filled', () => {
		const own: CustomProviderMeta = { maxContextSize: 131_072 };
		const dev: CustomProviderMeta = {
			displayName: 'BGE M3',
			maxContextSize: 8_192,
			maxOutputSize: 4_096,
			inputModalities: ['text', 'image'],
		};
		const merged = mergeMeta(own, dev);
		expect(merged.maxContextSize).toBe(131_072);
		expect(merged.displayName).toBe('BGE M3');
		expect(merged.maxOutputSize).toBe(4_096);
		expect(merged.capabilities).toContain('image_in');
	});
	it('maps reasoning efforts and default', () => {
		const merged = mergeMeta(
			{ supportEfforts: ['low', 'medium', 'high'] },
			undefined,
		);
		expect(merged.reasoningKey).toBe('effort');
		expect(merged.defaultEffort).toBe('medium');
		expect(merged.supportEfforts).toEqual(['low', 'medium', 'high']);
	});
});

describe('planCustomProvider', () => {
	it('preserves provider model ID casing and namespaces', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => new Response(
			JSON.stringify(String(url).includes('models.dev') ? {} : { data: [{ id: 'Example/Chat-Large' }] }),
			{ status: 200 },
		)));
		try {
			const plan = await planCustomProvider({ providerId: 'custom', wire: 'openai',
				baseUrl: 'https://example.test/v1', apiKey: 'YOUR_API_KEY', modelIds: [] });
			expect(Object.keys(plan.aliases)).toEqual(['custom/Example/Chat-Large']);
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it('merges provider /v1/models metadata with models.dev fallback', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
			const u = String(url);
			if (u.includes('models.dev')) {
				return new Response(JSON.stringify({
					someprovider: { models: {
						'glm-5.2': { id: 'glm-5.2', name: 'GLM-5.2', limit: { context: 1_000_000, output: 131_072 } },
					} },
				}), { status: 200 });
			}
			return new Response(JSON.stringify({
				data: [
						{ id: 'glm-5.2', name: 'GLM 5.2', context_length: 2_000_000, max_output_tokens: 65_536,
						input_modalities: ['text'], supported_parameters: ['reasoning_effort'] },
					{ id: 'mini-inhouse', context_window: 32_768 },
				],
			}), { status: 200 });
		}));

		const plan = await planCustomProvider({
			providerId: 'myprov',
			wire: 'openai',
			baseUrl: 'https://api.myprov.dev/v1',
			apiKey: 'k',
			modelIds: [],
		});
		// Поля провайдера приоритетнее models.dev (2M > 1M), displayName — от провайдера.
		const glm = plan.aliases['myprov/glm-5.2']!;
		expect(glm.maxContextSize).toBe(2_000_000);
		expect(glm.displayName).toBe('GLM 5.2');
		expect(glm.maxOutputSize).toBe(65_536);
		expect(glm.reasoningKey).toBe('effort');
		expect(glm.defaultEffort).toBe('medium');
		// Модель без имени получает pretty-имя из id.
		const mini = plan.aliases['myprov/mini-inhouse']!;
		expect(mini.displayName).toBe('Mini Inhouse');
		expect(mini.maxContextSize).toBe(32_768);
		expect(plan.enrichedCount).toBe(2);
		vi.unstubAllGlobals();
	});

	it('falls back to --model ids when the provider returns nothing', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
		const plan = await planCustomProvider({
			providerId: 'p2',
			wire: 'anthropic',
			baseUrl: 'https://x.dev',
			apiKey: 'k',
			modelIds: ['claude-inhouse'],
		});
		expect(Object.keys(plan.aliases)).toEqual(['p2/claude-inhouse']);
		expect(plan.aliases['p2/claude-inhouse']!.displayName).toBe('Claude Inhouse');
		vi.unstubAllGlobals();
	});
});

describe('applyCustomDirectProvider', () => {
	it('writes provider + aliases + defaultModel without touching foreign models', () => {
		const config: {
			providers: Record<string, unknown>;
			models: Record<string, Record<string, unknown>>;
			defaultModel?: string;
		} = { providers: {}, models: { 'other/m1': { provider: 'other', model: 'm1' } } };
		const plan = {
			providerId: 'p',
			wire: 'openai' as const,
			baseUrl: 'https://api.p.dev/v1',
			apiKey: 'k',
			aliases: { 'p/m1': { displayName: 'M1' }, 'p/m2': { displayName: 'M2' } },
			enrichedCount: 2,
		};
		const def = applyCustomDirectProvider(config as never, plan as never, 'p/m2');
		expect(config.providers['p']).toMatchObject({ type: 'openai', apiKey: 'k' });
		expect(config.models['p/m1']).toMatchObject({ provider: 'p', model: 'm1', displayName: 'M1' });
		expect(config.models['other/m1']).toBeDefined();
		expect(config.defaultModel).toBe('p/m2');
		expect(def).toBe('p/m2');
	});
});
