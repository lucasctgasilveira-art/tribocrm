/**
 * Tema claro/escuro do painel do TriboCRM.
 *
 * Persistência em chrome.storage.local (chave 'theme'). Primeira carga
 * usa prefers-color-scheme do sistema; depois preserva escolha manual.
 * Sincronização com conta do TriboCRM fica para etapa futura.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

export async function getInitialTheme(): Promise<Theme> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignora falha de storage — cai no fallback
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'dark';
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: theme });
}

export function applyTheme(theme: Theme, root?: HTMLElement): void {
  const target = root ?? document.documentElement;
  target.setAttribute('data-theme', theme);
}
