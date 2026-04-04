import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle, Wrench, Bell, Tag, MessageSquare, PartyPopper,
  X, type LucideIcon,
} from 'lucide-react'

// ── Types ──

export type PopupType = 'OVERDUE' | 'MAINTENANCE' | 'NEWS' | 'PROMO' | 'SURVEY' | 'WELCOME'
export type PopupFrequency = 'ALWAYS_LOGIN' | 'ONCE_PER_SESSION' | 'ONCE_PER_DAY' | 'ONCE_PER_WEEK' | 'ONCE_PER_USER'
export type PopupTarget = 'INSTANCE_2' | 'INSTANCE_3' | 'BOTH'

export interface PopupData {
  id: string
  type: PopupType
  title: string
  message: string
  ctaLabel?: string
  ctaUrl?: string
  targetInstance: PopupTarget
  frequency: PopupFrequency
  priority: 1 | 2
}

interface Props {
  popups: PopupData[]
}

// ── Config ──

const typeConfig: Record<PopupType, { icon: LucideIcon; color: string; headerBg: string }> = {
  OVERDUE: { icon: AlertCircle, color: '#ef4444', headerBg: 'rgba(239,68,68,0.08)' },
  MAINTENANCE: { icon: Wrench, color: '#f59e0b', headerBg: 'rgba(245,158,11,0.08)' },
  NEWS: { icon: Bell, color: '#3b82f6', headerBg: 'rgba(59,130,246,0.08)' },
  PROMO: { icon: Tag, color: '#f97316', headerBg: 'rgba(249,115,22,0.08)' },
  SURVEY: { icon: MessageSquare, color: '#a855f7', headerBg: 'rgba(168,85,247,0.08)' },
  WELCOME: { icon: PartyPopper, color: '#22c55e', headerBg: 'rgba(34,197,94,0.08)' },
}

const targetLabels: Record<PopupTarget, { label: string; color: string; bg: string }> = {
  INSTANCE_2: { label: 'Gestor', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  INSTANCE_3: { label: 'Vendedor', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  BOTH: { label: 'Gestor + Vendedor', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
}

const LS_KEY = 'tribocrm_popups_shown'
const SS_KEY = 'tribocrm_popups_session'

function getShownIds(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function markShown(id: string) {
  const ids = getShownIds()
  if (!ids.includes(id)) { ids.push(id); localStorage.setItem(LS_KEY, JSON.stringify(ids)) }
}
function getSessionIds(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '[]') } catch { return [] }
}
function markSession(id: string) {
  const ids = getSessionIds()
  if (!ids.includes(id)) { ids.push(id); sessionStorage.setItem(SS_KEY, JSON.stringify(ids)) }
}

function getDayKey() { return new Date().toISOString().slice(0, 10) }
function getWeekKey() { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)).toISOString().slice(0, 10) }

function shouldShow(popup: PopupData): boolean {
  const shownIds = getShownIds()
  const sessionIds = getSessionIds()

  switch (popup.frequency) {
    case 'ALWAYS_LOGIN': return true
    case 'ONCE_PER_SESSION': return !sessionIds.includes(popup.id)
    case 'ONCE_PER_DAY': {
      const key = `tribocrm_popup_day_${popup.id}`
      return localStorage.getItem(key) !== getDayKey()
    }
    case 'ONCE_PER_WEEK': {
      const key = `tribocrm_popup_week_${popup.id}`
      return localStorage.getItem(key) !== getWeekKey()
    }
    case 'ONCE_PER_USER': return !shownIds.includes(popup.id)
  }
}

function recordShown(popup: PopupData) {
  markSession(popup.id)
  switch (popup.frequency) {
    case 'ONCE_PER_USER': markShown(popup.id); break
    case 'ONCE_PER_DAY': localStorage.setItem(`tribocrm_popup_day_${popup.id}`, getDayKey()); break
    case 'ONCE_PER_WEEK': localStorage.setItem(`tribocrm_popup_week_${popup.id}`, getWeekKey()); break
  }
}

const CSS = `
  @keyframes popFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes popScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
`

// ── Component ──

export default function PopupManager({ popups }: Props) {
  const [queue, setQueue] = useState<PopupData[]>([])
  const [current, setCurrent] = useState<PopupData | null>(null)

  useEffect(() => {
    const priority1 = popups.filter(p => p.priority === 1 && shouldShow(p))
    const priority2 = popups.filter(p => p.priority === 2 && shouldShow(p))

    if (priority1.length > 0) {
      setCurrent(priority1[0]!)
      setQueue([...priority1.slice(1), ...priority2])
    } else if (priority2.length > 0) {
      // Show first after 3s delay
      const timer = setTimeout(() => {
        if (shouldShow(priority2[0]!)) {
          setCurrent(priority2[0]!)
          setQueue(priority2.slice(1))
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [popups])

  const dismiss = useCallback(() => {
    if (current) recordShown(current)
    setCurrent(null)

    // Show next from queue after delay
    if (queue.length > 0) {
      const next = queue[0]!
      const rest = queue.slice(1)
      const delay = next.priority === 1 ? 500 : 10000
      setTimeout(() => {
        if (shouldShow(next)) {
          setCurrent(next)
          setQueue(rest)
        }
      }, delay)
    }
  }, [current, queue])

  if (!current) return null

  const tc = typeConfig[current.type]
  const Icon = tc.icon
  const target = targetLabels[current.targetInstance]
  const totalInQueue = queue.length + 1

  return (
    <>
      <style>{CSS}</style>
      <div onClick={dismiss} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 70, animation: 'popFadeIn 0.2s ease-out' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '90vw', background: '#161a22', border: '1px solid #22283a', borderRadius: 16, zIndex: 71, overflow: 'hidden', animation: 'popScaleIn 0.2s ease-out' }}>

        {/* Header */}
        <div style={{ background: tc.headerBg, padding: '20px 24px', borderBottom: '1px solid #22283a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ background: target.bg, color: target.color, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{target.label}</span>
            <Icon size={20} color={tc.color} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{current.title}</h2>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <p style={{ fontSize: 14, color: '#e8eaf0', lineHeight: 1.6, margin: 0 }}>{current.message}</p>
          {current.type === 'OVERDUE' && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>Acesso completo bloqueado em 5 dias se não regularizado.</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #22283a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {totalInQueue > 1 ? `Exibindo 1 de ${totalInQueue}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={dismiss} style={{ background: 'transparent', border: '1px solid #22283a', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>
              <X size={14} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: 'middle' }} />Fechar
            </button>
            {current.ctaLabel && (
              <button onClick={() => { if (current.ctaUrl) window.location.href = current.ctaUrl; dismiss() }} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {current.ctaLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
