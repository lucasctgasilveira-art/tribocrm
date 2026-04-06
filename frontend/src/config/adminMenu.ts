import {
  LayoutDashboard, Building2, DollarSign, Megaphone, LayoutGrid,
  Users, CreditCard, ScrollText, Settings, Tag,
} from 'lucide-react'
import type { SidebarEntry } from '../components/shared/Sidebar/Sidebar'

export const adminMenuItems: SidebarEntry[] = [
  { section: 'Plataforma' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { label: 'Clientes', icon: Building2, path: '/admin/clientes' },
  { label: 'Financeiro', icon: DollarSign, path: '/admin/financeiro', badge: '4', badgeColor: '#f59e0b' },
  { label: 'Pop-ups', icon: Megaphone, path: '/admin/popups' },
  { label: 'Cupons', icon: Tag, path: '/admin/cupons' },
  { label: 'Menu das Instâncias', icon: LayoutGrid, path: '/admin/menu-instancias' },
  { section: 'Sistema' },
  { label: 'Equipe Interna', icon: Users, path: '/admin/equipe' },
  { label: 'Planos', icon: CreditCard, path: '/admin/planos' },
  { label: 'Logs do Sistema', icon: ScrollText, path: '/admin/logs' },
  { label: 'Configurações', icon: Settings, path: '/admin/configuracoes' },
]
