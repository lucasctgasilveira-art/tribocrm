import { Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'

type AllowedInstance = 'admin' | 'gestao' | 'vendas'

interface PrivateRouteProps {
  children: ReactNode
  allowed: AllowedInstance[]
}

interface StoredUser {
  role?: string
}

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/dashboard'
    case 'OWNER':
      return '/auth/select-instance'
    case 'MANAGER':
      return '/gestao/dashboard'
    default:
      return '/vendas/dashboard'
  }
}

function getAllowedInstances(role: string): AllowedInstance[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['admin']
    case 'OWNER':
      return ['admin', 'gestao']
    case 'MANAGER':
      return ['gestao']
    default:
      return ['vendas']
  }
}

export default function PrivateRoute({ children, allowed }: PrivateRouteProps) {
  const token = localStorage.getItem('accessToken')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  let user: StoredUser = {}
  try {
    user = JSON.parse(localStorage.getItem('user') ?? '{}') as StoredUser
  } catch {
    return <Navigate to="/login" replace />
  }

  const role = user.role ?? ''
  const userAllowed = getAllowedInstances(role)
  const hasAccess = allowed.some((inst) => userAllowed.includes(inst))

  if (!hasAccess) {
    return <Navigate to={getDefaultRoute(role)} replace />
  }

  return <>{children}</>
}
