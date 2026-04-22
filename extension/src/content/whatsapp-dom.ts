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
 * Estado detectado da conversa ativa no WhatsApp Web.
 *
 *   - 'none'         → nenhuma conversa aberta (ou não foi possível detectar)
 *   - 'detected'     → conversa aberta com telefone identificado automaticamente
 *   - 'needs-phone'  → conversa aberta mas o WhatsApp não expõe o telefone no DOM
 *                      (contato salvo na agenda). Usuário precisa digitar.
 */
export type ChatInfo =
  | { kind: 'none' }
  | { kind: 'detected'; contact: WhatsAppContactInfo }
  | { kind: 'needs-phone'; detectedName: string };

/**
 * Extrai o número de telefone da conversa aberta atualmente.
 *
 * ESTRATÉGIA (ordem de tentativa):
 *   A. data-id puramente numérico (10–15 dígitos) em qualquer elemento da página.
 *      O WhatsApp deixou de usar o sufixo "@c.us" — agora o data-id do contato
 *      é só o telefone. Cuidado: existem data-ids curtos ("1", "2", …) que são
 *      IDs internos de outros widgets; por isso o filtro de comprimento é crítico.
 *   B. Nome do contato (header) que PARECE um telefone formatado — fallback
 *      útil quando o contato não está salvo na agenda.
 *
 * @returns string E.164 sem '+' ou null se não conseguir extrair
 */
export function extractPhoneFromActiveChat(): string | null {
  // Seletores validados em 21/04/2026
  // Estratégia A: varrer todos os data-id e pegar o primeiro que seja
  // string puramente numérica de 10–15 caracteres (telefone E.164 sem '+').
  const nodes = document.querySelectorAll('[data-id]');
  for (const node of Array.from(nodes)) {
    const dataId = node.getAttribute('data-id');
    if (dataId && /^\d{10,15}$/.test(dataId)) {
      return dataId;
    }
  }

  // Estratégia B: elemento dedicado ao título do chat. Contato não salvo
  // aparece aqui como "+55 33 99900-1821" — ou seja, o "nome" É o telefone.
  // Validado em 21/04/2026
  const titleEl = document.querySelector<HTMLElement>(
    '[data-testid="conversation-info-header-chat-title"]'
  );
  const chatTitle = titleEl?.textContent?.trim();
  if (chatTitle) {
    const normalized = normalizeIfPhoneLike(chatTitle);
    if (normalized) return normalized;
  }

  // Estratégia C: varredura mais ampla do header (fallback).
  const headerTitle = findChatHeaderTitle();
  if (headerTitle) {
    const normalized = normalizeIfPhoneLike(headerTitle);
    if (normalized) return normalized;
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

/**
 * Classifica o estado da conversa ativa no WhatsApp Web lendo o DOM atual.
 * Fonte única de verdade — usada tanto em leituras avulsas quanto pelo
 * observer em onActiveChatChange.
 */
export function classifyActiveChat(): ChatInfo {
  const phone = extractPhoneFromActiveChat();
  if (phone) {
    const displayName = extractDisplayNameFromActiveChat() ?? phone;
    return { kind: 'detected', contact: { displayName, phone } };
  }
  const displayName = extractDisplayNameFromActiveChat();
  if (displayName) return { kind: 'needs-phone', detectedName: displayName };
  return { kind: 'none' };
}

/**
 * Chave estável por estado de conversa — usada para deduplicar dispatches
 * do observer. Duas leituras com a mesma chave representam o mesmo estado.
 */
function chatInfoKey(info: ChatInfo): string {
  switch (info.kind) {
    case 'none':
      return 'none';
    case 'detected':
      return `detected:${info.contact.phone}`;
    case 'needs-phone':
      return `needs-phone:${info.detectedName}`;
  }
}

// ── Helpers privados ─────────────────────────────────────────────

/**
 * Se a string parece um telefone BR (começa com '+' ou dígito, 10–15 dígitos
 * após remover não-dígitos), devolve normalizado em E.164 sem '+' com prefixo
 * 55 garantido. Caso contrário, null.
 */
function normalizeIfPhoneLike(s: string): string | null {
  const digits = s.replace(/\D/g, '');
  if (
    (s.startsWith('+') || /^\d/.test(s)) &&
    digits.length >= 10 &&
    digits.length <= 15
  ) {
    return digits.startsWith('55') ? digits : `55${digits}`;
  }
  return null;
}

/**
 * Tenta várias abordagens pra achar o título do chat (nome do contato).
 *
 * Se quebrar, inspecione o <header data-testid="conversation-header"> da
 * conversa ativa no DevTools e atualize os seletores abaixo.
 */
function findChatHeaderTitle(): string | null {
  // Validado em 21/04/2026
  // Seletor principal: elemento dedicado ao título do chat.
  const titleEl = document.querySelector<HTMLElement>(
    '[data-testid="conversation-info-header-chat-title"]'
  );
  const title = titleEl?.textContent?.trim();
  if (title) return title;

  // Fallback: qualquer span com textContent no cabeçalho da conversa.
  const header = document.querySelector<HTMLElement>(
    '[data-testid="conversation-header"]'
  );
  if (!header) return null;

  const spans = header.querySelectorAll<HTMLElement>('span');
  for (const span of Array.from(spans)) {
    const text = span.textContent?.trim();
    if (text) return text;
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
 * @param callback chamado quando a conversa ativa muda, com o ChatInfo
 *                  classificado (detected / needs-phone / none).
 * @returns função para parar de observar
 */
export function onActiveChatChange(
  callback: (info: ChatInfo) => void
): () => void {
  // Sentinel — diferente de qualquer chave real de chatInfoKey(), garante
  // que a primeira leitura sempre dispara o callback (inclusive para
  // estados 'none' ou 'needs-phone', que o dedupe anterior barrava).
  let lastKey: string | null = null;
  let debounceTimer: number | null = null;

  const check = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    // Debounce porque MutationObserver dispara muito durante troca de chat.
    // Queremos esperar o DOM "estabilizar" antes de ler.
    debounceTimer = window.setTimeout(() => {
      const info = classifyActiveChat();
      const key = chatInfoKey(info);
      if (key !== lastKey) {
        lastKey = key;
        callback(info);
      }
    }, 200);
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
