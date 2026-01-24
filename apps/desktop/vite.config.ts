import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version?: string };

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@efgachahelper/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
  },
  clearScreen: false,
  server: {
    port: 5273,
    strictPort: true,
    host: host || false,
    ...(host
      ? {
          hmr: {
            protocol: 'ws',
            host,
            port: 1421,
          },
        }
      : {}),
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});

