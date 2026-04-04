import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const lucas = await prisma.user.findFirst({
    where: { email: 'lucas@tribodevendas.com.br' },
    select: { tenantId: true },
  })

  if (!lucas) {
    console.error('Usuário Lucas não encontrado')
    process.exit(1)
  }

  const existing = await prisma.user.findFirst({
    where: { email: 'ana@tribodevendas.com.br', tenantId: lucas.tenantId },
  })

  if (existing) {
    console.log('[Seller] ana@tribodevendas.com.br já existe — atualizando senha')
    const passwordHash = await bcrypt.hash('Teste@123', 12)
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true },
    })
    console.log('[Seller] Senha atualizada para: Teste@123')
    await prisma.$disconnect()
    return
  }

  const passwordHash = await bcrypt.hash('Teste@123', 12)

  const seller = await prisma.user.create({
    data: {
      tenantId: lucas.tenantId,
      name: 'Ana Vendedora',
      email: 'ana@tribodevendas.com.br',
      passwordHash,
      role: 'SELLER',
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, tenantId: true },
  })

  console.log('[Seller] Usuário criado:')
  console.log(JSON.stringify(seller, null, 2))
  console.log('\nSenha: Teste@123')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Erro:', e.message)
  process.exit(1)
})
