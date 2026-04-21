/**
 * Logger minimalista que prefixa mensagens com o contexto de origem.
 * Facilita filtrar logs no DevTools do Chrome (onde muitos contextos logam ao mesmo tempo).
 *
 * Uso:
 *   const log = createLogger('whatsapp-panel');
 *   log.info('Lead encontrado', lead);
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444'
};

// Em produção desabilita debug. import.meta.env é injetado pelo Vite.
const IS_DEV = import.meta.env.MODE === 'development';

export function createLogger(context: string) {
  const prefix = `%c[TriboCRM:${context}]`;

  return {
    debug: (...args: unknown[]) => {
      if (IS_DEV) console.log(prefix, COLORS.debug, ...args);
    },
    info: (...args: unknown[]) => {
      console.log(prefix, COLORS.info, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, COLORS.warn, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, COLORS.error, ...args);
    }
  };
}
