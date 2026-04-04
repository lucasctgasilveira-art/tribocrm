import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const newPassword = 'Teste@123'
  const passwordHash = await bcrypt.hash(newPassword, 12)

  const user = await prisma.user.updateMany({
    where: { email: 'lucas@tribodevendas.com.br' },
    data: { passwordHash },
  })
  console.log(`[User] lucas@tribodevendas.com.br — ${user.count} registro(s) atualizado(s)`)

  const admin = await prisma.adminUser.updateMany({
    where: { email: 'admin@tribocrm.com.br' },
    data: { passwordHash },
  })
  console.log(`[Admin] admin@tribocrm.com.br — ${admin.count} registro(s) atualizado(s)`)

  console.log('\nSenha redefinida para: Teste@123')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Erro:', e.message)
  process.exit(1)
})
