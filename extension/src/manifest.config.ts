import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'TriboCRM',
  short_name: 'TriboCRM',
  description:
    'Painel lateral no WhatsApp Web, captura de leads no LinkedIn e integração com Gmail — TriboCRM',
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

  // Content scripts — injetados automaticamente nos sites-alvo.
  // O content script do WhatsApp NÃO é declarado aqui: ele é buildado
  // separadamente (vite.config.whatsapp.ts) como IIFE monolítico e
  // injetado no manifest pelo scripts/patch-manifest.mjs no pós-build.
  content_scripts: [
    {
      matches: ['https://www.linkedin.com/*'],
      js: ['src/content/linkedin.ts'],
      run_at: 'document_idle'
    },
    {
      matches: ['https://mail.google.com/*'],
      js: ['src/content/gmail.ts'],
      run_at: 'document_idle'
    }
  ],

  // Recursos acessíveis via URL (fontes, ícones, assets dentro do painel)
  web_accessible_resources: [
    {
      resources: ['src/assets/*', 'src/shared/styles/*', 'src/panel/*'],
      matches: [
        'https://web.whatsapp.com/*',
        'https://www.linkedin.com/*',
        'https://mail.google.com/*'
      ]
    }
  ],

  // Permissões: pedimos o MÍNIMO possível (Google revisa isso)
  permissions: [
    'storage', // chrome.storage.local para token/cache
    'alarms', // verificação periódica de mensagens agendadas
    'notifications' // notificações de falha de envio
  ],

  // Domínios que a extensão acessa via fetch
  host_permissions: [
    'https://api.tribocrm.com.br/*',
    'http://localhost:3000/*' // dev
  ],

  // CSP — Manifest V3 proíbe inline scripts e eval
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';"
  }
});
