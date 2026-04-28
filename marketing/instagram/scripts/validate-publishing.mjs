#!/usr/bin/env node
/**
 * TriboCRM · Instagram Pipeline · validate-publishing
 * ----------------------------------------------------
 * Health check do setup Graph API. Roda 3 verificações:
 *   1. Token funciona (GET /me)
 *   2. Quota de publicação disponível (GET /{ig-id}/content_publishing_limit)
 *   3. Cloudinary credenciais funcionam (ping API)
 *
 * Uso:
 *   npm run validate
 *
 * Saída:
 *   Tabela com ✓/✗ por item. Exit 0 se tudo OK, 1 se algo falhar.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
loadDotenv({ path: resolve(ROOT, '.env') });

const {
  IG_LONG_LIVED_TOKEN,
  IG_BUSINESS_ACCOUNT_ID,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} = process.env;

const IG_API = 'https://graph.instagram.com/v21.0';

const results = [];

function record(ok, label, detail) {
  results.push({ ok, label, detail });
}

async function checkToken() {
  if (!IG_LONG_LIVED_TOKEN) {
    record(false, 'Token IG', 'IG_LONG_LIVED_TOKEN ausente em .env');
    return;
  }
  try {
    const url = new URL(`${IG_API}/me`);
    url.searchParams.set('fields', 'user_id,username,account_type');
    url.searchParams.set('access_token', IG_LONG_LIVED_TOKEN);
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      record(false, 'Token IG', `${json.error.code}: ${json.error.message}`);
      return;
    }
    record(true, 'Token IG', `@${json.username} · ${json.account_type}`);
  } catch (err) {
    record(false, 'Token IG', err.message);
  }
}

async function checkPublishingLimit() {
  if (!IG_LONG_LIVED_TOKEN || !IG_BUSINESS_ACCOUNT_ID) {
    record(false, 'Quota publicação', 'token ou business_id ausente');
    return;
  }
  try {
    const url = new URL(`${IG_API}/${IG_BUSINESS_ACCOUNT_ID}/content_publishing_limit`);
    url.searchParams.set('access_token', IG_LONG_LIVED_TOKEN);
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      record(false, 'Quota publicação', `${json.error.code}: ${json.error.message}`);
      return;
    }
    const usage = json.data?.[0]?.quota_usage ?? '?';
    record(true, 'Quota publicação', `${usage}/50 usado nas últimas 24h`);
  } catch (err) {
    record(false, 'Quota publicação', err.message);
  }
}

async function checkCloudinary() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    record(false, 'Cloudinary', 'credenciais ausentes em .env');
    return;
  }
  try {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true
    });
    const ping = await cloudinary.api.ping();
    record(ping.status === 'ok', 'Cloudinary', `cloud=${CLOUDINARY_CLOUD_NAME} · ${ping.status}`);
  } catch (err) {
    record(false, 'Cloudinary', err.message);
  }
}

async function main() {
  await Promise.all([checkToken(), checkPublishingLimit(), checkCloudinary()]);

  console.log('\nValidação do publisher:\n');
  let allOk = true;
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`  ${mark} ${r.label.padEnd(22)} ${r.detail}`);
    if (!r.ok) allOk = false;
  }
  console.log('');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
