import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import { prisma } from './lib/prisma'

const BCRYPT_ROUNDS = 12

async function main() {
  console.log('[Seed] Iniciando seed do banco de dados...\n')

  // ─── 1. Planos ───────────────────────────────────────────
  const plansData = [
    {
      name: 'Gratuito',
      slug: 'free',
      priceMonthly: 0,
      priceYearly: 0,
      maxUsers: 1,
      extraUserPrice: 0,
      maxLeads: 50,
      maxPipelines: 1,
      maxAutomations: 0,
      maxForms: 0,
      maxCustomFields: 0,
      maxEmailTemplates: 0,
      maxWhatsappTemplates: 0,
      features: [],
    },
    {
      name: 'Solo',
      slug: 'solo',
      priceMonthly: 69,
      priceYearly: 55.2, // ~20% desconto anual
      maxUsers: 1,
      extraUserPrice: 0,
      maxLeads: 1000,
      maxPipelines: 1,
      maxAutomations: 0,
      maxForms: 1,
      maxCustomFields: 5,
      maxEmailTemplates: 5,
      maxWhatsappTemplates: 5,
      features: ['email_tracking'],
    },
    {
      name: 'Essencial',
      slug: 'essencial',
      priceMonthly: 197,
      priceYearly: 157.6,
      maxUsers: 3,
      extraUserPrice: 49,
      maxLeads: 5000,
      maxPipelines: 3,
      maxAutomations: 3,
      maxForms: 3,
      maxCustomFields: 10,
      maxEmailTemplates: 10,
      maxWhatsappTemplates: 10,
      features: ['email_tracking', 'automations', 'forms'],
    },
    {
      name: 'Pro',
      slug: 'pro',
      priceMonthly: 349,
      priceYearly: 279.2,
      maxUsers: 5,
      extraUserPrice: 39,
      maxLeads: 10000,
      maxPipelines: 10,
      maxAutomations: 10,
      maxForms: 10,
      maxCustomFields: 20,
      maxEmailTemplates: 30,
      maxWhatsappTemplates: 30,
      features: ['email_tracking', 'automations', 'forms', 'goals', 'products', 'custom_fields'],
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      priceMonthly: 649,
      priceYearly: 519.2,
      maxUsers: 10,
      extraUserPrice: 29,
      maxLeads: 50000,
      maxPipelines: 10,
      maxAutomations: -1, // ilimitado
      maxForms: -1,
      maxCustomFields: -1,
      maxEmailTemplates: -1,
      maxWhatsappTemplates: -1,
      features: ['email_tracking', 'automations', 'forms', 'goals', 'products', 'custom_fields', 'api_access', 'priority_support'],
    },
  ]

  const plans: Record<string, string> = {}

  for (const plan of plansData) {
    const created = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    })
    plans[plan.slug] = created.id
    console.log(`  ✔ Plano "${created.name}" (${created.slug})`)
  }

  console.log('')

  // ─── 2. Super Admin ──────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@2026', BCRYPT_ROUNDS)

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@tribocrm.com.br' },
    update: {
      name: 'Lucas Silveira',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      name: 'Lucas Silveira',
      email: 'admin@tribocrm.com.br',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
  })

  console.log(`  ✔ Super Admin "${admin.name}" (${admin.email})`)

  // ─── 3. Tenant Tribo de Vendas ───────────────────────────
  const proPlanId = plans['pro']
  if (!proPlanId) throw new Error('Plano Pro não encontrado')

  const tenant = await prisma.tenant.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {
      name: 'Tribo de Vendas',
      email: 'lucas@tribodevendas.com.br',
      planId: proPlanId,
      planCycle: 'MONTHLY',
      status: 'ACTIVE',
      planStartedAt: new Date(),
    },
    create: {
      name: 'Tribo de Vendas',
      cnpj: '00.000.000/0001-00',
      email: 'lucas@tribodevendas.com.br',
      planId: proPlanId,
      planCycle: 'MONTHLY',
      status: 'ACTIVE',
      planStartedAt: new Date(),
    },
  })

  console.log(`  ✔ Tenant "${tenant.name}" (${tenant.cnpj}) — Plano Pro`)

  // ─── 4. Usuário Owner ────────────────────────────────────
  const userPasswordHash = await bcrypt.hash('Admin@2026', BCRYPT_ROUNDS)

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'lucas@tribodevendas.com.br' } },
    update: {
      name: 'Lucas Silveira',
      passwordHash: userPasswordHash,
      role: 'OWNER',
    },
    create: {
      tenantId: tenant.id,
      name: 'Lucas Silveira',
      email: 'lucas@tribodevendas.com.br',
      passwordHash: userPasswordHash,
      role: 'OWNER',
    },
  })

  console.log(`  ✔ Usuário "${user.name}" (${user.email}) — OWNER`)

  console.log('\n[Seed] Seed concluído com sucesso!')
}

main()
  .catch((error) => {
    console.error('[Seed] Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
