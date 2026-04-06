import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import InstanceSelectorPage from './pages/auth/InstanceSelectorPage'
import TwoFactorPage from './pages/auth/TwoFactorPage'
import OnboardingGestorPage from './pages/auth/OnboardingGestorPage'
import OnboardingVendedorPage from './pages/auth/OnboardingVendedorPage'
import PrivateRoute from './components/shared/PrivateRoute'

// Admin
import AdminDashboardPage from './pages/admin/DashboardPage'
import TenantsPage from './pages/admin/TenantsPage'
import FinancialPage from './pages/admin/FinancialPage'
import InternalTeamPage from './pages/admin/InternalTeamPage'
import PopupsPage from './pages/admin/PopupsPage'
import MenuInstanciasPage from './pages/admin/MenuInstanciasPage'
import PlansPage from './pages/admin/PlansPage'
import LogsPage from './pages/admin/LogsPage'
import GlobalSettingsPage from './pages/admin/GlobalSettingsPage'
import TenantDetailPage from './pages/admin/TenantDetailPage'
import CouponsPage from './pages/admin/CouponsPage'
import AdminPermissionsPage from './pages/admin/AdminPermissionsPage'

// Gestão
import GestaoDashboardPage from './pages/gestao/DashboardPage'
import GestaoPipelinePage from './pages/gestao/PipelinePage'
import GestaoLeadsPage from './pages/gestao/LeadsPage'
import GestaoTasksPage from './pages/gestao/TasksPage'
import GestaoUsersPage from './pages/gestao/UsersPage'
import GestaoTeamsPage from './pages/gestao/TeamsPage'
import GestaoPermissionsPage from './pages/gestao/PermissionsPage'
import ReportsPage from './pages/gestao/ReportsPage'
import ProductsPage from './pages/gestao/ProductsPage'
import AutomationsPage from './pages/gestao/AutomationsPage'
import FormsPage from './pages/gestao/FormsPage'
import EmailTemplatesPage from './pages/gestao/EmailTemplatesPage'
import WhatsappTemplatesPage from './pages/gestao/WhatsappTemplatesPage'
import GoalsPage from './pages/gestao/GoalsPage'
import MySubscriptionPage from './pages/gestao/MySubscriptionPage'
import GestaoSettingsPage from './pages/gestao/SettingsPage'
import GestaoLeadDetailPage from './pages/gestao/LeadDetailPage'

