// Campaign recipients resolver — extraído de admin.routes.ts em
// 6L.3.a pra ser reutilizado pelo campaign-runner.job sem causar
// import circular. Lógica idêntica à versão inline anterior.

import { prisma } from '../lib/prisma'

export type CampaignAudience = 'OWNERS' | 'ALL_USERS'

export interface CampaignFilters {
  planIds?: string[]
  tenantStatuses?: string[]
  roles?: ('OWNER' | 'MANAGER' | 'TEAM_LEADER' | 'SELLER')[]
}

export interface CampaignRecipient {
  userId: string
  name: string
  email: string
  role: string
  tenantId: string
  tenantName: string
  planName: string | null
}

export async function resolveCampaignRecipients(
  filters: CampaignFilters,
  audience: CampaignAudience,
): Promise<CampaignRecipient[]> {
  const userWhere: any = {
    isActive: true,
    deletedAt: null,
  }

  if (audience === 'OWNERS') {
    userWhere.role = 'OWNER'
  } else if (filters.roles && filters.roles.length > 0) {
    userWhere.role = { in: filters.roles }
  }

  const tenantWhere: any = {}
  if (filters.planIds && filters.planIds.length > 0) {
    tenantWhere.planId = { in: filters.planIds }
  }
  if (filters.tenantStatuses && filters.tenantStatuses.length > 0) {
    tenantWhere.status = { in: filters.tenantStatuses }
  }
  if (Object.keys(tenantWhere).length > 0) {
    userWhere.tenant = tenantWhere
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      tenant: {
        select: {
          name: true,
          plan: { select: { name: true } },
        },
      },
    },
  })

  // Dedupe por email — defensivo contra duplicatas cross-tenant.
  const seen = new Set<string>()
  const deduped = users.filter((u) => {
    if (!u.email || seen.has(u.email)) return false
    seen.add(u.email)
    return true
  })

  return deduped.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tenantId: u.tenantId,
    tenantName: u.tenant?.name ?? '',
    planName: u.tenant?.plan?.name ?? null,
  }))
}
