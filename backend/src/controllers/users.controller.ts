import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ── Users ──

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { search, role, teamId, isActive } = req.query as Record<string, string | undefined>

    const where: Prisma.UserWhereInput = { tenantId, deletedAt: null }

    if (role) where.role = role as 'OWNER' | 'MANAGER' | 'TEAM_LEADER' | 'SELLER'
    if (isActive !== undefined) where.isActive = isActive === 'true'

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
    const { name, email, password, role, cpf, birthday, teamId } = req.body

    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name, email, password e role são obrigatórios' },
      })
      return
    }

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

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        tenantId,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        cpf: cpf || null,
        birthday: birthday ? new Date(birthday) : null,
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

    res.status(201).json({ success: true, data: user })
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

    const { name, role, isActive } = req.body

    const data: Prisma.UserUpdateInput = {}
    if (name !== undefined) data.name = name
    if (role !== undefined) data.role = role
    if (isActive !== undefined) data.isActive = isActive

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

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
