/**
 * Gerencia a montagem/desmontagem do painel lateral no DOM do WhatsApp.
 *
 * ISOLAMENTO:
 *   - Criamos um container com ID único (#tribocrm-panel-mount) no fim do body.
 *   - Todo o CSS do painel é prefixado com .tribocrm- (ver panel.css).
 *   - O React do WhatsApp não mexe em elementos fora do seu próprio root,
 *     então nosso container fica seguro contra unmount espontâneo.
 */

const MOUNT_ID = 'tribocrm-panel-mount';
const STYLESHEET_ID = 'tribocrm-panel-styles';

export interface PanelMount {
  container: HTMLElement;
  destroy: () => void;
}

/**
 * Garante que o CSS do painel está injetado. Idempotente — chamar múltiplas
 * vezes não duplica.
 *
 * Usamos <link> apontando para o arquivo CSS da extensão em vez de injetar
 * como <style>. Motivo: o WhatsApp tem CSP que PODERIA bloquear inline styles
 * grandes em alguns cenários. <link> em chrome-extension:// sempre funciona.
 */
function ensureStylesheet(cssUrl: string): void {
  if (document.getElementById(STYLESHEET_ID)) return;

  const link = document.createElement('link');
  link.id = STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.appendChild(link);
}

/**
 * Monta o container do painel (se ainda não estiver montado) e retorna
 * referência pra quem vai renderizar dentro (Preact, por exemplo).
 */
export function mountPanelContainer(): PanelMount {
  // Se já existe, apenas retorna a referência existente
  const existing = document.getElementById(MOUNT_ID);
  if (existing) {
    return {
      container: existing,
      destroy: () => destroyPanel()
    };
  }

  // Injeta o CSS
  const cssUrl = chrome.runtime.getURL('src/panel/panel.css');
  ensureStylesheet(cssUrl);

  // Cria o container no fim do body
  const container = document.createElement('div');
  container.id = MOUNT_ID;
  document.body.appendChild(container);

  return {
    container,
    destroy: () => destroyPanel()
  };
}

function destroyPanel(): void {
  document.getElementById(MOUNT_ID)?.remove();
  document.getElementById(STYLESHEET_ID)?.remove();
}
