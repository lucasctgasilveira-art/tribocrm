import { prisma } from './prisma'

const PLATFORM_CNPJ = '00.000.000/0000-00'
const PLATFORM_NAME = 'TriboCRM Platform'
const PLATFORM_EMAIL = 'platform@tribocrm.com.br'

let cached: string | null = null

/**
 * Returns the real UUID of the platform tenant used by SUPER_ADMIN
 * to own internal managerial tasks (and any other records that cannot
 * live under a customer tenant). Upserts on first call.
 */
export async function getPlatformTenantId(): Promise<string> {
  if (cached) return cached

  const existing = await prisma.tenant.findUnique({ where: { cnpj: PLATFORM_CNPJ } })
  if (existing) { cached = existing.id; return existing.id }

  // Pick any existing plan (the tenant is never billed — it's an internal owner)
  const plan = await prisma.plan.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!plan) throw new Error('Cannot create platform tenant: no Plan exists')

  const created = await prisma.tenant.create({
    data: {
      name: PLATFORM_NAME,
      cnpj: PLATFORM_CNPJ,
      email: PLATFORM_EMAIL,
      planId: plan.id,
      planCycle: 'MONTHLY',
      status: 'ACTIVE',
    },
  })
  cached = created.id
  return created.id
}

/**
 * Returns the effective tenant id for the current request. For SUPER_ADMIN
 * (who carries the literal 'platform' string in their JWT) it resolves to
 * the real platform tenant UUID; otherwise it passes the caller's tenant
 * through unchanged.
 */
export async function resolveTenantId(rawTenantId: string): Promise<string> {
  if (rawTenantId === 'platform') return getPlatformTenantId()
  return rawTenantId
}
