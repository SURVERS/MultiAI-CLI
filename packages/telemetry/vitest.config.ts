import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'multiai-telemetry',
    include: ['test/**/*.test.ts'],
  },
});
