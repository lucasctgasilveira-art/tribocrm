#!/usr/bin/env node
/**
 * TriboCRM · Instagram Pipeline · publish
 * ----------------------------------------
 * Worker de publicação automática via Instagram Graph API.
 *
 * Lê schedule/*.yaml, filtra peças prontas (status=aprovado, hora chegou,
 * formato != reel) e publica como carrossel ou feed estático.
 *
 * Uso:
 *   npm run publish                    # ciclo normal (cron)
 *   npm run publish -- --dry-run       # mostra o que faria, sem chamar API
 *   npm run publish -- --slug 2026-05-04_funil  # só essa peça
 *   npm run publish -- --force         # ignora slot temporal (publica já)
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
loadDotenv({ path: resolve(ROOT, '.env') });

const {
  IG_LONG_LIVED_TOKEN,
  IG_BUSINESS_ACCOUNT_ID,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  DISCORD_WEBHOOK_URL,
  INSTAGRAM_HANDLE
} = process.env;

const IG_API = 'https://graph.instagram.com/v21.0';

async function notify({ title, body, color }) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description: body,
            color: color ?? 0x2ecc71,
            footer: { text: INSTAGRAM_HANDLE || '@tribocrmoficial' },
            timestamp: new Date().toISOString()
          }
        ]
      })
    });
  } catch {
    // Notificação falhou: não interrompe o fluxo principal
  }
}

function checkEnv() {
  const missing = [];
  if (!IG_LONG_LIVED_TOKEN) missing.push('IG_LONG_LIVED_TOKEN');
  if (!IG_BUSINESS_ACCOUNT_ID) missing.push('IG_BUSINESS_ACCOUNT_ID');
  if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  if (missing.length) {
    console.error(`✗ Variáveis ausentes em .env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function igRequest(method, path, params = {}) {
  const url = new URL(`${IG_API}${path}`);
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', IG_LONG_LIVED_TOKEN);
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(`IG ${json.error.code}: ${json.error.message}`);
    return json;
  }
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  body.set('access_token', IG_LONG_LIVED_TOKEN);
  const res = await fetch(url, { method, body });
  const json = await res.json();
  if (json.error) throw new Error(`IG ${json.error.code}: ${json.error.message}`);
  return json;
}

async function waitForContainer(containerId, maxWaitSec = 90) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWaitSec) {
    const j = await igRequest('GET', `/${containerId}`, { fields: 'status_code' });
    if (j.status_code === 'FINISHED') return;
    if (['ERROR', 'EXPIRED'].includes(j.status_code)) {
      throw new Error(`Container ${containerId} status: ${j.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Container ${containerId} timeout (${maxWaitSec}s)`);
}

async function uploadToCloudinary(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'tribocrm-ig',
    public_id: basename(filePath, extname(filePath)),
    overwrite: true,
    resource_type: 'image'
  });
  return result.secure_url;
}

async function resolveCaption(schedule) {
  if (schedule.caption) return schedule.caption;
  if (!schedule.caption_source) return '';
  const [file, key] = schedule.caption_source.split('#');
  const filePath = resolve(ROOT, file);
  const raw = await readFile(filePath, 'utf-8');
  const data = yaml.load(raw);
  return (key ? data?.[key] : data?.caption) || '';
}

async function publishCarousel({ urls, caption }) {
  const containers = [];
  for (const image_url of urls) {
    const j = await igRequest('POST', `/${IG_BUSINESS_ACCOUNT_ID}/media`, {
      image_url,
      is_carousel_item: 'true'
    });
    containers.push(j.id);
  }
  for (const id of containers) await waitForContainer(id);

  const carousel = await igRequest('POST', `/${IG_BUSINESS_ACCOUNT_ID}/media`, {
    media_type: 'CAROUSEL',
    children: containers.join(','),
    caption
  });
  await waitForContainer(carousel.id);

  const published = await igRequest('POST', `/${IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
    creation_id: carousel.id
  });
  return published.id;
}

async function publishSingleImage({ urls, caption }) {
  const container = await igRequest('POST', `/${IG_BUSINESS_ACCOUNT_ID}/media`, {
    image_url: urls[0],
    caption
  });
  await waitForContainer(container.id);
  const published = await igRequest('POST', `/${IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
    creation_id: container.id
  });
  return published.id;
}

async function getPermalink(mediaId) {
  try {
    const j = await igRequest('GET', `/${mediaId}`, { fields: 'permalink' });
    return j.permalink || null;
  } catch {
    return null;
  }
}

function parseSlot(slot) {
  if (!slot || slot.data == null) throw new Error('slot.data ausente');

  const dataStr =
    slot.data instanceof Date
      ? slot.data.toISOString().slice(0, 10)
      : String(slot.data).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new Error(`slot.data inválido: ${JSON.stringify(slot.data)}`);
  }

  const time = (slot.horario || '09:00').replace(/\s+BRT$/i, '').trim();
  const [h = '09', m = '00'] = time.split(':').map((s) => s.padStart(2, '0'));
  if (!/^\d{2}$/.test(h) || !/^\d{2}$/.test(m)) {
    throw new Error(`slot.horario inválido: ${JSON.stringify(slot.horario)}`);
  }

  const result = new Date(`${dataStr}T${h}:${m}:00-03:00`);
  if (isNaN(result.getTime())) {
    throw new Error(`Data construída inválida: ${dataStr}T${h}:${m}:00-03:00`);
  }
  return result;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      slug: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (values.help) {
    console.log(`
TriboCRM · Instagram Publisher

Uso:
  npm run publish                          # ciclo normal (usado pelo cron)
  npm run publish -- --dry-run             # simula sem chamar API
  npm run publish -- --slug <prefix>       # só peças que começam com prefix
  npm run publish -- --force               # ignora slot temporal

Filtros aplicados:
  - status === "aprovado"
  - formato !== "reel" (Reels: postagem manual)
  - hora atual >= slot.data + slot.horario (a menos que --force)
`);
    process.exit(0);
  }

  checkEnv();

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });

  const scheduleDir = resolve(ROOT, 'schedule');
  let entries;
  try {
    entries = await readdir(scheduleDir);
  } catch {
    console.log('Sem diretório schedule/. Nada a publicar.');
    return;
  }

  const yamls = entries.filter((n) => /\.ya?ml$/i.test(n));
  if (yamls.length === 0) {
    console.log('Nenhuma peça em schedule/.');
    return;
  }

  const now = new Date();
  let processed = 0;
  let published = 0;

  for (const name of yamls) {
    const path = join(scheduleDir, name);
    const raw = await readFile(path, 'utf-8');
    const schedule = yaml.load(raw);
    if (!schedule || typeof schedule !== 'object') continue;

    if (values.slug && !name.startsWith(values.slug)) continue;

    if ((schedule.formato || '').toLowerCase() === 'reel') {
      console.log(`⏭  ${name} · pula (Reel: postagem manual)`);
      continue;
    }
    if (schedule.status !== 'aprovado') {
      console.log(`⏭  ${name} · pula (status: ${schedule.status || 'indefinido'})`);
      continue;
    }

    let slot;
    try {
      slot = parseSlot(schedule.slot);
    } catch (err) {
      console.error(`✗ ${name} · slot inválido: ${err.message}`);
      continue;
    }

    if (!values.force && now < slot) {
      console.log(`⏳ ${name} · aguarda ${slot.toISOString()}`);
      continue;
    }

    processed++;
    console.log(`\n▶ ${name}`);

    const caption = await resolveCaption(schedule);
    if (!caption) {
      console.error(`✗ ${name} · sem caption (caption ou caption_source ausente)`);
      continue;
    }

    const files = schedule.arquivos || [];
    if (files.length === 0) {
      console.error(`✗ ${name} · sem arquivos listados`);
      continue;
    }

    if (values['dry-run']) {
      console.log(`  🔍 DRY-RUN`);
      console.log(`     ${files.length} arquivo(s) · caption ${caption.length} chars`);
      console.log(`     Primeira linha: ${caption.split('\n')[0].slice(0, 80)}`);
      continue;
    }

    try {
      console.log(`  ↑ Cloudinary (${files.length} arquivo${files.length > 1 ? 's' : ''})`);
      const urls = [];
      for (const file of files) {
        const url = await uploadToCloudinary(resolve(ROOT, file));
        urls.push(url);
      }

      console.log(`  ↑ IG Graph API`);
      const mediaId =
        urls.length === 1
          ? await publishSingleImage({ urls, caption })
          : await publishCarousel({ urls, caption });

      const permalink = await getPermalink(mediaId);

      schedule.status = 'publicado';
      schedule.published_at = now.toISOString();
      schedule.media_id = mediaId;
      if (permalink) schedule.permalink = permalink;
      delete schedule.last_error;
      delete schedule.last_error_at;

      await writeFile(path, yaml.dump(schedule, { lineWidth: 120, noRefs: true }), 'utf-8');

      console.log(`  ✓ media_id: ${mediaId}`);
      if (permalink) console.log(`  ✓ ${permalink}`);
      published++;

      await notify({
        title: `✅ Publicado · ${name.replace(/\.ya?ml$/, '')}`,
        body: [
          permalink ? `🔗 ${permalink}` : `media_id: ${mediaId}`,
          `📐 ${files.length} ${files.length > 1 ? 'slides' : 'imagem'}`,
          `📝 ${caption.split('\n')[0].slice(0, 80)}`
        ].join('\n'),
        color: 0x2ecc71
      });
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      schedule.last_error = err.message;
      schedule.last_error_at = now.toISOString();
      await writeFile(path, yaml.dump(schedule, { lineWidth: 120, noRefs: true }), 'utf-8');

      await notify({
        title: `❌ Falhou · ${name.replace(/\.ya?ml$/, '')}`,
        body: `\`\`\`\n${err.message}\n\`\`\`\nVer logs: https://github.com/lucasctgasilveira-art/tribocrm/actions/workflows/instagram-publisher.yml`,
        color: 0xe74c3c
      });
    }
  }

  console.log(`\n${published} publicado · ${processed - published} falha · ${yamls.length - processed} pulado`);
  if (!values['dry-run'] && processed > 0 && published === 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
