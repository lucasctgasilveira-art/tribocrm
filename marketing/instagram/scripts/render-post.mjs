#!/usr/bin/env node
/**
 * TriboCRM · Pipeline Instagram · render-post
 * --------------------------------------------
 * Renderiza UMA pauta YAML em PNG via Puppeteer.
 *
 * Uso:
 *   npm run post -- --pauta posts/2026-05-04_funil_01-capa.yaml
 *
 * Fluxo:
 *   1. Lê YAML da pauta (template + slug + data)
 *   2. Carrega template HTML correspondente
 *   3. Substitui [data-edit="key"] pelo valor de data.key
 *   4. Captura screenshot do .canvas no tamanho nativo
 *   5. Salva em output/<slug>.png
 */

import { readFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Renderiza uma pauta. Pode ser chamado em série pelo render-batch.
 */
export async function renderPost({ pautaPath, outDir, browser }) {
  const pautaRaw = await readFile(pautaPath, 'utf-8');
  const pauta = yaml.load(pautaRaw);

  if (!pauta || typeof pauta !== 'object') {
    throw new Error(`YAML inválido: ${pautaPath}`);
  }

  const { template, slug, data } = pauta;
  if (!template) throw new Error(`Pauta sem campo "template": ${pautaPath}`);
  if (!data) throw new Error(`Pauta sem campo "data": ${pautaPath}`);

  const templatePath = resolve(ROOT, 'templates', `${template}.html`);
  try {
    await access(templatePath);
  } catch {
    throw new Error(`Template não encontrado: templates/${template}.html`);
  }

  const finalSlug = slug || basename(pautaPath, '.yaml');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${finalSlug}.png`);

  const ownsBrowser = !browser;
  if (ownsBrowser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1200, height: 2000, deviceScaleFactor: 1 }
    });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 2000, deviceScaleFactor: 1 });

    const fileUrl = `file://${templatePath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Desabilita o preview-stage scaling pra renderizar canvas no tamanho nativo
    await page.addStyleTag({
      content: `
        body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
        .preview-stage {
          padding: 0 !important;
          min-height: 0 !important;
          background: transparent !important;
          display: block !important;
        }
        .preview-stage .canvas {
          transform: none !important;
          margin: 0 !important;
        }
      `
    });

    // Substitui valores marcados com data-edit
    await page.evaluate((data) => {
      document.querySelectorAll('[data-edit]').forEach((el) => {
        const key = el.getAttribute('data-edit');
        if (data[key] !== undefined && data[key] !== null) {
          el.innerHTML = String(data[key]);
        }
      });
    }, data);

    // Garante que fontes carregaram antes de capturar
    await page.evaluate(() => document.fonts.ready);
    // Pequena espera adicional pra estabilizar layout (img SVG, etc)
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await page.$('.canvas');
    if (!canvas) {
      throw new Error('Elemento .canvas não encontrado no template');
    }

    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Não foi possível medir o .canvas');
    }

    await canvas.screenshot({ path: outPath, type: 'png', omitBackground: false });

    await page.close();

    return {
      slug: finalSlug,
      template,
      out: outPath,
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  } finally {
    if (ownsBrowser) await browser.close();
  }
}

/**
 * Entry point CLI
 */
async function main() {
  const { values } = parseArgs({
    options: {
      pauta: { type: 'string', short: 'p' },
      out:   { type: 'string', short: 'o', default: 'output' },
      help:  { type: 'boolean', short: 'h' }
    }
  });

  if (values.help || !values.pauta) {
    console.log(`
TriboCRM · Pipeline Instagram

Uso:
  npm run post -- --pauta posts/<arquivo>.yaml [--out <dir>]

Opções:
  -p, --pauta <path>    Arquivo YAML da pauta (obrigatório)
  -o, --out <dir>       Diretório de saída (padrão: output/)
  -h, --help            Mostra esta ajuda
`);
    process.exit(values.help ? 0 : 1);
  }

  const pautaPath = resolve(ROOT, values.pauta);
  const outDir = resolve(ROOT, values.out);

  console.log(`▶ ${basename(pautaPath)}`);

  const t0 = Date.now();
  const result = await renderPost({ pautaPath, outDir });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`✓ ${result.template} → ${result.slug}.png`);
  console.log(`  ${result.width}×${result.height} · ${dt}s · ${result.out}`);
}

// Só executa main se for chamado direto (não importado pelo batch).
// Usa pathToFileURL pra normalizar paths Windows (file:///C:/...) corretamente.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
