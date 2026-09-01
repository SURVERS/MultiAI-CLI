import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@multiai/agent-core': fileURLToPath(new URL('../agent-core/src/index.ts', import.meta.url)),
      '@multiai/oauth': fileURLToPath(
        new URL('../oauth/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'multiai-sdk',
    env: {
      MULTIAI_LOG_LEVEL: 'off',
    },
    include: ['test/**/*.test.ts'],
  },
});
