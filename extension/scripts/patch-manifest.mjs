import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Pós-build: injeta o content_script do WhatsApp (buildado separadamente
// como IIFE monolítico em dist/assets/whatsapp.js) no dist/manifest.json,
// e remove do web_accessible_resources os chunks antigos que o CRXJS tinha
// gerado quando o whatsapp estava no manifest declarativo.

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'dist/manifest.json');
const bundlePath = resolve(root, 'dist/assets/whatsapp.js');

if (!existsSync(manifestPath)) {
  console.error('[patch-manifest] dist/manifest.json não existe. Rode `vite build` antes.');
  process.exit(1);
}
if (!existsSync(bundlePath)) {
  console.error('[patch-manifest] dist/assets/whatsapp.js não existe. Rode `vite build -c vite.config.whatsapp.ts` antes.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

manifest.content_scripts = manifest.content_scripts ?? [];

const alreadyPatched = manifest.content_scripts.some(
  (cs) => Array.isArray(cs.js) && cs.js.includes('assets/whatsapp.js')
);
if (!alreadyPatched) {
  manifest.content_scripts.unshift({
    matches: ['https://web.whatsapp.com/*'],
    js: ['assets/whatsapp.js'],
    run_at: 'document_idle',
    all_frames: false
  });
}

// Remove entradas órfãs de web_accessible_resources que apontavam pros
// chunks do whatsapp gerados pelo CRXJS no build anterior (se a pasta dist
// não foi limpa). Critério: entry cujo `matches` é só whatsapp E cujos
// `resources` são todos chunks do whatsapp.ts/hooks.module/messaging.
const isOrphanWhatsappWar = (war) =>
  Array.isArray(war.matches) &&
  war.matches.length === 1 &&
  war.matches[0] === 'https://web.whatsapp.com/*' &&
  Array.isArray(war.resources) &&
  war.resources.length > 0 &&
  war.resources.every((r) =>
    /^assets\/(whatsapp\.ts|hooks\.module|messaging)[-.]/.test(r)
  );

manifest.web_accessible_resources = (manifest.web_accessible_resources ?? []).filter(
  (war) => !isOrphanWhatsappWar(war)
);

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[patch-manifest] WhatsApp content script wired as assets/whatsapp.js (monolithic IIFE)');
