import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTenantId } from '../lib/platformTenant'

// ── Lead Tasks ──

export async function getTasks(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const role = req.user!.role
    const userId = req.user!.userId

    const {
      leadId,
      type,
      status,
      dueDate,
      page = '1',
      perPage = '20',
    } = req.query as Record<string, string | undefined>

    const pageNum = Math.max(1, parseInt(page ?? '1'))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage ?? '20')))

    const where: Prisma.TaskWhereInput = { tenantId }

    if (role === 'SELLER') where.responsibleId = userId
    if (leadId) where.leadId = leadId
    if (type) where.type = type as 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'VISIT'

    if (status === 'COMPLETED') {
      where.isDone = true
    } else if (status === 'PENDING') {
      where.isDone = false
    }

    if (dueDate) {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      if (dueDate === 'overdue') {
        where.dueDate = { lt: startOfDay }
        where.isDone = false
      } else if (dueDate === 'today') {
        where.dueDate = { gte: startOfDay, lt: endOfDay }
      } else if (dueDate === 'week') {
        const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000)
        where.dueDate = { gte: startOfDay, lt: endOfWeek }
      } else if (dueDate === 'next_week') {
        const startOfNextWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000)
        const endOfNextWeek = new Date(startOfNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
        where.dueDate = { gte: startOfNextWeek, lt: endOfNextWeek }
      }
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, company: true } },
          responsible: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
      }),
      prisma.task.count({ where }),
    ])

    res.json({
      success: true,
      data: tasks,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
      },
    })
  } catch (error) {
    console.error('[Tasks] getTasks error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId

    const { leadId, type, title, description, dueDate, responsibleId } = req.body

    if (!leadId || !type || !title) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'leadId, type e title são obrigatórios' },
      })
      return
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
    })

    if (!lead) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Lead não encontrado neste tenant' },
      })
      return
    }

    const task = await prisma.task.create({
      data: {
        tenantId,
        leadId,
        type,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        responsibleId: responsibleId || userId,
        createdBy: userId,
      },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    res.status(201).json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] createTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function completeTask(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = await resolveTenantId(req.user!.tenantId)

    const existing = await prisma.task.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' },
      })
      return
    }

    const task = await prisma.task.update({
      where: { id },
      data: { isDone: true, doneAt: new Date() },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] completeTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = await resolveTenantId(req.user!.tenantId)

    const existing = await prisma.task.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' },
      })
      return
    }

    const { title, description, dueDate, type, responsibleId } = req.body

    const data: Prisma.TaskUpdateInput = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
    if (type !== undefined) data.type = type
    if (responsibleId !== undefined) data.responsible = { connect: { id: responsibleId } }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        lead: { select: { id: true, name: true, company: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] updateTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = await resolveTenantId(req.user!.tenantId)

    const existing = await prisma.task.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' },
      })
      return
    }

    await prisma.task.delete({ where: { id } })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Tasks] deleteTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Managerial Tasks ──

export async function getManagerialTasks(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)

    const { page = '1', perPage = '20' } = req.query as Record<string, string | undefined>
    const pageNum = Math.max(1, parseInt(page ?? '1'))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage ?? '20')))

    const where: Prisma.ManagerialTaskWhereInput = { tenantId }

    const [tasks, total] = await Promise.all([
      prisma.managerialTask.findMany({
        where,
        include: {
          taskType: { select: { id: true, name: true } },
          participants: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
      }),
      prisma.managerialTask.count({ where }),
    ])

    res.json({
      success: true,
      data: tasks,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
      },
    })
  } catch (error) {
    console.error('[Tasks] getManagerialTasks error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createManagerialTask(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId

    const { title, typeId, description, dueDate, participantIds } = req.body

    if (!title || !typeId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title e typeId são obrigatórios' },
      })
      return
    }

    // typeId can be a UUID (existing type) or a name string (e.g. "EMAIL", "CALL")
    // If it's not a valid UUID, find or create the type by name
    let resolvedTypeId = typeId
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(typeId)
    if (!isUUID) {
      let taskType = await prisma.managerialTaskType.findFirst({
        where: { tenantId, name: typeId },
      })
      if (!taskType) {
        const maxOrder = await prisma.managerialTaskType.aggregate({ where: { tenantId }, _max: { sortOrder: true } })
        taskType = await prisma.managerialTaskType.create({
          data: { tenantId, name: typeId, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
        })
      }
      resolvedTypeId = taskType.id
    }

    const task = await prisma.managerialTask.create({
      data: {
        tenantId,
        typeId: resolvedTypeId,
        createdBy: userId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        participants: {
          create: (participantIds as string[] ?? []).map((uid: string) => ({
            userId: uid,
          })),
        },
      },
      include: {
        taskType: { select: { id: true, name: true } },
        participants: {
          select: { id: true, userId: true },
        },
      },
    })

    res.status(201).json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] createManagerialTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function completeManagerialTask(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = await resolveTenantId(req.user!.tenantId)

    const existing = await prisma.managerialTask.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tarefa gerencial não encontrada' },
      })
      return
    }

    const task = await prisma.managerialTask.update({
      where: { id },
      data: { isDone: true, doneAt: new Date() },
      include: {
        taskType: { select: { id: true, name: true } },
        participants: {
          select: { id: true, userId: true },
        },
      },
    })

    res.json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] completeManagerialTask error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
