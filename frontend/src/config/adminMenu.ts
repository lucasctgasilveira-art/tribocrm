import {
  LayoutDashboard, Building2, DollarSign, Megaphone, LayoutGrid,
  Users, CreditCard, ScrollText, Settings, Tag, CheckSquare, Zap, Mail, Send,
} from 'lucide-react'
import type { SidebarEntry } from '../components/shared/Sidebar/Sidebar'

export const adminMenuItems: SidebarEntry[] = [
  { section: 'Plataforma' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { label: 'Clientes', icon: Building2, path: '/admin/clientes' },
  { label: 'Financeiro', icon: DollarSign, path: '/admin/financeiro', badge: '4', badgeColor: '#f59e0b' },
  { label: 'Tarefas', icon: CheckSquare, path: '/admin/tarefas' },
  { label: 'Pop-ups', icon: Megaphone, path: '/admin/popups' },
  { label: 'Menu das Instâncias', icon: LayoutGrid, path: '/admin/menu-instancias' },
  { section: 'Sistema' },
  { label: 'Equipe Interna', icon: Users, path: '/admin/equipe', children: [
    { label: 'Membros', path: '/admin/equipe' },
    { label: 'Permissões', path: '/admin/equipe/permissoes' },
  ] },
  { label: 'Automações', icon: Zap, path: '/admin/automacoes' },
  { label: 'Planos', icon: CreditCard, path: '/admin/planos' },
  { label: 'Cupons', icon: Tag, path: '/admin/cupons' },
  { label: 'Logs do Sistema', icon: ScrollText, path: '/admin/logs' },
  { label: 'Logs de E-mails', icon: Mail, path: '/admin/logs/emails' },
  { label: 'Nova Campanha', icon: Send, path: '/admin/emails/novo' },
  { label: 'Configurações', icon: Settings, path: '/admin/configuracoes' },
]
