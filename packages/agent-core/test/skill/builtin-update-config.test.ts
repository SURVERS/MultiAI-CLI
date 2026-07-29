import { describe, expect, it } from 'vitest';

import { CHECK_MULTIAI_DOCS_SKILL, SessionSkillRegistry, UPDATE_CONFIG_SKILL, registerBuiltinSkills } from '../../src/skill';

describe('builtin skill: update-config', () => {
  it('has the expected identity and inline metadata', () => {
    expect(UPDATE_CONFIG_SKILL.name).toBe('update-config');
    expect(UPDATE_CONFIG_SKILL.source).toBe('builtin');
    expect(UPDATE_CONFIG_SKILL.description.length).toBeGreaterThan(0);
    expect(UPDATE_CONFIG_SKILL.metadata.type).toBe('inline');
  });

  it('is model-invocable (does not disable model invocation)', () => {
    expect(UPDATE_CONFIG_SKILL.metadata.disableModelInvocation).not.toBe(true);
  });

  it('pins the doc URL as the single source of truth and references TOML / FetchURL / /reload', () => {
    const content = UPDATE_CONFIG_SKILL.content;
    expect(content).toContain('config-files.html');
    expect(content).toContain('FetchURL');
    expect(content).toContain('/reload');
    expect(content.toLowerCase()).toContain('toml');
  });

  it('registers through registerBuiltinSkills and shows up as model-invocable', () => {
    const registry = new SessionSkillRegistry();
    registerBuiltinSkills(registry);

    expect(registry.getSkill('update-config')).toBeDefined();
    expect(
      registry.listInvocableSkills().some((skill) => skill.name === 'update-config'),
    ).toBe(true);
  });
});

describe('builtin skill: check-multiai-docs', () => {
  it('has the expected identity and inline metadata', () => {
    expect(CHECK_MULTIAI_DOCS_SKILL.name).toBe('check-multiai-docs');
    expect(CHECK_MULTIAI_DOCS_SKILL.source).toBe('builtin');
    expect(CHECK_MULTIAI_DOCS_SKILL.description.length).toBeGreaterThan(0);
    expect(CHECK_MULTIAI_DOCS_SKILL.metadata.type).toBe('inline');
  });

  it('is model-invocable (does not disable model invocation)', () => {
    expect(CHECK_MULTIAI_DOCS_SKILL.metadata.disableModelInvocation).not.toBe(true);
  });

  it('pins the repository docs and routes account and configuration questions', () => {
    const content = CHECK_MULTIAI_DOCS_SKILL.content;
    expect(content).toContain('https://github.com/SURVERS/MultiAI-CLI/tree/main/docs');
    expect(content).toContain('OAuth/account guide');
    expect(content).toContain('configuration and reference');
    expect(content).toContain('Do not substitute old Kimi Code product documentation');
  });

  it('registers through registerBuiltinSkills and shows up as model-invocable', () => {
    const registry = new SessionSkillRegistry();
    registerBuiltinSkills(registry);

    expect(registry.getSkill('check-multiai-docs')).toBeDefined();
    expect(
      registry.listInvocableSkills().some((skill) => skill.name === 'check-multiai-docs'),
    ).toBe(true);
  });
});
