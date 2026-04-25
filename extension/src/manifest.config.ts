import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

// `env.mode` vem do Vite (--mode development | --mode production).
// import.meta.env.DEV / .PROD NÃO funciona aqui: config file roda em Node,
// não é bundled. A forma-função do defineManifest é o caminho oficial.
export default defineManifest((env) => {
  const isDev = env.mode === 'development';

  return {
    manifest_version: 3,
    name: 'TriboCRM',
    short_name: 'TriboCRM',
    description: 'Painel lateral no WhatsApp Web integrado ao CRM — TriboCRM',
    version: pkg.version,

    // Ícone da extensão (aparece na barra, na Chrome Web Store e em diálogos)
    icons: {
      16: 'src/assets/icon-16.png',
      48: 'src/assets/icon-48.png',
      128: 'src/assets/icon-128.png'
    },

    // Popup que abre ao clicar no ícone da barra
    action: {
      default_popup: 'src/popup/popup.html',
      default_title: 'TriboCRM',
      default_icon: {
        16: 'src/assets/icon-16.png',
        48: 'src/assets/icon-48.png',
        128: 'src/assets/icon-128.png'
      }
    },

    // Service worker — gerencia auth, token refresh e eventos globais
    background: {
      service_worker: 'src/background/service-worker.ts',
      type: 'module'
    },

    // Content scripts declarativos: nenhum.
    // O content script do WhatsApp é buildado separadamente (vite.config.whatsapp.ts)
    // como IIFE monolítico e injetado pelo scripts/patch-manifest.mjs no pós-build.
    // Stubs de LinkedIn/Gmail foram desanexados — ver src/content/linkedin.ts e gmail.ts.
    content_scripts: [],

    // Recursos acessíveis via URL (fontes, ícones, assets dentro do painel)
    web_accessible_resources: [
      {
        resources: ['src/assets/*', 'src/shared/styles/*', 'src/panel/*'],
        matches: ['https://web.whatsapp.com/*']
      }
    ],

    // Permissões: pedimos o MÍNIMO possível (Google revisa isso)
    permissions: [
      'storage', // chrome.storage.local para token/cache
      'alarms', // verificação periódica de mensagens agendadas
      'notifications' // notificações de falha de envio
    ],

    // Domínios que a extensão acessa via fetch.
    // Em build prod: APENAS api.tribocrm.com.br.
    // Em build dev (--mode development): adiciona portas locais usadas
    // pelo desenvolvimento — backend (3002), web app (3000) e variante
    // legada usada pelo .env.development.local (3001). Lista explícita
    // pra evitar reintroduzir staging URLs hardcoded acidentalmente.
    host_permissions: [
      'https://api.tribocrm.com.br/*',
      ...(isDev ? [
        'http://localhost:3000/*',
        'http://localhost:3001/*',
        'http://localhost:3002/*'
      ] : [])
    ],

    // CSP — Manifest V3 proíbe inline scripts e eval
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';"
    }
  };
});
