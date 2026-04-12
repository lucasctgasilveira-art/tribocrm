import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, email: true, status: true },
  })
  console.log('Tenants existentes:')
  tenants.forEach(t => console.log(' -', t.id, t.name, t.email, t.status))

  console.log('\nAdmin users:')
  const admins = await prisma.adminUser.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, isDualAccess: true },
  })
  admins.forEach(a => console.log(' -', a.id, a.name, a.email, a.role, 'active:', a.isActive, 'dual:', a.isDualAccess))
}

main().catch(err => { console.error(err); process.exit(1) }).finally(() => prisma.$disconnect())
