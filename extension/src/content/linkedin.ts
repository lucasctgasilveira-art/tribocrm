/**
 * Content script do LinkedIn — STUB.
 *
 * Será implementado depois. Por enquanto apenas loga para confirmar injeção.
 *
 * Próxima fase: botão "Salvar no TriboCRM" em perfis de pessoas,
 * extraindo nome, cargo, empresa do DOM.
 *
 * Logger inline por design — ver nota em whatsapp.ts sobre por que
 * content scripts não compartilham módulos.
 */

export {}; // força arquivo a ser módulo (evita colisão de escopo global)

const log = {
  info: (...args: unknown[]) =>
    console.log('%c[TriboCRM:linkedin]', 'color: #3b82f6', ...args)
};

log.info('Content script injetado');
