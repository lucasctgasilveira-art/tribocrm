import { defineConfig } from 'vite';
import path from 'node:path';

// Build isolado do content script da ponte CRM <-> extensao.
// Mesma logica do vite.config.whatsapp.ts: roda apos o CRXJS, grava
// em dist/assets/ sem limpar (emptyOutDir: false).
//
// Saida: dist/assets/crm-bridge.js — IIFE monolitico injetado em
// https://app.tribocrm.com.br/* pra anunciar o ID da extensao
// (via meta tag) e abrir um canal externally_connectable que o
// service worker escuta.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@content': path.resolve(__dirname, 'src/content')
    }
  },
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    sourcemap: false,
    minify: 'esbuild',
    target: 'chrome110',
    rollupOptions: {
      input: path.resolve(__dirname, 'src/content/crm-bridge.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'crm-bridge.js',
        inlineDynamicImports: true
      }
    }
  }
});
