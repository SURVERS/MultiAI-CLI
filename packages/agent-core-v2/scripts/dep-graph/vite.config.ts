
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { depGraphPlugin } from './plugin/virtual-dep-graph';

const here = import.meta.dirname;

export default defineConfig({
  root: resolve(here, 'web'),
  cacheDir: resolve(here, '.vite'),
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5187,
    strictPort: false,
  },
  plugins: [react(), depGraphPlugin()],
  build: {
    outDir: resolve(here, '.local', 'web-dist'),
    emptyOutDir: true,
  },
});
