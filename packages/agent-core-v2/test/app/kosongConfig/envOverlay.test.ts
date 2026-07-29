/**
 * `app/kosongConfig` envOverlay tests — the `MULTIAI_MODEL_*` effective overlay:
 *
 *  - with `MULTIAI_MODEL_NAME` set it synthesizes the reserved env model +
 *    provider entries and selects the model; without it only the
 *    `modelOverrides` knobs apply;
 *  - the env provider's default `baseUrl` comes from the provider-definition
 *    registry (`resolveProviderEndpoint` against the same env the overlay
 *    reads): the Kimi chain yields `MULTIAI_BASE_URL` →
 *    `https://api.moonshot.ai/v1`;
 *  - `strip` keeps the synthesized values out of `config.toml`.
 */

import { describe, expect, it } from 'vitest';

import { ENV_MODEL_PROVIDER_KEY } from '#/app/kosongConfig/configSection';
import '#/kosong/provider/providers/kimi/kimi.contrib';
import '#/kosong/provider/providers/standard.contrib';
import { ENV_MODEL_ALIAS_KEY, multiaiModelEnvOverlay } from '#/app/kosongConfig/envOverlay';

type Env = Record<string, string>;

function apply(effective: Record<string, unknown>, env: Env): readonly string[] {
  return multiaiModelEnvOverlay.apply(effective, (name) => env[name], (_domain, value) => value);
}

describe('multiaiModelEnvOverlay.apply', () => {
  it('does nothing with no MULTIAI_MODEL_* env', () => {
    const effective: Record<string, unknown> = {};
    expect(apply(effective, {})).toEqual([]);
    expect(effective).toEqual({});
  });

  it('applies only modelOverrides when MULTIAI_MODEL_NAME is unset', () => {
    const effective: Record<string, unknown> = {};
    const changed = apply(effective, {
      MULTIAI_MODEL_TEMPERATURE: '0.7',
      MULTIAI_MODEL_TOP_P: '0.95',
      MULTIAI_MODEL_THINKING_KEEP: 'all',
      MULTIAI_MODEL_MAX_COMPLETION_TOKENS: '8192',
    });
    expect(changed).toEqual(['modelOverrides']);
    expect(effective['modelOverrides']).toEqual({
      temperature: 0.7,
      topP: 0.95,
      thinkingKeep: 'all',
      maxCompletionTokens: 8192,
    });
  });

  it('synthesizes the env model, selects it, and defaults the provider through the registry', () => {
    const effective: Record<string, unknown> = {};
    const changed = apply(effective, { MULTIAI_MODEL_NAME: 'kimi-k2-custom' });
    expect(changed).toEqual(
      expect.arrayContaining(['models', 'providers', 'defaultModel']),
    );
    expect((effective['models'] as Record<string, unknown>)[ENV_MODEL_ALIAS_KEY]).toEqual({
      provider: ENV_MODEL_PROVIDER_KEY,
      model: 'kimi-k2-custom',
      maxContextSize: 262144,
      capabilities: ['image_in', 'thinking'],
    });
    expect((effective['providers'] as Record<string, unknown>)[ENV_MODEL_PROVIDER_KEY]).toEqual({
      type: 'kimi',
      baseUrl: 'https://api.moonshot.ai/v1',
    });
    expect(effective['defaultModel']).toBe(ENV_MODEL_ALIAS_KEY);
  });

  it('honors the vendor endpoint env chain for the default baseUrl', () => {
    const effective: Record<string, unknown> = {};
    apply(effective, {
      MULTIAI_MODEL_NAME: 'kimi-k2-custom',
      MULTIAI_BASE_URL: 'https://kimi-proxy.example.test/v1',
    });
    expect((effective['providers'] as Record<string, unknown>)[ENV_MODEL_PROVIDER_KEY]).toEqual({
      type: 'kimi',
      baseUrl: 'https://kimi-proxy.example.test/v1',
    });
  });

  it('keeps an existing env-provider type and baseUrl untouched', () => {
    const effective: Record<string, unknown> = {
      providers: {
        [ENV_MODEL_PROVIDER_KEY]: { type: 'openai', baseUrl: 'https://proxy.example.test/v1' },
      },
    };
    const changed = apply(effective, { MULTIAI_MODEL_NAME: 'my-model' });
    expect(changed).not.toContain('providers');
    expect((effective['providers'] as Record<string, unknown>)[ENV_MODEL_PROVIDER_KEY]).toEqual({
      type: 'openai',
      baseUrl: 'https://proxy.example.test/v1',
    });
  });

  it('parses the optional model fields and validates their shapes', () => {
    const effective: Record<string, unknown> = {};
    apply(effective, {
      MULTIAI_MODEL_NAME: 'my-model',
      MULTIAI_MODEL_MAX_CONTEXT_SIZE: '131072',
      MULTIAI_MODEL_MAX_OUTPUT_SIZE: '4096',
      MULTIAI_MODEL_CAPABILITIES: 'image_in, tool_use',
      MULTIAI_MODEL_DISPLAY_NAME: 'Mine',
      MULTIAI_MODEL_REASONING_KEY: 'reasoning_content',
      MULTIAI_MODEL_ADAPTIVE_THINKING: 'true',
    });
    expect((effective['models'] as Record<string, unknown>)[ENV_MODEL_ALIAS_KEY]).toEqual({
      provider: ENV_MODEL_PROVIDER_KEY,
      model: 'my-model',
      maxContextSize: 131072,
      maxOutputSize: 4096,
      capabilities: ['image_in', 'tool_use'],
      displayName: 'Mine',
      reasoningKey: 'reasoning_content',
      adaptiveThinking: true,
    });

    expect(() => apply({}, { MULTIAI_MODEL_NAME: 'm', MULTIAI_MODEL_MAX_CONTEXT_SIZE: 'abc' })).toThrowError(
      /MULTIAI_MODEL_MAX_CONTEXT_SIZE must be a positive integer/,
    );
    expect(() => apply({}, { MULTIAI_MODEL_TEMPERATURE: 'hot' })).toThrowError(
      /MULTIAI_MODEL_TEMPERATURE must be a number/,
    );
  });
});

describe('multiaiModelEnvOverlay.strip', () => {
  it('removes the synthesized values on the write path', () => {
    const strip = multiaiModelEnvOverlay.strip!;
    expect(
      strip('models', { keep: { model: 'a' }, [ENV_MODEL_ALIAS_KEY]: { model: 'b' } }, {}),
    ).toEqual({ keep: { model: 'a' } });
    expect(strip('defaultModel', ENV_MODEL_ALIAS_KEY, { default_model: 'raw-default' })).toBe(
      'raw-default',
    );
    expect(strip('defaultModel', 'other-model', {})).toBe('other-model');
    expect(strip('modelOverrides', { temperature: 1 }, {})).toBeUndefined();
    expect(strip('providers', { p: { type: 'kimi' } }, {})).toEqual({ p: { type: 'kimi' } });
  });
});
