import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCurrentTenant } from '../../hooks/useCurrentTenant'
import SuspendedPage from './SuspendedPage'

interface TenantStatusGateProps {
  children: ReactNode
}

function isAllowlistedPath(pathname: string): boolean {
  return (
    pathname === '/gestao/assinatura' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login')
  )
}

export default function TenantStatusGate({ children }: TenantStatusGateProps) {
  const { tenant, loading } = useCurrentTenant()
  const location = useLocation()

  // Don't block initial render while /auth/me is in flight — the gate
  // re-evaluates on every update. If /auth/me fails entirely, tenant
  // stays null and we fall through to children (fail-open UX).
  if (loading) return <>{children}</>

  // SUPER_ADMIN: tenant is null. Nothing to gate here.
  if (!tenant) return <>{children}</>

  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
    if (isAllowlistedPath(location.pathname)) {
      return <>{children}</>
    }
    return <SuspendedPage />
  }

  // TRIAL / ACTIVE / PAYMENT_OVERDUE — render children. Banner and
  // popup are composed by AppLayout itself so they land inside the
  // <main> flow (below Topbar, beside Sidebar).
  return <>{children}</>
}
