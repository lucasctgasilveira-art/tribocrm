# TriboCRM — Extensão do Chrome

Extensão Manifest V3 do TriboCRM. Integra o CRM ao WhatsApp Web, LinkedIn e Gmail.

## Requisitos

- Node.js 18+
- Google Chrome (qualquer versão recente)

## Fase atual: 1 (fundação + popup)

**Pronto:**
- Estrutura completa (Vite + TypeScript + Preact)
- Service worker com roteamento de mensagens
- Cliente HTTP com auto-refresh de token
- Camada de mocks (roda sem backend)
- Popup com tela de login
- Scheduler de mensagens agendadas (chrome.alarms)
- Stubs dos content scripts (LinkedIn, Gmail, WhatsApp)

**Próxima fase:**
- Painel lateral completo do WhatsApp Web
- Extração do número do contato do DOM
- Botão "Salvar no TriboCRM" no LinkedIn
- Botão "Vincular ao TriboCRM" no Gmail

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Valores padrão já apontam para mocks — funciona sem backend.

### 3. Build

```bash
# Desenvolvimento (com source maps e watch)
npm run dev

# Produção
npm run build
```

### 4. Carregar a extensão no Chrome

1. Abra `chrome://extensions` no Chrome
2. Ative o **Modo desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `dist/` deste projeto
5. O ícone do TriboCRM aparece na barra de extensões

### 5. Testar o popup

1. Clique no ícone do TriboCRM na barra
2. Faça login com qualquer e-mail e senha (modo mock aceita tudo)
3. Deve mostrar "Conectado como [seu email]"

### 6. Testar os content scripts

Abra qualquer um dos sites:
- https://web.whatsapp.com
- https://www.linkedin.com
- https://mail.google.com

Abra o DevTools → Console. Deve aparecer: `[TriboCRM:whatsapp] Content script injetado`

No WhatsApp, um selo laranja "TriboCRM ativo" aparece por 3 segundos no canto — confirma injeção.

## Estrutura de pastas

```
extension/
├── src/
│   ├── manifest.config.ts       → Manifest V3 tipado
│   │
│   ├── background/
│   │   ├── service-worker.ts    → Orquestrador principal
│   │   ├── handlers.ts          → Lógica por tipo de mensagem
│   │   └── scheduler.ts         → Job de mensagens agendadas
│   │
│   ├── content/
│   │   ├── whatsapp.ts          → Painel lateral (stub)
│   │   ├── linkedin.ts          → Captura de leads (stub)
│   │   └── gmail.ts             → Vincular e-mail (stub)
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.tsx
│   │
│   ├── assets/
│   │   └── icon-16/48/128.png
│   │
│   └── shared/
│       ├── api/                  → HTTP + serviços por recurso
│       ├── mocks/                → Dados e implementações fake
│       ├── types/                → Contratos (domain + messages)
│       ├── utils/                → Logger, storage, phone, messaging
│       └── styles/base.css       → Design tokens TriboCRM
│
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Alternar entre mocks e API real

Em `.env.local`:

```env
# true = usa dados fake em memória (recomendado enquanto backend não está pronto)
VITE_USE_MOCKS=true

# false = chama a API real em VITE_API_BASE_URL
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000
```

Nenhum código muda — o roteador em `src/shared/api/index.ts` escolhe a implementação.

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Build em modo watch (rebuilda a cada save) |
| `npm run build` | Build de produção em `dist/` |
| `npm run typecheck` | Valida tipos sem emitir arquivos |
| `npm run zip` | Gera ZIP instalável em `tribocrm-extension.zip` |

## Debug

- **Service worker**: em `chrome://extensions`, clique em "service worker" no card da extensão — abre DevTools dedicado.
- **Popup**: clique com botão direito no ícone → "Inspecionar popup".
- **Content scripts**: DevTools da página onde o script foi injetado — logs ficam no console da aba.

Todos os logs começam com `[TriboCRM:contexto]` — use o filtro do console para isolar.

## Padrões adotados

- **Manifest V3** (obrigatório — V2 descontinuado)
- **Preact + htm** para UI leve (3 kB total)
- **CRXJS + Vite** para build com hot-reload
- **TypeScript estrito** (sem `any` implícito, sem unused vars)
- **Cores e tipografia** conforme doc 11 — Guia de Identidade Visual
- **Endpoints** conforme doc 10 — Documentação da API
