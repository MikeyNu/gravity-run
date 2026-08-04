import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gravity-run/game-config': resolve(root, 'packages/game-config/src/index.ts'),
      '@gravity-run/simulation': resolve(root, 'packages/simulation/src/index.ts'),
      '@gravity-run/shared': resolve(root, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
          postprocessing: ['postprocessing'],
        },
      },
    },
  },
});
