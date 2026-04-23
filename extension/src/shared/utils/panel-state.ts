/**
 * Estado aberto/fechado do painel — persistência em chrome.storage.local.
 * Default (primeira vez sem valor salvo): true, painel começa aberto.
 *
 * Segue o mesmo padrão de theme.ts.
 */

const STORAGE_KEY = 'panelOpen';

export async function getPanelOpen(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (typeof stored === 'boolean') return stored;
  } catch {
    // ignora falha de storage — cai no default
  }
  return true;
}

export async function setPanelOpen(open: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: open });
}
