import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'multiai-oauth',
    include: ['test/**/*.test.ts'],
  },
});
