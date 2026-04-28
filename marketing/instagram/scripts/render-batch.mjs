#!/usr/bin/env node
/**
 * TriboCRM · Pipeline Instagram · render-batch
 * ---------------------------------------------
 * Renderiza TODAS as pautas YAML de um diretório em série,
 * reusando uma única instância do Chromium (mais rápido que N renders).
 *
 * Uso:
 *   npm run posts:all
 *   npm run posts:all -- --dir posts/2026-05
 */

import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer';
import { renderPost } from './render-post.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', short: 'd', default: 'posts' },
      out: { type: 'string', short: 'o', default: 'output' }
    }
  });

  const inDir = resolve(ROOT, values.dir);
  const outDir = resolve(ROOT, values.out);

  let entries;
  try {
    entries = await readdir(inDir);
  } catch (err) {
    console.error(`✗ Diretório não encontrado: ${values.dir}`);
    process.exit(1);
  }

  const yamls = [];
  for (const name of entries) {
    if (!/\.ya?ml$/i.test(name)) continue;
    const full = join(inDir, name);
    const s = await stat(full);
    if (s.isFile()) yamls.push(full);
  }

  if (yamls.length === 0) {
    console.log(`Nenhuma pauta YAML em ${values.dir}/`);
    return;
  }

  console.log(`▶ ${yamls.length} pautas em fila`);
  const t0 = Date.now();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1200, height: 2000, deviceScaleFactor: 1 }
  });

  let ok = 0;
  let fail = 0;

  try {
    for (const pautaPath of yamls) {
      const name = pautaPath.split(/[\\/]/).pop();
      try {
        const r = await renderPost({ pautaPath, outDir, browser });
        console.log(`  ✓ ${name.padEnd(48)} → ${r.width}×${r.height}`);
        ok++;
      } catch (err) {
        console.log(`  ✗ ${name.padEnd(48)} ${err.message}`);
        fail++;
      }
    }
  } finally {
    await browser.close();
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${ok} ok · ${fail} falhas · ${dt}s`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
