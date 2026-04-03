import { type ReactNode } from 'react'
import Topbar from '../Topbar/Topbar'
import Sidebar, { type SidebarEntry } from '../Sidebar/Sidebar'

interface AppLayoutProps {
  menuItems: SidebarEntry[]
  children: ReactNode
}

export default function AppLayout({ menuItems, children }: AppLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f' }}>
      <Topbar />
      <Sidebar menuItems={menuItems} />
      <main style={{ marginLeft: 220, paddingTop: 60 }}>
        <div style={{ padding: 24, minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
