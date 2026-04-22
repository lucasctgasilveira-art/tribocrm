/**
 * Aceite de Termos de Uso e Política de Privacidade.
 *
 * Persistência em chrome.storage.local (chave 'onboardingAcceptedVersion').
 * A versão atual é bumpada manualmente quando os documentos mudam — o
 * onboarding reaparece pra todos os usuários pedindo re-aceite.
 *
 * Segue o mesmo padrão de theme.ts e panel-state.ts.
 */

export const CURRENT_VERSION = '2026-04-22';

export const TERMS_URL = 'https://www.tribocrm.com.br/legal/extensao-termos.html';
export const PRIVACY_URL = 'https://www.tribocrm.com.br/legal/extensao-privacidade.html';
export const PURPOSE_URL = 'https://www.tribocrm.com.br/legal/extensao-proposito.html';

const STORAGE_KEY = 'onboardingAcceptedVersion';

export async function getAcceptedVersion(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (typeof stored === 'string') return stored;
  } catch {
    // ignora falha de storage — cai no fallback
  }
  return null;
}

export async function setAcceptedVersion(version: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: version });
}

export async function hasAcceptedCurrentVersion(): Promise<boolean> {
  const accepted = await getAcceptedVersion();
  return accepted === CURRENT_VERSION;
}
