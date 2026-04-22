/**
 * Gerencia a montagem/desmontagem do painel lateral no DOM do WhatsApp.
 *
 * ISOLAMENTO:
 *   - Criamos um container com ID único (#tribocrm-panel-mount) no fim do body.
 *   - Todo o CSS do painel é prefixado com .tribocrm- (ver panel.css).
 *   - O React do WhatsApp não mexe em elementos fora do seu próprio root,
 *     então nosso container fica seguro contra unmount espontâneo.
 *
 * VISIBILIDADE:
 *   O container é criado com display:none e só fica visível após o boot
 *   decidir (storage + viewport). Evita flash do painel aberto antes de
 *   a decisão ser tomada.
 */

const MOUNT_ID = 'tribocrm-panel-mount';
const STYLESHEET_ID = 'tribocrm-panel-styles';

export interface PanelMount {
  container: HTMLElement;
  setPanelVisible: (visible: boolean) => void;
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

function setContainerVisible(container: HTMLElement, visible: boolean): void {
  container.style.display = visible ? 'block' : 'none';
}

/**
 * Monta o container do painel (se ainda não estiver montado) e retorna
 * referência pra quem vai renderizar dentro (Preact, por exemplo).
 */
export function mountPanelContainer(): PanelMount {
  const existing = document.getElementById(MOUNT_ID);
  if (existing) {
    return {
      container: existing,
      setPanelVisible: (visible) => setContainerVisible(existing, visible),
      destroy: () => destroyPanel()
    };
  }

  const cssUrl = chrome.runtime.getURL('src/panel/panel.css');
  ensureStylesheet(cssUrl);

  const container = document.createElement('div');
  container.id = MOUNT_ID;
  container.style.display = 'none';
  document.body.appendChild(container);

  return {
    container,
    setPanelVisible: (visible) => setContainerVisible(container, visible),
    destroy: () => destroyPanel()
  };
}

function destroyPanel(): void {
  document.getElementById(MOUNT_ID)?.remove();
  document.getElementById(STYLESHEET_ID)?.remove();
}
