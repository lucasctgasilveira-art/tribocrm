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
    case 'MANAGER':
    case 'TEAM_LEADER':
      return '/gestao/dashboard'
    case 'SELLER':
    default:
      return '/vendas/dashboard'
  }
}

function getAllowedInstances(role: string): AllowedInstance[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['admin', 'gestao', 'vendas']
    case 'OWNER':
      return ['gestao', 'vendas']
    case 'MANAGER':
    case 'TEAM_LEADER':
      return ['gestao', 'vendas']
    case 'SELLER':
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
