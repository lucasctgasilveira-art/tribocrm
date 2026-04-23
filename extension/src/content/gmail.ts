/**
 * Content script do Gmail — STUB.
 *
 * TODO: este stub NÃO está ativo no manifest (removido antes da
 * publicação na Chrome Web Store porque ainda não faz nada útil).
 * Para reativar: re-adicionar entrada em content_scripts no
 * src/manifest.config.ts e restaurar matches em web_accessible_resources.
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
