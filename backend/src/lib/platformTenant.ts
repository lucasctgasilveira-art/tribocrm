import { prisma } from './prisma'

const PLATFORM_CNPJ = '00.000.000/0000-00'
const PLATFORM_NAME = 'TriboCRM Platform'
const PLATFORM_EMAIL = 'platform@tribocrm.com.br'

const DEFAULT_MANAGERIAL_TYPES = [
  'Ligação',
  'E-mail',
  'Reunião',
  'WhatsApp',
  'Visita',
]
const DEFAULT_VISIBLE_FOR = ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER', 'SUPER_ADMIN']

let cached: string | null = null
// Per-process flag so the default-type seed body runs at most once per tenant.
// Without this flag, concurrent SUPER_ADMIN requests can all see an empty
// findMany and race to insert duplicate rows since ManagerialTaskType has no
// (tenantId, name) unique constraint.
const seededTenants = new Set<string>()

/**
 * Idempotently ensure the five default managerial task types exist for the
 * given tenant so the Nova Tarefa modal's "Categoria" dropdown is never empty.
 * Visible-for always includes SUPER_ADMIN so the filtered endpoint returns
 * results when called with that role. Only runs once per process lifetime
 * per tenant to prevent concurrent-request duplicate inserts.
 */
async function seedDefaultManagerialTypes(tenantId: string): Promise<void> {
  if (seededTenants.has(tenantId)) return
  // Claim the flag before awaiting anything so a second concurrent call
  // returns immediately instead of racing the findMany/create pair.
  seededTenants.add(tenantId)

  try {
    const existing = await prisma.managerialTaskType.findMany({
      where: { tenantId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map(t => t.name))

    let sortOrder = existing.length
    for (const name of DEFAULT_MANAGERIAL_TYPES) {
      if (existingNames.has(name)) continue
      sortOrder += 1
      await prisma.managerialTaskType.create({
        data: { tenantId, name, visibleFor: DEFAULT_VISIBLE_FOR, sortOrder },
      })
    }
  } catch (err) {
    // If the seed fails, release the flag so a later call can retry.
    seededTenants.delete(tenantId)
    throw err
  }
}

/**
 * Returns the real UUID of the platform tenant used by SUPER_ADMIN
 * to own internal managerial tasks (and any other records that cannot
 * live under a customer tenant). Upserts on first call and seeds default
 * managerial task types so the Nova Tarefa form works out of the box.
 */
export async function getPlatformTenantId(): Promise<string> {
  if (cached) {
    await seedDefaultManagerialTypes(cached)
    return cached
  }

  const existing = await prisma.tenant.findUnique({ where: { cnpj: PLATFORM_CNPJ } })
  if (existing) {
    cached = existing.id
    await seedDefaultManagerialTypes(existing.id)
    return existing.id
  }

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
  await seedDefaultManagerialTypes(created.id)
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
