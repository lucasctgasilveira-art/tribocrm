#!/usr/bin/env node
/**
 * Smoke test pós-build: garante que nenhum artefato de mock vazou pro
 * dist/ final. Executado automaticamente pelo `npm run build` após o
 * patch-manifest. Sai com código não-zero se encontrar qualquer
 * padrão proibido — abortando o build.
 *
 * Motivo: a v0.1.0 foi publicada com VITE_USE_MOCKS=true por engano
 * (Vite carrega .env.local em todos os modes, sobrescrevendo
 * .env.production). Este script é o fail-safe que impede que isso
 * aconteça de novo.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const FORBIDDEN_PATTERNS = [
  'mock-access-token',
  'mock-refresh-token',
  'MODO DESENVOLVIMENTO',
  'dados fictícios',
  'MODO MOCK ATIVO',
  'mockAuthService',
  'mockLeadsService',
  'mockProductsService',
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (['.js', '.html', '.css', '.json'].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(DIST);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.includes(pattern)) {
      violations.push({ file, pattern });
    }
  }
}

if (violations.length > 0) {
  console.error('\n❌ VERIFICAÇÃO FALHOU — artefatos de mock detectados no dist/:');
  for (const v of violations) {
    console.error(`  ${v.file}: contém "${v.pattern}"`);
  }
  console.error('\nBuild abortado. Verificar .env.production e .env.development.local.\n');
  process.exit(1);
}

console.log('✅ Verificação OK — nenhum artefato de mock no dist/');
