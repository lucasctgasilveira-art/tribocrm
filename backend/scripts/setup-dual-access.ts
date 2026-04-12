import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const updated = await prisma.adminUser.update({
    where: { id: '2197a1f2-b166-413e-8047-365fa9eb2ba7' },
    data: {
      isDualAccess: true,
      linkedTenantId: '66b89c6b-caf2-47ff-94d3-871f06fb5b40',
    },
  })
  console.log('Admin atualizado:')
  console.log(' - id:', updated.id)
  console.log(' - email:', updated.email)
  console.log(' - isDualAccess:', updated.isDualAccess)
  console.log(' - linkedTenantId:', updated.linkedTenantId)
}

main().catch(err => { console.error(err); process.exit(1) }).finally(() => prisma.$disconnect())
