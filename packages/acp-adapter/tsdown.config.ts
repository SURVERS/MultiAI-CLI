import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  deps: {
    neverBundle: [
      '@agentclientprotocol/sdk',
      '@multiai/agent-core',
      '@multiai/sdk',
      '@multiai/kosong',
      '@multiai/kaos',
    ],
  },
});
