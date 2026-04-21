/**
 * Content script do Gmail — STUB.
 *
 * Será implementado depois. Por enquanto apenas loga para confirmar injeção.
 *
 * Próxima fase: botão "Vincular ao TriboCRM" dentro da conversa de e-mail.
 *
 * Logger inline por design — ver nota em whatsapp.ts sobre por que
 * content scripts não compartilham módulos.
 */

export {}; // força arquivo a ser módulo (evita colisão de escopo global)

const log = {
  info: (...args: unknown[]) =>
    console.log('%c[TriboCRM:gmail]', 'color: #3b82f6', ...args)
};

log.info('Content script injetado');
