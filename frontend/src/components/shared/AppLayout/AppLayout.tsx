import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Topbar from '../Topbar/Topbar'
import Sidebar, { type SidebarEntry, SIDEBAR_EXPANDED_W, SIDEBAR_COLLAPSED_W } from '../Sidebar/Sidebar'
import PopupManager, { type PopupData } from '../PopupManager/PopupManager'
import { fetchActivePopups } from '../../../services/popups.service'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import OnboardingWizard from '../OnboardingWizard/OnboardingWizard'
import TenantStatusGate from '../../billing/TenantStatusGate'
import BillingBanner from '../../billing/BillingBanner'
import BillingOverduePopup from '../../billing/BillingOverduePopup'
import PushPermissionPrompt from '../PushPermissionPrompt/PushPermissionPrompt'

interface AppLayoutProps {
  menuItems: SidebarEntry[]
  children: ReactNode
}

export default function AppLayout({ menuItems, children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const isSuperAdmin = (() => { try { return (JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string }).role === 'SUPER_ADMIN' } catch { return false } })()

  const [popups, setPopups] = useState<PopupData[]>([])
  useEffect(() => {
    if (isSuperAdmin) return
    let mounted = true
    fetchActivePopups().then(list => { if (mounted) setPopups(list) })
    return () => { mounted = false }
  }, [isSuperAdmin])

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

  /* ─── onboarding redirect (vendedor only) ─────────────────
   * Gestor onboarding is now handled by the OnboardingWizard
   * overlay below, gated by tenant.onboardingCompleted instead
   * of the legacy localStorage flag. The vendedor flow still
   * uses the old full-page redirect until it gets the same
   * treatment. */
  useEffect(() => {
    const skip = new URLSearchParams(location.search).get('skip') === 'true'
    if (skip) return

    const path = location.pathname
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
    <TenantStatusGate>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Topbar onOpenSearch={openSearch} />
        <Sidebar menuItems={menuItems} />
        <main style={{ marginLeft: sidebarW, paddingTop: 60, transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
          <BillingBanner />
          <div style={{ padding: 24, minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
            {children}
          </div>
        </main>
        {!isSuperAdmin && popups.length > 0 && <PopupManager popups={popups} />}
        {!isSuperAdmin && <BillingOverduePopup />}
        <GlobalSearch open={searchOpen} onClose={closeSearch} />
        {/* Gestor first-access wizard. Self-gates on role (MANAGER/OWNER)
            and tenant.onboardingCompleted === false — renders null for
            everyone else, so mounting it unconditionally here is safe. */}
        <OnboardingWizard />
        {/* Pre-prompt de Web Push. Self-gates: só aparece se navegador
            suporta + permissão 'default' + nunca perguntou ou já se
            passaram 7 dias. Não mostra pra Super Admin (não recebe
            os 3 eventos: lead atribuído, tarefa vencendo, desconto). */}
        {!isSuperAdmin && <PushPermissionPrompt />}
      </div>
    </TenantStatusGate>
  )
}
