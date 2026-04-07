import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Topbar from '../Topbar/Topbar'
import Sidebar, { type SidebarEntry, SIDEBAR_EXPANDED_W, SIDEBAR_COLLAPSED_W } from '../Sidebar/Sidebar'
import PopupManager, { type PopupData } from '../PopupManager/PopupManager'
import GlobalSearch from '../GlobalSearch/GlobalSearch'

interface AppLayoutProps {
  menuItems: SidebarEntry[]
  children: ReactNode
}

const mockPopups: PopupData[] = [
  {
    id: 'pop-welcome',
    type: 'WELCOME',
    title: 'Bem-vindo ao TriboCRM! \u{1F389}',
    message: 'Seu sistema está configurado e pronto para uso. Comece cadastrando seus primeiros leads no pipeline.',
    ctaLabel: 'Começar agora',
    ctaUrl: '/gestao/leads',
    targetInstance: 'BOTH',
    frequency: 'ONCE_PER_USER',
    priority: 2,
  },
  {
    id: 'pop-news',
    type: 'NEWS',
    title: 'Novidade — Pipeline Kanban v2',
    message: 'Conheça as melhorias do nosso Pipeline: headers coloridos, drag and drop melhorado e drawer do lead completo.',
    ctaLabel: 'Ver novidades',
    ctaUrl: '/gestao/pipeline',
    targetInstance: 'INSTANCE_2',
    frequency: 'ONCE_PER_USER',
    priority: 2,
  },
  {
    id: 'pop-promo',
    type: 'PROMO',
    title: 'Upgrade para Pro com 15% OFF',
    message: 'Aproveite nossa promoção de abril e faça upgrade para o Plano Pro com desconto especial.',
    ctaLabel: 'Ver oferta',
    ctaUrl: '/gestao/assinatura',
    targetInstance: 'INSTANCE_2',
    frequency: 'ONCE_PER_DAY',
    priority: 2,
  },
]

export default function AppLayout({ menuItems, children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const isSuperAdmin = (() => { try { return (JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string }).role === 'SUPER_ADMIN' } catch { return false } })()

  /* Ctrl+K / Cmd+K */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const [sidebarW, setSidebarW] = useState(() =>
    localStorage.getItem('tribocrm_sidebar_collapsed') === 'true' ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W
  )

  /* ─── onboarding redirect ─── */
  useEffect(() => {
    const skip = new URLSearchParams(location.search).get('skip') === 'true'
    if (skip) return

    const path = location.pathname
    if (path.startsWith('/gestao') && !path.includes('/onboarding')) {
      if (!localStorage.getItem('tribocrm_onboarding_done')) {
        navigate('/gestao/onboarding', { replace: true })
      }
    }
    if (path.startsWith('/vendas') && !path.includes('/onboarding')) {
      if (!localStorage.getItem('tribocrm_vendedor_onboarding_done')) {
        navigate('/vendas/onboarding', { replace: true })
      }
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    function onToggle(e: Event) {
      const collapsed = (e as CustomEvent).detail?.collapsed as boolean
      setSidebarW(collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W)
    }
    window.addEventListener('sidebar-toggle', onToggle)
    return () => window.removeEventListener('sidebar-toggle', onToggle)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Topbar onOpenSearch={openSearch} />
      <Sidebar menuItems={menuItems} />
      <main style={{ marginLeft: sidebarW, paddingTop: 60, transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: 24, minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          {children}
        </div>
      </main>
      {!isSuperAdmin && <PopupManager popups={mockPopups} />}
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </div>
  )
}
