import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { sendMail } from '../services/mailer.service'
import { isUserInRamping } from '../lib/ramping'

function generateTempPassword(): string {
  const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += pool[Math.floor(Math.random() * pool.length)]
  return pwd
}

/**
 * Aceita string "YYYY-MM" (formato do seletor de mês na UI) ou null.
 * Retorna Date no 1º dia do mês escolhido (UTC) — User.rampingStartsAt
 * é @db.Date no schema, então o componente de hora é descartado.
 *
 * Aceita também null/undefined/string vazia → retorna null (vendedor
 * participa de todas as metas, sem rampagem).
 */
function parseRampingStartsAt(input: unknown): Date | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input !== 'string') return null
  const match = input.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1]!, 10)
  const month = parseInt(match[2]!, 10)
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

const LOGIN_URL = 'https://tribocrm.vercel.app/login'

// ── Users ──

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { search, role, teamId, isActive, userStatus } = req.query as Record<string, string | undefined>

    const where: Prisma.UserWhereInput = { tenantId, deletedAt: null }

    if (role) where.role = role as 'OWNER' | 'MANAGER' | 'TEAM_LEADER' | 'SELLER'
    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (userStatus) where.userStatus = userStatus

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (teamId) {
      where.teamMemberships = { some: { teamId } }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        cpf: true,
        birthday: true,
        avatarUrl: true,
        isActive: true,
        userStatus: true,
        rampingStartsAt: true,
        lastLoginAt: true,
        createdAt: true,
        teamMemberships: {
          include: { team: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    const mapped = users.map((u) => ({
      ...u,
      teams: u.teamMemberships.map((tm) => tm.team),
      teamMemberships: undefined,
    }))

    res.json({ success: true, data: mapped })
  } catch (error) {
    console.error('[Users] getUsers error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { name, email, password, role, cpf, birthday, teamId, pipelineIds, rampingStartsAt } = req.body

    if (!name || !email || !role) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name, email e role são obrigatórios' },
      })
      return
    }

    // pipelineIds e opcional pra OWNER (que ve tudo) e obrigatorio
    // — mas pode ser array vazio — pra demais roles. Frontend deve
    // sempre enviar. Aceitamos undefined como [] pra nao quebrar
    // compatibilidade reversa com clientes antigos.
    const pipelineIdsArr: string[] = Array.isArray(pipelineIds) ? pipelineIds : []

    const existing = await prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase(), deletedAt: null },
    })

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Já existe um usuário com este e-mail' },
      })
      return
    }

    // Plan user limit check
    const [tenantForLimit, currentUserCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: { select: { maxUsers: true, name: true } } },
      }),
      prisma.user.count({ where: { tenantId, isActive: true, deletedAt: null } }),
    ])

    if (tenantForLimit?.plan && currentUserCount >= tenantForLimit.plan.maxUsers) {
      // Notify the OWNER about the limit
      try {
        const owners = await prisma.user.findMany({
          where: { tenantId, role: 'OWNER', isActive: true, deletedAt: null },
          select: { id: true },
        })
        for (const o of owners) {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: o.id,
              type: 'TASK_DUE',
              title: 'Limite de usuários atingido',
              body: `Limite de usuários atingido (${currentUserCount}/${tenantForLimit.plan.maxUsers}). Faça upgrade do plano para adicionar mais.`,
              link: '/gestao/assinatura',
            },
          })
        }
      } catch { /* notification failure should not block the 403 response */ }

      res.status(403).json({
        success: false,
        error: {
          code: 'PLAN_LIMIT_REACHED',
          message: `Limite de ${tenantForLimit.plan.maxUsers} usuário(s) do plano ${tenantForLimit.plan.name} atingido. Faça upgrade para adicionar mais.`,
          currentCount: currentUserCount,
          maxAllowed: tenantForLimit.plan.maxUsers,
        },
      })
      return
    }

    // password is now optional — generate a temp one when missing so the
    // welcome email can deliver it. The plain value is only kept in memory
    // for this request and never logged.
    const generatedPassword = !password || String(password).trim() === ''
    const plainPassword = generatedPassword ? generateTempPassword() : String(password)
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    const user = await prisma.user.create({
      data: {
        tenantId,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        cpf: cpf || null,
        birthday: birthday ? new Date(birthday) : null,
        // Mês a partir do qual o vendedor entra na divisão de metas (rampagem).
        // String "YYYY-MM" → 1º dia do mês como Date. NULL = entra em tudo.
        // Doc seção 6.3.
        rampingStartsAt: parseRampingStartsAt(rampingStartsAt),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (teamId) {
      await prisma.teamMember.create({
        data: { tenantId, teamId, userId: user.id },
      })
    }

    // Pipeline access: OWNER ve tudo (sem precisar de linhas); demais
    // recebem as linhas de pipelineIds. Valida que cada pipelineId
    // existe no tenant antes de gravar — qualquer id invalido aborta
    // o create-related (mas o user ja foi criado; aceitamos isso pra
    // simplicidade — gestor pode ajustar pelo PUT).
    if (role !== 'OWNER' && pipelineIdsArr.length > 0) {
      const validPipelines = await prisma.pipeline.findMany({
        where: { id: { in: pipelineIdsArr }, tenantId, isActive: true },
        select: { id: true },
      })
      if (validPipelines.length > 0) {
        await prisma.userPipelineAccess.createMany({
          data: validPipelines.map(p => ({ tenantId, userId: user.id, pipelineId: p.id })),
          skipDuplicates: true,
        })
      }
    }

    // Welcome email — uses tradeName when available, falls back to name
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, tradeName: true },
    })
    const companyName = tenant?.tradeName ?? tenant?.name ?? 'sua empresa'

    const subject = 'Bem-vindo ao TriboCRM — seu acesso está pronto!'
    const text = [
      `Olá ${user.name},`,
      '',
      `Você foi adicionado ao TriboCRM pela empresa ${companyName}.`,
      '',
      'Seus dados de acesso:',
      `E-mail: ${user.email}`,
      `Senha temporária: ${plainPassword}`,
      '',
      `Acesse em: ${LOGIN_URL}`,
      '',
      'Recomendamos que você altere sua senha no primeiro acesso.',
      '',
      'Equipe TriboCRM',
    ].join('\n')
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #f97316; margin-bottom: 16px;">Bem-vindo ao TriboCRM!</h2>
        <p>Olá <strong>${user.name}</strong>,</p>
        <p>Você foi adicionado ao TriboCRM pela empresa <strong>${companyName}</strong>.</p>
        <div style="background: #f3f4f6; border-left: 4px solid #f97316; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Seus dados de acesso:</strong></p>
          <p style="margin: 4px 0;">E-mail: <code>${user.email}</code></p>
          <p style="margin: 4px 0;">Senha temporária: <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${plainPassword}</code></p>
        </div>
        <p style="margin: 20px 0;">
          <a href="${LOGIN_URL}" style="background: #f97316; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Acessar o TriboCRM</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">Recomendamos que você altere sua senha no primeiro acesso.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">Equipe TriboCRM</p>
      </div>
    `

    const mailResult = await sendMail({ to: user.email, subject, text, html, tenantId })

    res.status(201).json({
      success: true,
      data: {
        ...user,
        // Only return the plain password to the caller when we generated it
        // ourselves AND the email failed — that's the manual delivery escape
        // hatch. If the caller passed an explicit password, never echo it.
        tempPassword: generatedPassword && !mailResult.sent ? plainPassword : undefined,
        emailSent: mailResult.sent,
      },
    })
  } catch (error) {
    console.error('[Users] createUser error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' },
      })
      return
    }

    const { name, email, phone, cpf, birthday, role, isActive, userStatus, teamId, pipelineIds, rampingStartsAt } = req.body

    const data: Prisma.UserUpdateInput = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = String(email).toLowerCase()
    if (phone !== undefined) data.phone = phone || null
    if (cpf !== undefined) data.cpf = cpf || null
    if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null
    if (role !== undefined) data.role = role
    if (isActive !== undefined) data.isActive = isActive
    if (rampingStartsAt !== undefined) data.rampingStartsAt = parseRampingStartsAt(rampingStartsAt)
    if (userStatus !== undefined) {
      if (!['ACTIVE', 'VACATION', 'INACTIVE'].includes(userStatus)) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'userStatus deve ser ACTIVE, VACATION ou INACTIVE' } })
        return
      }
      data.userStatus = userStatus
      // INACTIVE implies isActive = false (can't login)
      if (userStatus === 'INACTIVE') data.isActive = false
      // ACTIVE/VACATION implies isActive = true (can login)
      if (userStatus === 'ACTIVE' || userStatus === 'VACATION') data.isActive = true
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        cpf: true,
        birthday: true,
        isActive: true,
        userStatus: true,
        createdAt: true,
      },
    })

    // Handle team membership change when teamId is provided
    if (teamId !== undefined) {
      // Remove all current memberships
      await prisma.teamMember.deleteMany({ where: { userId: id, tenantId } })
      // Add new one if provided
      if (teamId) {
        await prisma.teamMember.create({ data: { tenantId, teamId, userId: id } })
      }
    }

    // Handle pipeline access change when pipelineIds is provided.
    // Replace transacional: deleta tudo e recria. OWNER e ignorado
    // (vê tudo por padrao). Replace tambem trata caso de role mudou
    // pra OWNER (linhas viram irrelevantes — limpamos).
    if (pipelineIds !== undefined) {
      const finalRole = (data.role as string | undefined) ?? existing.role
      await prisma.userPipelineAccess.deleteMany({ where: { userId: id, tenantId } })
      if (finalRole !== 'OWNER' && Array.isArray(pipelineIds) && pipelineIds.length > 0) {
        const validPipelines = await prisma.pipeline.findMany({
          where: { id: { in: pipelineIds }, tenantId, isActive: true },
          select: { id: true },
        })
        if (validPipelines.length > 0) {
          await prisma.userPipelineAccess.createMany({
            data: validPipelines.map(p => ({ tenantId, userId: id, pipelineId: p.id })),
            skipDuplicates: true,
          })
        }
      }
    }

    res.json({ success: true, data: user })
  } catch (error) {
    console.error('[Users] updateUser error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' },
      })
      return
    }

    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Senha deve ter no mínimo 6 caracteres' },
      })
      return
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Users] resetUserPassword error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Inativação com saldo de meta (Fase C do Bug 4) ──
//
// Doc seções 6.9 e 13.7: ao inativar vendedor com goal mensal ativa,
// gestor decide o destino do saldo não alcançado (meta − realizado):
//   redistribute=true  → saldo divide igual entre demais ATIVOS
//                        não-rampantes; somam ao revenueGoal de cada.
//   redistribute=false → saldo sai da meta consolidada da equipe
//                        (totalRevenueGoal -= saldo).
// Em ambos casos, GoalIndividual do desligado é PRESERVADO sem alteração:
// realizado fica visível no nome dele nos relatórios, conforme regra fixa.

/**
 * Helper interno: encontra a goal MENSAL do mês atual no tenant que
 * tem GoalIndividual desse user com revenueGoal > 0 (ou seja, user
 * não estava em rampagem nesse goal). Pra trimestre/ano, decisão de
 * produto: deixar pra fase futura — cobrir o caso mais comum primeiro.
 */
async function findActiveMonthlyGoalForUser(tenantId: string, userId: string) {
  const now = new Date()
  const periodRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const goal = await prisma.goal.findFirst({
    where: { tenantId, periodType: 'MONTHLY', periodReference: periodRef },
    include: {
      individualGoals: {
        where: { userId },
      },
    },
  })

  if (!goal) return null
  const userGoal = goal.individualGoals[0]
  if (!userGoal || !userGoal.revenueGoal) return null
  return { goal, userGoal }
}

async function calculateUserCurrentRevenue(tenantId: string, userId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const wonLeads = await prisma.lead.findMany({
    where: {
      tenantId,
      responsibleId: userId,
      status: 'WON',
      wonAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null,
    },
    select: { closedValue: true },
  })

  return wonLeads.reduce((sum, l) => sum + (l.closedValue ? Number(l.closedValue) : 0), 0)
}

export async function getInactivationImpact(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const user = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' } })
      return
    }

    const active = await findActiveMonthlyGoalForUser(tenantId, id)
    if (!active) {
      res.json({ success: true, data: { hasActiveGoal: false } })
      return
    }

    const { goal, userGoal } = active
    const currentRevenue = await calculateUserCurrentRevenue(tenantId, id)
    const revenueGoal = Number(userGoal.revenueGoal)
    const balance = Math.max(0, revenueGoal - currentRevenue)

    // Conta vendedores ativos (que receberiam o saldo se redistribute=true).
    // Exclui o próprio (que está sendo inativado) e os rampantes desse goal.
    const otherActives = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SELLER', 'TEAM_LEADER'] },
        isActive: true,
        deletedAt: null,
        id: { not: id },
      },
      select: { id: true, rampingStartsAt: true },
    })
    const otherActiveCount = otherActives.filter(u =>
      !isUserInRamping(u.rampingStartsAt, 'MONTHLY', goal.periodReference),
    ).length

    res.json({
      success: true,
      data: {
        hasActiveGoal: true,
        goalId: goal.id,
        periodReference: goal.periodReference,
        revenueGoal,
        currentRevenue,
        balance,
        otherActiveCount,
      },
    })
  } catch (error) {
    console.error('[Users] getInactivationImpact error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function inactivateUserWithGoal(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId
    const { redistribute } = req.body as { redistribute?: boolean }

    if (typeof redistribute !== 'boolean') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'redistribute (boolean) é obrigatório' },
      })
      return
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' } })
      return
    }

    const active = await findActiveMonthlyGoalForUser(tenantId, id)

    // Transação garante atomicidade: se algo falhar no recálculo, ninguém
    // fica meio-inativado.
    await prisma.$transaction(async (tx) => {
      // 1. Marca como inativo (mesma lógica do updateUser quando userStatus='INACTIVE')
      await tx.user.update({
        where: { id },
        data: { isActive: false, userStatus: 'INACTIVE' },
      })

      if (!active) return // sem goal ativa = nada a redistribuir

      const { goal, userGoal } = active
      const currentRevenue = await calculateUserCurrentRevenue(tenantId, id)
      const revenueGoal = Number(userGoal.revenueGoal)
      const balance = Math.max(0, revenueGoal - currentRevenue)

      if (balance <= 0) return // nada pra redistribuir

      if (redistribute) {
        // Distribui igual entre os demais ativos não-rampantes deste goal.
        // Aceita só os que JÁ TÊM GoalIndividual neste goal (foram incluídos
        // na criação) — se vendedor entrou DEPOIS da meta, não recebe agora.
        const otherIndividualGoals = await tx.goalIndividual.findMany({
          where: {
            goalId: goal.id,
            userId: { not: id },
            isRamping: false,
          },
          include: { goal: false },
        })

        if (otherIndividualGoals.length === 0) return

        // Filtra ainda pra incluir só users ativos no momento atual
        const otherUserIds = otherIndividualGoals.map(g => g.userId)
        const otherUsersActive = await tx.user.findMany({
          where: { id: { in: otherUserIds }, isActive: true, deletedAt: null },
          select: { id: true },
        })
        const activeIds = new Set(otherUsersActive.map(u => u.id))
        const eligible = otherIndividualGoals.filter(g => activeIds.has(g.userId))

        if (eligible.length === 0) return

        const sharePerUser = Math.round(balance / eligible.length)

        await Promise.all(eligible.map(g =>
          tx.goalIndividual.update({
            where: { id: g.id },
            data: {
              revenueGoal: new Prisma.Decimal(Number(g.revenueGoal ?? 0) + sharePerUser),
            },
          }),
        ))
      } else {
        // Reduz a meta total da equipe pelo saldo. Realizado do desligado
        // permanece visível no GoalIndividual dele.
        const newTotal = Math.max(0, Number(goal.totalRevenueGoal ?? 0) - balance)
        await tx.goal.update({
          where: { id: goal.id },
          data: { totalRevenueGoal: new Prisma.Decimal(newTotal) },
        })
      }
    })

    res.json({ success: true, data: { id, isActive: false, userStatus: 'INACTIVE' } })
  } catch (error) {
    console.error('[Users] inactivateUserWithGoal error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Teams ──

export async function getTeams(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const teams = await prisma.team.findMany({
      where: { tenantId },
      include: {
        leader: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({ success: true, data: teams })
  } catch (error) {
    console.error('[Users] getTeams error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createTeam(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { name, leaderId, memberIds } = req.body

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nome do time é obrigatório' },
      })
      return
    }

    if (leaderId) {
      const leader = await prisma.user.findFirst({
        where: { id: leaderId, tenantId, deletedAt: null },
      })
      if (!leader) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Líder não encontrado neste tenant' },
        })
        return
      }
    }

    const team = await prisma.team.create({
      data: {
        tenantId,
        name,
        leaderId: leaderId || null,
        members: {
          create: (memberIds as string[] ?? []).map((userId: string) => ({
            tenantId,
            userId,
          })),
        },
      },
      include: {
        leader: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
      },
    })

    res.status(201).json({ success: true, data: team })
  } catch (error) {
    console.error('[Users] createTeam error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateTeam(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.team.findFirst({
      where: { id, tenantId },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Time não encontrado' },
      })
      return
    }

    const { name, leaderId, memberIds } = req.body

    const data: Prisma.TeamUpdateInput = {}
    if (name !== undefined) data.name = name
    if (leaderId !== undefined) data.leader = leaderId ? { connect: { id: leaderId } } : { disconnect: true }

    await prisma.team.update({ where: { id }, data })

    if (memberIds !== undefined) {
      await prisma.teamMember.deleteMany({ where: { teamId: id } })
      if ((memberIds as string[]).length > 0) {
        await prisma.teamMember.createMany({
          data: (memberIds as string[]).map((userId: string) => ({
            tenantId,
            teamId: id,
            userId,
          })),
        })
      }
    }

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        leader: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
      },
    })

    res.json({ success: true, data: team })
  } catch (error) {
    console.error('[Users] updateTeam error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
