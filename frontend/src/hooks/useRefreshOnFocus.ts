import { useEffect, useRef } from 'react'

/**
 * Dispara `callback` quando a aba do navegador volta a ficar visível
 * depois de ter sido escondida por pelo menos `minHiddenMs`.
 *
 * Caso de uso: usuário muda etapa de um lead via extensão Chrome no
 * WhatsApp Web e volta pra aba do CRM. Sem isso, a kanban/lista não
 * atualiza até F5. Com isso, atualiza sozinho.
 *
 * Throttle interno (default 1s): evita disparos espúrios em alt-tab
 * rápido onde o usuário só passou o olho. Aumenta esse valor se
 * o callback for caro.
 *
 * `callback` pode mudar entre renders sem reanexar listener — guardamos
 * em ref pra sempre chamar a versão mais recente.
 */
export function useRefreshOnFocus(callback: () => void, minHiddenMs: number = 1000): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    let hiddenSince: number | null = null

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now()
        return
      }
      if (document.visibilityState === 'visible' && hiddenSince !== null) {
        const hiddenFor = Date.now() - hiddenSince
        hiddenSince = null
        if (hiddenFor >= minHiddenMs) callbackRef.current()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [minHiddenMs])
}
