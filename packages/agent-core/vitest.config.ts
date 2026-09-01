import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'multiai-core',
    include: ['test/**/*.{test,e2e}.ts'],
  },
});
