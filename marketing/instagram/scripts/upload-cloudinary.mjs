#!/usr/bin/env node
/**
 * TriboCRM · Instagram Pipeline · upload-cloudinary
 * --------------------------------------------------
 * Faz upload de UM PNG pra Cloudinary e imprime a URL pública.
 * O IG Chief usa essa URL no campo image_url do Instagram Graph API.
 *
 * Uso:
 *   npm run upload -- --file output/2026-05-04_funil_01-capa.png
 *   npm run upload -- --file output/X.png --public-id custom-name
 *
 * Output (stdout):
 *   https://res.cloudinary.com/<cloud>/image/upload/v.../X.png
 *
 * Credenciais lidas de marketing/instagram/.env:
 *   CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET
 */

import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { config as loadDotenv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Carrega .env do diretório do pipeline
loadDotenv({ path: resolve(ROOT, '.env') });

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('✗ Credenciais Cloudinary ausentes. Confira marketing/instagram/.env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', short: 'f' },
      'public-id': { type: 'string', short: 'p' },
      folder: { type: 'string', default: 'tribocrm-ig' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (values.help || !values.file) {
    console.log(`
TriboCRM · Cloudinary upload

Uso:
  npm run upload -- --file output/<arquivo>.png [--public-id <slug>] [--folder <pasta>]

Opções:
  -f, --file <path>       PNG/JPG/WebP a fazer upload (obrigatório)
  -p, --public-id <slug>  Public ID custom (default: nome do arquivo sem extensão)
  --folder <pasta>        Pasta no Cloudinary (default: tribocrm-ig)
  -h, --help              Esta ajuda
`);
    process.exit(values.help ? 0 : 1);
  }

  const filePath = resolve(ROOT, values.file);
  try {
    await access(filePath);
  } catch {
    console.error(`✗ Arquivo não encontrado: ${values.file}`);
    process.exit(1);
  }

  const publicId = values['public-id'] || basename(filePath, extname(filePath));

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: values.folder,
      public_id: publicId,
      overwrite: true,
      resource_type: 'image'
    });

    // stdout: só a URL (fácil de capturar via $(npm run upload --silent ...))
    console.log(result.secure_url);

    // stderr: meta-info (pra debugging)
    console.error(`✓ ${basename(filePath)} → ${result.secure_url}`);
    console.error(`  ${result.width}×${result.height} · ${(result.bytes / 1024).toFixed(1)}KB · ${result.format}`);
  } catch (err) {
    console.error(`✗ Falha no upload: ${err.message}`);
    process.exit(1);
  }
}

main();
