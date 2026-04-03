import {
  LayoutDashboard, Kanban, Users, UserSquare2, CheckSquare,
  BarChart2, Package, Zap, FileText, Mail, Target,
  CreditCard, Settings,
} from 'lucide-react'
import type { SidebarEntry } from '../components/shared/Sidebar/Sidebar'

export const gestaoMenuItems: SidebarEntry[] = [
  { section: 'Gestão' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/gestao/dashboard' },
  { label: 'Pipeline', icon: Kanban, path: '/gestao/pipeline' },
  { label: 'Leads', icon: Users, path: '/gestao/leads' },
  {
    label: 'Equipe', icon: UserSquare2, path: '/gestao/equipe',
    children: [
      { label: 'Usuários', path: '/gestao/equipe/usuarios' },
      { label: 'Times', path: '/gestao/equipe/times' },
      { label: 'Permissões', path: '/gestao/equipe/permissoes' },
    ],
  },
  { label: 'Tarefas', icon: CheckSquare, path: '/gestao/tarefas' },
  { label: 'Relatórios', icon: BarChart2, path: '/gestao/relatorios' },
  { section: 'Configuração' },
  { label: 'Produtos', icon: Package, path: '/gestao/produtos' },
  { label: 'Automações', icon: Zap, path: '/gestao/automacoes' },
  { label: 'Formulários', icon: FileText, path: '/gestao/formularios' },
  {
    label: 'Modelos', icon: Mail, path: '/gestao/modelos',
    children: [
      { label: 'E-mail', path: '/gestao/modelos/email' },
      { label: 'WhatsApp', path: '/gestao/modelos/whatsapp' },
    ],
  },
  { label: 'Metas', icon: Target, path: '/gestao/metas' },
  { section: 'Conta' },
  { label: 'Minha Assinatura', icon: CreditCard, path: '/gestao/assinatura' },
  { label: 'Configurações', icon: Settings, path: '/gestao/configuracoes' },
]
