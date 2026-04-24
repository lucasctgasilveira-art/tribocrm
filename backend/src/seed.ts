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

  // ─── 5. Fixtures opcionais (extensão / dev) ──────────────
  if (process.env.SEED_EXTENSION_FIXTURES === '1') {
    await seedExtensionFixtures(tenant.id, user.id)
  } else {
    console.log('\n[Seed] Fixtures opcionais desativados (defina SEED_EXTENSION_FIXTURES=1 para popular pipeline/sellers/produtos/leads)')
  }

  console.log('\n[Seed] Seed concluído com sucesso!')
}

// Pipeline + 4 stages + 2 sellers + 3 products + 5 leads + 1 LeadProduct.
// Tudo idempotente via findFirst+create ou upsert. Os leads usam phone/whatsapp
// em formatos diferentes (com/sem +55, com/sem máscara) para servir de fixture
// da detecção de WhatsApp na extensão. Roda apenas com SEED_EXTENSION_FIXTURES=1
// para não poluir produção sem intenção.
async function seedExtensionFixtures(tenantId: string, ownerId: string): Promise<void> {
  console.log('\n[Seed] === Fixtures opcionais (SEED_EXTENSION_FIXTURES=1) ===\n')

  // Pipeline + Stages
  const pipelineName = 'Funil Vendas'
  let pipeline = await prisma.pipeline.findFirst({ where: { tenantId, name: pipelineName } })
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { tenantId, name: pipelineName, isDefault: true, distributionType: 'MANUAL', isActive: true },
    })
  }
  console.log(`  ✔ Pipeline "${pipeline.name}"`)

  const stagesData = [
    { name: 'Novo',         sortOrder: 1, color: '#6B7280' },
    { name: 'Qualificando', sortOrder: 2, color: '#F59E0B' },
    { name: 'Proposta',     sortOrder: 3, color: '#3B82F6' },
    { name: 'Fechamento',   sortOrder: 4, color: '#10B981' },
  ]
  const stages: Record<string, string> = {}
  for (const s of stagesData) {
    let stage = await prisma.pipelineStage.findFirst({ where: { pipelineId: pipeline.id, name: s.name } })
    if (!stage) {
      stage = await prisma.pipelineStage.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          name: s.name,
          type: 'NORMAL',
          sortOrder: s.sortOrder,
          color: s.color,
        },
      })
    }
    stages[s.name] = stage.id
    console.log(`    ✔ Stage "${s.name}"`)
  }

  // Sellers
  const sellerPasswordHash = await bcrypt.hash('Teste@123', BCRYPT_ROUNDS)
  const sellersData = [
    { name: 'Ana Vendedora',   email: 'ana@tribodevendas.com.br' },
    { name: 'Bruno Vendedor',  email: 'bruno@tribodevendas.com.br' },
  ]
  const sellers: Record<string, string> = {}
  for (const s of sellersData) {
    const seller = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: s.email } },
      update: { name: s.name, passwordHash: sellerPasswordHash, role: 'SELLER', isActive: true },
      create: { tenantId, name: s.name, email: s.email, passwordHash: sellerPasswordHash, role: 'SELLER', isActive: true },
    })
    sellers[s.email] = seller.id
    console.log(`  ✔ Seller "${seller.name}" (${seller.email})`)
  }

  // Products
  const productsData = [
    { name: 'Consultoria Premium', price: 5000, allowsDiscount: true,  maxDiscount: 10,   discountType: 'PERCENTAGE' as const, approvalType: 'PASSWORD' as const },
    { name: 'Mentoria Individual', price: 2500, allowsDiscount: true,  maxDiscount: 5,    discountType: 'PERCENTAGE' as const, approvalType: 'PASSWORD' as const },
    { name: 'Workshop Vendas',     price: 1200, allowsDiscount: false, maxDiscount: null, discountType: null,                  approvalType: null },
  ]
  const products: Record<string, string> = {}
  for (const p of productsData) {
    let product = await prisma.product.findFirst({ where: { tenantId, name: p.name } })
    const data = {
      tenantId,
      name: p.name,
      price: p.price,
      allowsDiscount: p.allowsDiscount,
      maxDiscount: p.maxDiscount,
      discountType: p.discountType,
      approvalType: p.approvalType,
      isActive: true,
    }
    if (!product) {
      product = await prisma.product.create({ data })
    } else {
      product = await prisma.product.update({ where: { id: product.id }, data })
    }
    products[p.name] = product.id
    console.log(`  ✔ Product "${product.name}" (R$ ${product.price})`)
  }

  // Leads — phones em formatos diferentes propositalmente
  const novoStageId = stages['Novo']!
  const anaId = sellers['ana@tribodevendas.com.br']!
  const brunoId = sellers['bruno@tribodevendas.com.br']!
  const leadsData = [
    { name: 'João Silva',    phone: '+5511998765001',   whatsapp: '+5511998765001', responsibleId: anaId },
    { name: 'Maria Souza',   phone: '11998765002',      whatsapp: '5511998765002',  responsibleId: anaId },
    { name: 'Pedro Santos',  phone: '(11) 99876-5003',  whatsapp: '11998765003',    responsibleId: anaId },
    { name: 'Carla Dias',    phone: '+5511998765004',   whatsapp: '+5511998765004', responsibleId: brunoId },
    { name: 'Rafael Costa',  phone: '11998765005',      whatsapp: '11998765005',    responsibleId: brunoId },
  ]
  const leads: Record<string, string> = {}
  for (const l of leadsData) {
    let lead = await prisma.lead.findFirst({ where: { tenantId, name: l.name, deletedAt: null } })
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          stageId: novoStageId,
          responsibleId: l.responsibleId,
          createdBy: ownerId,
          name: l.name,
          phone: l.phone,
          whatsapp: l.whatsapp,
          status: 'ACTIVE',
          temperature: 'WARM',
        },
      })
    } else {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { phone: l.phone, whatsapp: l.whatsapp, responsibleId: l.responsibleId, stageId: novoStageId },
      })
    }
    leads[l.name] = lead.id
    console.log(`  ✔ Lead "${lead.name}" (phone ${l.phone})`)
  }

  // 1 LeadProduct: João Silva ↔ Consultoria Premium, qty=1, desc=5%
  const joaoId = leads['João Silva']!
  const consultoriaId = products['Consultoria Premium']!
  const consultoriaPrice = 5000
  const consultoriaDiscount = 5
  const finalPrice = Math.round(consultoriaPrice * 1 * (1 - consultoriaDiscount / 100) * 100) / 100
  const existingLp = await prisma.leadProduct.findFirst({ where: { leadId: joaoId, productId: consultoriaId } })
  if (!existingLp) {
    await prisma.leadProduct.create({
      data: {
        tenantId,
        leadId: joaoId,
        productId: consultoriaId,
        quantity: 1,
        unitPrice: consultoriaPrice,
        discountPercent: consultoriaDiscount,
        finalPrice,
      },
    })
  } else {
    await prisma.leadProduct.update({
      where: { id: existingLp.id },
      data: { quantity: 1, unitPrice: consultoriaPrice, discountPercent: consultoriaDiscount, finalPrice },
    })
  }
  console.log(`  ✔ LeadProduct (João Silva ↔ Consultoria Premium, 1x R$ ${finalPrice})`)
}

main()
  .catch((error) => {
    console.error('[Seed] Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
