import { useState, useEffect } from 'react'
import { Bell, X, Zap, Clock, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'
import {
  shouldShowPrompt, markPromptDismissed, enablePushNotifications, isPushSupported,
} from '../../../services/push.service'

/**
 * Pre-prompt convincente pra ativar Web Push.
 *
 * Aparece automaticamente após login (com 5s de delay) se:
 *   - Navegador suporta Push API
 *   - Permissão atual = 'default' (nunca aceitou nem negou)
 *   - Nunca foi perguntado OU passaram >= 7 dias da última vez
 *
 * Copy aprovada pelo Lucas em 2026-05-04 (variação A — foco em
 * perda de oportunidade).
 *
 * Se "Mais tarde": grava timestamp em localStorage, repergunta em 7 dias.
 * Se "Ativar agora": chama enablePushNotifications() que faz todo o
 * fluxo (VAPID key + SW + permissão nativa + subscribe + POST backend).
 */

export default function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (!shouldShowPrompt()) return

    // Delay de 5s pra não atropelar a tela inicial — user pode estar
    // lendo dashboard/lista. Aparece quando ele já se acomodou.
    const t = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(t)
  }, [])

  function handleDismiss() {
    markPromptDismissed()
    setVisible(false)
  }

  async function handleEnable() {
    setSaving(true)
    setError('')
    try {
      const result = await enablePushNotifications()
      if (result === 'granted') {
        setSuccess(true)
        // Mostra confirmação por 1.5s e fecha
        setTimeout(() => setVisible(false), 1500)
      } else if (result === 'denied') {
        setError('Permissão negada. Você pode habilitar depois nas configurações do navegador.')
        setSaving(false)
      } else {
        setError('Não foi possível ativar agora. Tente novamente em alguns minutos.')
        setSaving(false)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado. Tente novamente.')
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <>
      <div onClick={handleDismiss} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9998,
        animation: 'pushFadeIn 0.25s ease-out',
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 460, maxWidth: '90vw',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16,
        zIndex: 9999,
        animation: 'pushScaleIn 0.25s ease-out',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes pushFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes pushScaleIn {
            from { opacity: 0; transform: translate(-50%,-50%) scale(0.92) }
            to   { opacity: 1; transform: translate(-50%,-50%) scale(1) }
          }
        `}</style>

        {/* Header com ícone grande */}
        <div style={{
          padding: '24px 24px 0',
          textAlign: 'center',
          position: 'relative',
        }}>
          <button onClick={handleDismiss} disabled={saving} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}>
            <X size={18} strokeWidth={1.5} />
          </button>

          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(249,115,22,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            {success ? (
              <CheckCircle2 size={32} color="#22c55e" strokeWidth={2} />
            ) : (
              <Bell size={32} color="#f97316" strokeWidth={2} />
            )}
          </div>

          {success ? (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Tudo pronto!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                Você vai receber notificações dos seus leads, tarefas e descontos.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                🔔 Não deixe nenhum lead esfriar
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                Lead quente esperando 5 minutos vira lead morno.<br />
                Lead morno esperando 1 hora vira concorrente vendendo.
              </p>
            </>
          )}
        </div>

        {!success && (
          <div style={{ padding: '16px 24px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Ative as notificações e receba aviso direto na sua tela quando:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <BenefitItem icon={Zap} color="#f97316" text="Um lead novo cair na sua mão" />
              <BenefitItem icon={Clock} color="#3b82f6" text="Uma tarefa importante estiver pra vencer" />
              <BenefitItem icon={CheckCircle2} color="#22c55e" text="Um desconto que você pediu for aprovado" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontStyle: 'italic' }}>
              Funciona mesmo com o navegador fechado.
            </p>

            {error && (
              <div style={{
                marginTop: 14, padding: '10px 12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                fontSize: 12, color: '#ef4444', lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        {!success && (
          <div style={{
            padding: '16px 24px 24px',
            display: 'flex', justifyContent: 'space-between', gap: 12,
          }}>
            <button onClick={handleDismiss} disabled={saving} style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '11px 16px',
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>
              Agora não
            </button>
            <button onClick={handleEnable} disabled={saving} style={{
              flex: 1.4,
              background: '#f97316',
              border: 'none',
              borderRadius: 10,
              padding: '11px 16px',
              fontSize: 13, fontWeight: 700,
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#fb923c' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f97316' }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Ativando...' : '⚡ Ativar agora'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function BenefitItem({ icon: Icon, color, text }: {
  icon: LucideIcon
  color: string
  text: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{text}</span>
    </div>
  )
}