// Vendas
import VendasDashboardPage from './pages/vendas/DashboardPage'
import VendasPipelinePage from './pages/vendas/PipelinePage'
import VendasLeadsPage from './pages/vendas/LeadsPage'
import VendasTasksPage from './pages/vendas/TasksPage'
import MyResultsPage from './pages/vendas/MyResultsPage'
import PersonalSettingsPage from './pages/vendas/PersonalSettingsPage'
import VendasLeadDetailPage from './pages/vendas/LeadDetailPage'
import MentoriaPage from './pages/vendas/MentoriaPage'
import TreinamentosPage from './pages/vendas/TreinamentosPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/select-instance" element={<InstanceSelectorPage />} />
      <Route path="/auth/2fa" element={<TwoFactorPage />} />

      {/* Onboarding */}
      <Route path="/gestao/onboarding" element={<OnboardingGestorPage />} />
      <Route path="/vendas/onboarding" element={<OnboardingVendedorPage />} />

      {/* Preview (sem proteção — apenas para teste visual) */}
      <Route path="/preview/vendas/dashboard" element={<VendasDashboardPage />} />
      <Route path="/preview/gestao/dashboard" element={<GestaoDashboardPage />} />
      <Route path="/preview/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/preview/leads/:id" element={<GestaoLeadDetailPage />} />
      <Route path="/preview/vendas/resultados" element={<MyResultsPage />} />
      <Route path="/preview/vendas/configuracoes" element={<PersonalSettingsPage />} />
      <Route path="/preview/onboarding/gestor" element={<OnboardingGestorPage />} />
      <Route path="/preview/onboarding/vendedor" element={<OnboardingVendedorPage />} />
      <Route path="/preview/2fa" element={<TwoFactorPage />} />
      <Route path="/preview/gestao/tarefas" element={<GestaoTasksPage />} />

      {/* Redirects */}
      <Route path="/gestao" element={<Navigate to="/gestao/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/vendas" element={<Navigate to="/vendas/dashboard" replace />} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<PrivateRoute allowed={['admin']}><AdminDashboardPage /></PrivateRoute>} />
      <Route path="/admin/clientes" element={<PrivateRoute allowed={['admin']}><TenantsPage /></PrivateRoute>} />
      <Route path="/admin/clientes/:id" element={<PrivateRoute allowed={['admin']}><TenantDetailPage /></PrivateRoute>} />
      <Route path="/admin/financeiro" element={<PrivateRoute allowed={['admin']}><FinancialPage /></PrivateRoute>} />
      <Route path="/admin/popups" element={<PrivateRoute allowed={['admin']}><PopupsPage /></PrivateRoute>} />
      <Route path="/admin/cupons" element={<PrivateRoute allowed={['admin']}><CouponsPage /></PrivateRoute>} />
      <Route path="/admin/menu-instancias" element={<PrivateRoute allowed={['admin']}><MenuInstanciasPage /></PrivateRoute>} />
      <Route path="/admin/equipe" element={<PrivateRoute allowed={['admin']}><InternalTeamPage /></PrivateRoute>} />
      <Route path="/admin/equipe/permissoes" element={<PrivateRoute allowed={['admin']}><AdminPermissionsPage /></PrivateRoute>} />
      <Route path="/admin/planos" element={<PrivateRoute allowed={['admin']}><PlansPage /></PrivateRoute>} />
      <Route path="/admin/logs" element={<PrivateRoute allowed={['admin']}><LogsPage /></PrivateRoute>} />
      <Route path="/admin/configuracoes" element={<PrivateRoute allowed={['admin']}><GlobalSettingsPage /></PrivateRoute>} />

      {/* Gestão */}
      <Route path="/gestao/dashboard" element={<PrivateRoute allowed={['gestao']}><GestaoDashboardPage /></PrivateRoute>} />
      <Route path="/gestao/pipeline" element={<PrivateRoute allowed={['gestao']}><GestaoPipelinePage /></PrivateRoute>} />
      <Route path="/gestao/leads" element={<PrivateRoute allowed={['gestao']}><GestaoLeadsPage /></PrivateRoute>} />
      <Route path="/gestao/leads/:id" element={<PrivateRoute allowed={['gestao']}><GestaoLeadDetailPage /></PrivateRoute>} />
      <Route path="/gestao/tarefas" element={<PrivateRoute allowed={['gestao']}><GestaoTasksPage /></PrivateRoute>} />
      <Route path="/gestao/equipe/usuarios" element={<PrivateRoute allowed={['gestao']}><GestaoUsersPage /></PrivateRoute>} />
      <Route path="/gestao/equipe/times" element={<PrivateRoute allowed={['gestao']}><GestaoTeamsPage /></PrivateRoute>} />
      <Route path="/gestao/equipe/permissoes" element={<PrivateRoute allowed={['gestao']}><GestaoPermissionsPage /></PrivateRoute>} />
      <Route path="/gestao/relatorios" element={<PrivateRoute allowed={['gestao']}><ReportsPage /></PrivateRoute>} />
      <Route path="/gestao/produtos" element={<PrivateRoute allowed={['gestao']}><ProductsPage /></PrivateRoute>} />
      <Route path="/gestao/automacoes" element={<PrivateRoute allowed={['gestao']}><AutomationsPage /></PrivateRoute>} />
      <Route path="/gestao/formularios" element={<PrivateRoute allowed={['gestao']}><FormsPage /></PrivateRoute>} />
      <Route path="/gestao/modelos/email" element={<PrivateRoute allowed={['gestao']}><EmailTemplatesPage /></PrivateRoute>} />
      <Route path="/gestao/modelos/whatsapp" element={<PrivateRoute allowed={['gestao']}><WhatsappTemplatesPage /></PrivateRoute>} />
      <Route path="/gestao/metas" element={<PrivateRoute allowed={['gestao']}><GoalsPage /></PrivateRoute>} />
      <Route path="/gestao/assinatura" element={<PrivateRoute allowed={['gestao']}><MySubscriptionPage /></PrivateRoute>} />
      <Route path="/gestao/configuracoes" element={<PrivateRoute allowed={['gestao']}><GestaoSettingsPage /></PrivateRoute>} />

      {/* Vendas */}
      <Route path="/vendas/dashboard" element={<PrivateRoute allowed={['vendas']}><VendasDashboardPage /></PrivateRoute>} />
      <Route path="/vendas/pipeline" element={<PrivateRoute allowed={['vendas']}><VendasPipelinePage /></PrivateRoute>} />
      <Route path="/vendas/leads" element={<PrivateRoute allowed={['vendas']}><VendasLeadsPage /></PrivateRoute>} />
      <Route path="/vendas/leads/:id" element={<PrivateRoute allowed={['vendas']}><VendasLeadDetailPage /></PrivateRoute>} />
      <Route path="/vendas/tarefas" element={<PrivateRoute allowed={['vendas']}><VendasTasksPage /></PrivateRoute>} />
      <Route path="/vendas/resultados" element={<PrivateRoute allowed={['vendas']}><MyResultsPage /></PrivateRoute>} />
      <Route path="/vendas/configuracoes" element={<PrivateRoute allowed={['vendas']}><PersonalSettingsPage /></PrivateRoute>} />
      <Route path="/vendas/mentoria" element={<PrivateRoute allowed={['vendas']}><MentoriaPage /></PrivateRoute>} />
      <Route path="/vendas/treinamentos" element={<PrivateRoute allowed={['vendas']}><TreinamentosPage /></PrivateRoute>} />
    </Routes>
  )
}
