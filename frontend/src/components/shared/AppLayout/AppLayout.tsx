import { useState, useEffect, type ReactNode } from 'react'
import Topbar from '../Topbar/Topbar'
import Sidebar, { type SidebarEntry, SIDEBAR_EXPANDED_W, SIDEBAR_COLLAPSED_W } from '../Sidebar/Sidebar'

interface AppLayoutProps {
  menuItems: SidebarEntry[]
  children: ReactNode
}

export default function AppLayout({ menuItems, children }: AppLayoutProps) {
  const [sidebarW, setSidebarW] = useState(() =>
    localStorage.getItem('tribocrm_sidebar_collapsed') === 'true' ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W
  )

  useEffect(() => {
    function onToggle(e: Event) {
      const collapsed = (e as CustomEvent).detail?.collapsed as boolean
      setSidebarW(collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W)
    }
    window.addEventListener('sidebar-toggle', onToggle)
    return () => window.removeEventListener('sidebar-toggle', onToggle)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f' }}>
      <Topbar />
      <Sidebar menuItems={menuItems} />
      <main style={{ marginLeft: sidebarW, paddingTop: 60, transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: 24, minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
