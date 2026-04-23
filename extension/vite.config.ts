import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './src/manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@background': path.resolve(__dirname, 'src/background'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@panel': path.resolve(__dirname, 'src/panel'),
      '@popup': path.resolve(__dirname, 'src/popup'),
      // Preact como React (caso alguma dep use React) — opcional mas seguro
      react: 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 10_240,
    minify: 'esbuild',
    target: 'chrome110'
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
});
