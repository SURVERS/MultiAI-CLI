import { parseSkillText } from '../parser';
import type { SkillDefinition } from '../types';
import CHECK_MULTIAI_DOCS_BODY from './check-multiai-docs.md?raw';

const PSEUDO_PATH = 'builtin://check-multiai-docs';

const parsed = parseSkillText({
  skillMdPath: '/builtin/skills/check-multiai-docs.md',
  skillDirName: 'check-multiai-docs',
  source: 'builtin',
  text: CHECK_MULTIAI_DOCS_BODY,
});

export const CHECK_MULTIAI_DOCS_SKILL: SkillDefinition = {
  ...parsed,
  path: PSEUDO_PATH,
  dir: PSEUDO_PATH,
  metadata: {
    ...parsed.metadata,
    type: parsed.metadata.type ?? 'inline',
  },
};
