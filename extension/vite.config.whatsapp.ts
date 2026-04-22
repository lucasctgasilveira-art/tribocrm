import { defineConfig } from 'vite';
import path from 'node:path';

// Build isolado do content script do WhatsApp.
// Roda DEPOIS do build principal (que usa CRXJS) e grava em dist/assets/
// sem limpar o que o CRXJS já emitiu (emptyOutDir: false).
//
// Saída: dist/assets/whatsapp.js — IIFE monolítico, sem import() dinâmico,
// sem chunks compartilhados. scripts/patch-manifest.mjs é quem conecta
// esse arquivo ao manifest como content_script do web.whatsapp.com.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@panel': path.resolve(__dirname, 'src/panel'),
      react: 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    sourcemap: false,
    minify: 'esbuild',
    target: 'chrome110',
    rollupOptions: {
      input: path.resolve(__dirname, 'src/content/whatsapp.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'whatsapp.js',
        inlineDynamicImports: true
      }
    }
  }
});
