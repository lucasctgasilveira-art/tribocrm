/**
 * Cliente HTTP da extensão.
 *
 * Responsabilidades:
 *   1. Anexar Bearer token em toda requisição.
 *   2. Ao receber 401, tentar refresh UMA vez e reexecutar a requisição.
 *   3. Desembrulhar o envelope { success, data } da API TriboCRM.
 *   4. Expor erros como exceções tipadas (ApiHttpError).
 *
 * Este módulo é usado SOMENTE dentro do service worker.
 * Content scripts NÃO chamam API direto — eles passam pelo service worker.
 * Motivo: CORS, cookies de domínio, e centralização do token.
 */

import type { ApiResponse } from '@shared/types/domain';
import { storage } from '@shared/utils/storage';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('http');

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.tribocrm.com.br';

// ── Erros tipados ────────────────────────────────────────────────

export class ApiHttpError extends Error {
  constructor(
    public status: number,
    public apiMessage: string,
    public endpoint: string
  ) {
    super(`[${status}] ${endpoint}: ${apiMessage}`);
    this.name = 'ApiHttpError';
  }
}

export class NetworkError extends Error {
  constructor(public endpoint: string, cause: unknown) {
    super(`Falha de rede em ${endpoint}`);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Sessão expirada — faça login novamente');
    this.name = 'UnauthorizedError';
  }
}

// ── Mutex para refresh concorrente ───────────────────────────────

/**
 * Se duas requests falharem com 401 ao mesmo tempo, queremos apenas UM refresh.
 * Este promise compartilhado resolve o race condition.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const auth = await storage.get('auth');
    if (!auth?.refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });

      if (!res.ok) {
        log.warn('Refresh falhou', res.status);
        await storage.set('auth', null);
        return null;
      }

      const body = (await res.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }>;

      if (!body.success) {
        await storage.set('auth', null);
        return null;
      }

      await storage.set('auth', {
        ...auth,
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        expiresAt: body.data.expiresAt
      });

      log.info('Token renovado');
      return body.data.accessToken;
    } catch (error) {
      log.error('Erro no refresh', error);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ── Request principal ────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Se true, não tenta refresh em 401 (usado pelo próprio login). */
  skipAuth?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, skipAuth = false } = options;

  // Monta URL com query string
  const url = new URL(endpoint, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      return await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      throw new NetworkError(endpoint, err);
    }
  };

  // Primeira tentativa
  const auth = skipAuth ? null : await storage.get('auth');
  let response = await doFetch(auth?.accessToken ?? null);

  // 401 → tenta refresh UMA vez
  if (response.status === 401 && !skipAuth) {
    log.debug('401 recebido, tentando refresh', endpoint);
    const newToken = await refreshAccessToken();
    if (!newToken) throw new UnauthorizedError();
    response = await doFetch(newToken);
    if (response.status === 401) throw new UnauthorizedError();
  }

  // Parse do corpo
  let parsed: ApiResponse<T>;
  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiHttpError(response.status, 'Resposta inválida do servidor', endpoint);
  }

  if (!response.ok || !parsed.success) {
    const errMsg = !parsed.success ? parsed.error : `HTTP ${response.status}`;
    throw new ApiHttpError(response.status, errMsg, endpoint);
  }

  return parsed.data;
}

// ── Interface pública ────────────────────────────────────────────

export const http = {
  get: <T>(endpoint: string, query?: RequestOptions['query']) =>
    request<T>(endpoint, { method: 'GET', query }),

  post: <T>(endpoint: string, body?: unknown, opts?: { skipAuth?: boolean }) =>
    request<T>(endpoint, { method: 'POST', body, skipAuth: opts?.skipAuth }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
};
