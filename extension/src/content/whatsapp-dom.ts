/**
 * Extração de informações do DOM do WhatsApp Web.
 *
 * ATENÇÃO: este é o ARQUIVO MAIS FRÁGIL da extensão.
 * O WhatsApp muda seletores sem aviso. Se o painel quebrar, 90% das
 * vezes o problema está aqui.
 *
 * ESTRATÉGIA DE RESILIÊNCIA:
 *   1. Múltiplos seletores em cascata (semântico → estrutural → classe)
 *   2. Fallback gracioso (retorna null se não encontrar em vez de lançar)
 *   3. Cada função tem UM propósito para isolar mudanças
 *   4. Testes manuais documentados nos comentários
 */

export interface WhatsAppContactInfo {
  /** Nome exibido no header da conversa */
  displayName: string;
  /** Número de telefone em formato E.164 sem '+' (ex: 5521912345678) */
  phone: string;
}

/**
 * Extrai o número de telefone da conversa aberta atualmente.
 *
 * ESTRATÉGIA (ordem de tentativa):
 *   A. Se for uma conversa individual, o WhatsApp às vezes expõe o número
 *      em atributo data-id tipo "5521912345678@c.us" no container da conversa.
 *   B. Link telefônico no header (mais confiável quando o contato não tem nome salvo).
 *   C. Nome do contato que PARECE um telefone formatado (fallback final).
 *
 * @returns string E.164 sem '+' ou null se não conseguir extrair
 */
export function extractPhoneFromActiveChat(): string | null {
  // Estratégia A: data-id do container da conversa
  // Exemplo: <div data-id="5521912345678@c.us" ...>
  const chatContainer = document.querySelector('[data-id$="@c.us"]');
  if (chatContainer) {
    const dataId = chatContainer.getAttribute('data-id');
    const match = dataId?.match(/^(\d{10,15})@c\.us$/);
    if (match) return match[1];
  }

  // Estratégia B: header do chat contém o nome. Se o nome é um número formatado,
  // é porque o contato não está salvo — então o "nome" É o telefone.
  const headerTitle = findChatHeaderTitle();
  if (headerTitle) {
    const digits = headerTitle.replace(/\D/g, '');
    // Tem que ter de 10 a 15 dígitos e começar com '+' no texto visual
    if (
      (headerTitle.startsWith('+') || /^\d/.test(headerTitle)) &&
      digits.length >= 10 &&
      digits.length <= 15
    ) {
      return digits.startsWith('55') ? digits : `55${digits}`;
    }
  }

  return null;
}

/**
 * Pega o nome exibido no header da conversa.
 * Usado para pré-preencher o formulário de "criar novo lead".
 */
export function extractDisplayNameFromActiveChat(): string | null {
  return findChatHeaderTitle();
}

/**
 * Combina os dois — retorna nome + telefone se ambos existirem.
 */
export function extractContactInfoFromActiveChat(): WhatsAppContactInfo | null {
  const phone = extractPhoneFromActiveChat();
  if (!phone) return null;

  const displayName = extractDisplayNameFromActiveChat() ?? phone;
  return { displayName, phone };
}

// ── Helpers privados ─────────────────────────────────────────────

/**
 * Tenta várias abordagens pra achar o título do chat (nome do contato).
 *
 * Seletores testados em Abril 2026. Se quebrar, inspecione o header da conversa
 * no DevTools e atualize a lista aqui — é a única mudança necessária.
 */
function findChatHeaderTitle(): string | null {
  const selectors = [
    // Cabeçalho do chat — painel superior
    'header [data-testid="conversation-info-header"] span[title]',
    'header span[dir="auto"][title]',
    '#main header span[title]',
    // Fallback: primeiro span com title no topo do #main
    '#main header span[dir="auto"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    const text = el?.getAttribute('title') ?? el?.textContent?.trim();
    if (text && text.length > 0) return text;
  }

  return null;
}

/**
 * Observa mudanças de conversa ativa.
 *
 * Por que MutationObserver e não navigation event?
 *   WhatsApp é SPA: não dispara 'navigate' ao trocar de chat. A única forma
 *   confiável é observar o DOM. Observamos o container principal (#main)
 *   que é recriado ao trocar de chat.
 *
 * @param callback chamado quando a conversa ativa muda. Recebe null se
 *                  nenhuma conversa estiver aberta.
 * @returns função para parar de observar
 */
export function onActiveChatChange(
  callback: (info: WhatsAppContactInfo | null) => void
): () => void {
  let lastPhone: string | null = null;
  let debounceTimer: number | null = null;

  const check = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    // Debounce porque MutationObserver dispara muito durante troca de chat.
    // Queremos esperar o DOM "estabilizar" antes de ler.
    debounceTimer = window.setTimeout(() => {
      const info = extractContactInfoFromActiveChat();
      const currentPhone = info?.phone ?? null;
      if (currentPhone !== lastPhone) {
        lastPhone = currentPhone;
        callback(info);
      }
    }, 250);
  };

  // Observa o body todo (light — apenas childList e attributes).
  // Observar subtree com characterData pegaria mudanças excessivas de mensagem.
  const observer = new MutationObserver(check);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  // Primeira leitura imediata, caso já haja um chat aberto
  check();

  return () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    observer.disconnect();
  };
}

/**
 * Retorna true se o WhatsApp Web já carregou totalmente
 * (QR code escaneado, lista de conversas visível).
 */
export function isWhatsAppReady(): boolean {
  // #side é o painel esquerdo (lista de conversas).
  // Só existe depois do login.
  return document.querySelector('#side') !== null;
}

/**
 * Espera o WhatsApp Web estar pronto (usuário logado).
 * Resolve imediatamente se já estiver pronto.
 */
export function waitForWhatsAppReady(): Promise<void> {
  return new Promise((resolve) => {
    if (isWhatsAppReady()) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (isWhatsAppReady()) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}
