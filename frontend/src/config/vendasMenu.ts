import {
  LayoutDashboard, Kanban, Users, CheckSquare, TrendingUp, Settings,
  GraduationCap, PlayCircle,
} from 'lucide-react'
import type { SidebarEntry } from '../components/shared/Sidebar/Sidebar'

export const vendasMenuItems: SidebarEntry[] = [
  { section: 'Menu' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/vendas/dashboard' },
  { label: 'Pipeline', icon: Kanban, path: '/vendas/pipeline' },
  { label: 'Leads', icon: Users, path: '/vendas/leads' },
  { label: 'Tarefas', icon: CheckSquare, path: '/vendas/tarefas' },
  { label: 'Meus Resultados', icon: TrendingUp, path: '/vendas/resultados' },
  { label: 'Configurações', icon: Settings, path: '/vendas/configuracoes' },
  { section: 'Tribo' },
  { label: 'Mentoria', icon: GraduationCap, path: '/vendas/mentoria' },
  { label: 'Treinamentos', icon: PlayCircle, path: '/vendas/treinamentos' },
]
