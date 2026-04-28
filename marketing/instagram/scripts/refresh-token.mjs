#!/usr/bin/env node
/**
 * TriboCRM · Instagram Pipeline · refresh-token
 * ----------------------------------------------
 * Renova o IG_LONG_LIVED_TOKEN antes que expire (60 dias).
 *
 * Tokens IGAA podem ser refreshed se: ≥24h desde criação E <60 dias.
 * O refresh devolve um novo token com prazo de 60 dias zerado.
 *
 * Modo local: atualiza .env (sobrescreve a linha IG_LONG_LIVED_TOKEN=)
 * Modo CI:    imprime o novo token em stdout pra ser capturado e
 *             gravado como GitHub Secret via gh CLI.
 *
 * Uso:
 *   npm run refresh-token            # atualiza .env local
 *   npm run refresh-token -- --ci    # só imprime stdout (CI)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');
loadDotenv({ path: ENV_PATH });

const { IG_LONG_LIVED_TOKEN } = process.env;
const IG_API = 'https://graph.instagram.com';

async function refreshToken(currentToken) {
  const url = new URL(`${IG_API}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', currentToken);
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`IG ${json.error.code}: ${json.error.message}`);
  if (!json.access_token) throw new Error('Resposta sem access_token');
  return json;
}

async function updateEnvFile(newToken) {
  const raw = await readFile(ENV_PATH, 'utf-8');
  const updated = raw.replace(
    /^IG_LONG_LIVED_TOKEN=.*$/m,
    `IG_LONG_LIVED_TOKEN=${newToken}`
  );
  if (updated === raw) {
    throw new Error('Linha IG_LONG_LIVED_TOKEN= não encontrada em .env');
  }
  await writeFile(ENV_PATH, updated, 'utf-8');
}

async function main() {
  const { values } = parseArgs({
    options: {
      ci: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (values.help) {
    console.log(`
TriboCRM · IG Token Refresh

Uso:
  npm run refresh-token         # local (atualiza .env)
  npm run refresh-token -- --ci # CI (imprime token em stdout)
`);
    process.exit(0);
  }

  if (!IG_LONG_LIVED_TOKEN) {
    console.error('✗ IG_LONG_LIVED_TOKEN ausente em .env');
    process.exit(1);
  }

  const result = await refreshToken(IG_LONG_LIVED_TOKEN);
  const days = Math.round((result.expires_in || 0) / 86400);

  if (values.ci) {
    // stdout: só o token (pra capturar via $(npm run refresh-token --silent -- --ci))
    console.log(result.access_token);
    console.error(`✓ Token renovado · expira em ${days} dias`);
    return;
  }

  await updateEnvFile(result.access_token);
  console.log(`✓ .env atualizado · token expira em ${days} dias`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
