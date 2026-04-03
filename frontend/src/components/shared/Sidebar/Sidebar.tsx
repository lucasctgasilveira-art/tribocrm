import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun, ChevronDown, type LucideIcon } from 'lucide-react'

// ── Types ──

export interface MenuSubItem {
  label: string
  path: string
}

export interface MenuItem {
  label: string
  icon: LucideIcon
  path: string
  children?: MenuSubItem[]
  badge?: string
  badgeColor?: string
}

export interface SectionHeader {
  section: string
}

export type SidebarEntry = MenuItem | 'separator' | SectionHeader

function isSection(entry: SidebarEntry): entry is SectionHeader {
  return typeof entry === 'object' && 'section' in entry
}

function isMenuItem(entry: SidebarEntry): entry is MenuItem {
  return typeof entry === 'object' && 'icon' in entry
}

interface SidebarProps {
  menuItems: SidebarEntry[]
}

// ── Scrollbar CSS ──

const SIDEBAR_CSS = `
  .sidebar-nav::-webkit-scrollbar { width: 4px; }
  .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
  .sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
  .sidebar-nav:hover::-webkit-scrollbar-thumb { background: #22283a; }
  .sidebar-nav { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .sidebar-nav:hover { scrollbar-color: #22283a transparent; }
`

// ── Sidebar ──

export default function Sidebar({ menuItems }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tribocrm_theme') as 'dark' | 'light') ?? 'dark'
  })
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    for (const entry of menuItems) {
      if (!isMenuItem(entry)) continue
      if (entry.children?.some((c) => location.pathname.startsWith(c.path))) {
        expanded.add(entry.path)
      }
    }
    return expanded
  })

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('tribocrm_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function toggleExpand(path: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function isActive(path: string): boolean {
    return location.pathname === path
  }

  function isParentActive(item: MenuItem): boolean {
    if (isActive(item.path)) return true
    return item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false
  }

  function itemStyle(active: boolean, hovered: boolean): React.CSSProperties {
    let bg = 'transparent'
    let color = '#9ca3af'
    let fontWeight: number = 400
    if (active) { bg = 'rgba(249,115,22,0.10)'; color = '#f97316'; fontWeight = 500 }
    else if (hovered) { bg = 'rgba(255,255,255,0.04)'; color = '#e8eaf0' }
    return {
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      borderRadius: 8, margin: '2px 8px', cursor: 'pointer', transition: 'all 0.15s',
      background: bg, color, fontWeight, fontSize: 14,
    }
  }

  return (
    <aside
      style={{
        position: 'fixed', left: 0, top: 60, width: 220,
        height: 'calc(100vh - 60px)', background: '#111318',
        borderRight: '1px solid #22283a', display: 'flex',
        flexDirection: 'column', zIndex: 30,
      }}
    >
      <style>{SIDEBAR_CSS}</style>

      {/* Logo — fixed top */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #22283a', flexShrink: 0 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>
          <span style={{ fontWeight: 400, color: '#e8eaf0' }}>Tribo</span>
          <span style={{ fontWeight: 800, color: '#f97316' }}>CRM</span>
        </span>
      </div>

      {/* Nav — scrollable */}
      <nav
        className="sidebar-nav"
        style={{ flex: 1, paddingTop: 4, paddingBottom: 8, overflowY: 'auto', minHeight: 0 }}
      >
        {menuItems.map((entry, idx) => {
          // Separator
          if (entry === 'separator') {
            return <div key={`sep-${idx}`} style={{ height: 1, background: '#22283a', margin: '6px 16px' }} />
          }

          // Section header
          if (isSection(entry)) {
            return (
              <div
                key={`sec-${entry.section}`}
                style={{
                  fontSize: 10, color: '#6b7280', letterSpacing: '1.5px',
                  textTransform: 'uppercase', padding: '16px 16px 4px',
                  fontWeight: 600,
                }}
              >
                {entry.section}
              </div>
            )
          }

          // Menu item
          const item = entry
          const Icon = item.icon
          const hasChildren = item.children && item.children.length > 0
          const expanded = expandedItems.has(item.path)
          const parentActive = isParentActive(item)

          if (hasChildren) {
            return (
              <div key={item.path}>
                <div
                  onClick={() => toggleExpand(item.path)}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={{
                    ...itemStyle(parentActive && !expanded, hoveredPath === item.path && !parentActive),
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    size={14} strokeWidth={1.5}
                    style={{
                      transition: 'transform 0.2s',
                      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      opacity: 0.5,
                    }}
                  />
                </div>
                {expanded && item.children?.map((child) => {
                  const childActive = isActive(child.path)
                  const childHovered = hoveredPath === child.path && !childActive
                  return (
                    <div
                      key={child.path}
                      onClick={() => navigate(child.path)}
                      onMouseEnter={() => setHoveredPath(child.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px 8px 44px', borderRadius: 8,
                        margin: '1px 8px', cursor: 'pointer', transition: 'all 0.15s',
                        fontSize: 13,
                        background: childActive ? 'rgba(249,115,22,0.10)' : childHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                        color: childActive ? '#f97316' : childHovered ? '#e8eaf0' : '#9ca3af',
                        fontWeight: childActive ? 500 : 400,
                      }}
                    >
                      <span>{child.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Simple item
          const active = isActive(item.path)
          const hovered = hoveredPath === item.path && !active
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredPath(item.path)}
              onMouseLeave={() => setHoveredPath(null)}
              style={{ ...itemStyle(active, hovered), justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{
                  background: item.badgeColor ?? '#f97316',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 999, lineHeight: '16px',
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom — theme toggle */}
      <div style={{ padding: '0 8px 10px', flexShrink: 0 }}>
        <div style={{ height: 1, background: '#22283a', margin: '4px 8px' }} />
        <div
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
            borderRadius: 8, cursor: 'pointer', color: '#9ca3af', fontSize: 13,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8eaf0' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
        >
          {theme === 'dark' ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
          <span>{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</span>
        </div>
      </div>
    </aside>
  )
}
