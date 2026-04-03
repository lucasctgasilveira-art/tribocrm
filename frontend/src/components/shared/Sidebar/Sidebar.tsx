import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun, ChevronDown, ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react'

// ── Types ──

export interface MenuSubItem { label: string; path: string }
export interface MenuItem { label: string; icon: LucideIcon; path: string; children?: MenuSubItem[]; badge?: string; badgeColor?: string }
export interface SectionHeader { section: string }
export type SidebarEntry = MenuItem | 'separator' | SectionHeader

function isSection(e: SidebarEntry): e is SectionHeader { return typeof e === 'object' && 'section' in e }
function isMenuItem(e: SidebarEntry): e is MenuItem { return typeof e === 'object' && 'icon' in e }

export const SIDEBAR_EXPANDED_W = 220
export const SIDEBAR_COLLAPSED_W = 56
const LS_KEY = 'tribocrm_sidebar_collapsed'

interface SidebarProps { menuItems: SidebarEntry[] }

const CSS = `
  .sidebar-nav::-webkit-scrollbar{width:4px}
  .sidebar-nav::-webkit-scrollbar-track{background:transparent}
  .sidebar-nav::-webkit-scrollbar-thumb{background:transparent;border-radius:4px}
  .sidebar-nav:hover::-webkit-scrollbar-thumb{background:#22283a}
  .sidebar-nav{scrollbar-width:thin;scrollbar-color:transparent transparent}
  .sidebar-nav:hover{scrollbar-color:#22283a transparent}
`

export default function Sidebar({ menuItems }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(LS_KEY) === 'true')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('tribocrm_theme') as 'dark' | 'light') ?? 'dark')
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    for (const entry of menuItems) {
      if (!isMenuItem(entry)) continue
      if (entry.children?.some((c) => location.pathname.startsWith(c.path))) expanded.add(entry.path)
    }
    return expanded
  })

  const w = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(LS_KEY, String(next))
      // Notify AppLayout via custom event
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
      return next
    })
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('tribocrm_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function toggleExpand(path: string) {
    if (collapsed) return
    setExpandedItems((prev) => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n })
  }

  function isActive(path: string) { return location.pathname === path }
  function isParentActive(item: MenuItem) { return isActive(item.path) || (item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false) }

  function getItemStyle(active: boolean, hovered: boolean): React.CSSProperties {
    let bg = 'transparent'; let color = '#9ca3af'; let fw: number = 400
    if (active) { bg = 'rgba(249,115,22,0.10)'; color = '#f97316'; fw = 500 }
    else if (hovered) { bg = 'rgba(255,255,255,0.04)'; color = '#e8eaf0' }
    return {
      display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
      gap: collapsed ? 0 : 10, padding: collapsed ? '10px 0' : '10px 16px',
      borderRadius: 8, margin: collapsed ? '2px 6px' : '2px 8px',
      cursor: 'pointer', transition: 'all 0.15s', background: bg, color, fontWeight: fw, fontSize: 14,
      overflow: 'hidden', whiteSpace: 'nowrap',
    }
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 60, width: w,
      height: 'calc(100vh - 60px)', background: '#111318',
      borderRight: '1px solid #22283a', display: 'flex',
      flexDirection: 'column', zIndex: 30,
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>
      <style>{CSS}</style>

      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 0' : '18px 20px', borderBottom: '1px solid #22283a', flexShrink: 0, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', alignItems: 'center', minHeight: 56 }}>
        {collapsed ? (
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>T</div>
        ) : (
          <span style={{ fontSize: 18, lineHeight: 1 }}>
            <span style={{ fontWeight: 400, color: '#e8eaf0' }}>Tribo</span>
            <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" style={{ flex: 1, paddingTop: 4, paddingBottom: 8, overflowY: 'auto', minHeight: 0 }}>
        {menuItems.map((entry, idx) => {
          if (entry === 'separator') {
            return <div key={`sep-${idx}`} style={{ height: 1, background: '#22283a', margin: collapsed ? '4px 8px' : '6px 16px' }} />
          }

          if (isSection(entry)) {
            if (collapsed) return null
            return (
              <div key={`sec-${entry.section}`} style={{ fontSize: 10, color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '16px 16px 4px', fontWeight: 600 }}>
                {entry.section}
              </div>
            )
          }

          const item = entry
          const Icon = item.icon
          const hasChildren = item.children && item.children.length > 0
          const expanded = expandedItems.has(item.path)
          const parentActive = isParentActive(item)

          if (hasChildren) {
            if (collapsed) {
              // Collapsed: just show icon, click navigates to first child
              const active = parentActive
              const hovered = hoveredPath === item.path && !active
              return (
                <div key={item.path}
                  title={item.label}
                  onClick={() => item.children?.[0] && navigate(item.children[0].path)}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={getItemStyle(active, hovered)}>
                  <Icon size={18} strokeWidth={1.5} />
                </div>
              )
            }

            return (
              <div key={item.path}>
                <div
                  onClick={() => toggleExpand(item.path)}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={{ ...getItemStyle(parentActive && !expanded, hoveredPath === item.path && !parentActive), justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown size={14} strokeWidth={1.5} style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }} />
                </div>
                {expanded && item.children?.map((child) => {
                  const ca = isActive(child.path); const ch = hoveredPath === child.path && !ca
                  return (
                    <div key={child.path} onClick={() => navigate(child.path)}
                      onMouseEnter={() => setHoveredPath(child.path)} onMouseLeave={() => setHoveredPath(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 44px', borderRadius: 8, margin: '1px 8px', cursor: 'pointer', transition: 'all 0.15s', fontSize: 13, background: ca ? 'rgba(249,115,22,0.10)' : ch ? 'rgba(255,255,255,0.04)' : 'transparent', color: ca ? '#f97316' : ch ? '#e8eaf0' : '#9ca3af', fontWeight: ca ? 500 : 400 }}>
                      <span>{child.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Simple item
          const active = isActive(item.path); const hovered = hoveredPath === item.path && !active
          return (
            <div key={item.path} title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredPath(item.path)} onMouseLeave={() => setHoveredPath(null)}
              style={{ ...getItemStyle(active, hovered), justifyContent: collapsed ? 'center' : 'space-between' }}>
              {collapsed ? (
                <Icon size={18} strokeWidth={1.5} />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span style={{ background: item.badgeColor ?? '#f97316', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, lineHeight: '16px' }}>{item.badge}</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? '0 6px 10px' : '0 8px 10px', flexShrink: 0 }}>
        <div style={{ height: 1, background: '#22283a', margin: '4px 8px' }} />
        {/* Theme toggle */}
        <div
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Modo escuro' : 'Modo claro') : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 10, padding: collapsed ? '8px 0' : '8px 16px',
            borderRadius: 8, cursor: 'pointer', color: '#9ca3af', fontSize: 13, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8eaf0' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
          {theme === 'dark' ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</span>}
        </div>
        {/* Collapse toggle */}
        <div
          onClick={toggleCollapse}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 10, padding: collapsed ? '8px 0' : '8px 16px',
            borderRadius: 8, cursor: 'pointer', color: '#6b7280', fontSize: 12,
            border: '1px solid #22283a', marginTop: 4, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#22283a'; e.currentTarget.style.color = '#e8eaf0' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' }}>
          {collapsed ? <ChevronsRight size={16} strokeWidth={1.5} /> : <><ChevronsLeft size={16} strokeWidth={1.5} /><span>Recolher menu</span></>}
        </div>
      </div>
    </aside>
  )
}
