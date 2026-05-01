import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTenantId } from '../lib/platformTenant'
import { replaceVars } from '../services/automation.service'

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
          createdByUser: { select: { id: true, name: true } },
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

// Limite de caracteres pra mensagem WhatsApp custom (sem template).
// Decisao de produto: mensagens curtas tem maior taxa de leitura.
const WHATSAPP_CUSTOM_MAX = 150

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId

    const {
      leadId, type, title, description, dueDate, responsibleId,
      whatsappTemplateId, whatsappMessageBody, reminderMinutes,
    } = req.body

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

    // Resolve mensagem final do WhatsApp (snapshot) — so quando type=WHATSAPP
    // E vendedor escolheu template OU digitou mensagem custom E definiu
    // dueDate. Sem dueDate, e tarefa-lembrete normal (nao agenda envio).
    let finalMessageBody: string | null = null
    let finalTemplateId: string | null = null
    let finalSendStatus: string | null = null

    if (type === 'WHATSAPP' && dueDate && (whatsappTemplateId || whatsappMessageBody)) {
      if (whatsappTemplateId) {
        // Template salvo: busca, valida tenant, expande variaveis NA HORA do
        // agendamento (snapshot). Se template for deletado depois, a mensagem
        // ja gravada continua valida (FK SET NULL preserva a tarefa).
        const template = await prisma.whatsappTemplate.findFirst({
          where: { id: whatsappTemplateId, tenantId, isActive: true },
        })
        if (!template) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Template não encontrado' },
          })
          return
        }
        finalTemplateId = template.id
        finalMessageBody = await replaceVars(template.body, lead, prisma)
      } else if (whatsappMessageBody) {
        const body = String(whatsappMessageBody).trim()
        if (body.length > WHATSAPP_CUSTOM_MAX) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Mensagem custom não pode passar de ${WHATSAPP_CUSTOM_MAX} caracteres`,
            },
          })
          return
        }
        finalMessageBody = body
      }
      finalSendStatus = 'PENDING'
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
        whatsappTemplateId: finalTemplateId,
        whatsappMessageBody: finalMessageBody,
        sendStatus: finalSendStatus,
        reminderMinutes: reminderMinutes != null ? Number(reminderMinutes) : null,
      },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        responsible: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
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
        createdByUser: { select: { id: true, name: true } },
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

// Constrói o objeto Prisma.TaskUpdateInput a partir do body do PATCH.
// Função pura (sem Prisma client) pra ser testável — chamada pelo handler
// updateTask. Aceita os campos editáveis da Task incluindo `isDone`:
//   - isDone=true  → também seta doneAt=now() (timestamp do servidor)
//   - isDone=false → também limpa doneAt (volta a "pending")
//   - sem isDone   → comportamento preservado (não toca isDone/doneAt)
export function buildTaskUpdateData(body: Record<string, unknown>): Prisma.TaskUpdateInput {
  const data: Prisma.TaskUpdateInput = {}
  if (body.title !== undefined) data.title = body.title as string
  if (body.description !== undefined) data.description = body.description as string | null
  if (body.dueDate !== undefined) {
    const v = body.dueDate as string | null
    data.dueDate = v ? new Date(v) : null
  }
  if (body.type !== undefined) data.type = body.type as 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'VISIT'
  if (body.responsibleId !== undefined) {
    data.responsible = { connect: { id: body.responsibleId as string } }
  }
  if (body.isDone !== undefined) {
    const next = Boolean(body.isDone)
    data.isDone = next
    data.doneAt = next ? new Date() : null
  }
  return data
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

    const data = buildTaskUpdateData(req.body)

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        lead: { select: { id: true, name: true, company: true } },
        responsible: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
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

// ── WhatsApp scheduled send (extensao Chrome consome) ──
//
// Fluxo:
//   1. Vendedor cria task type='WHATSAPP' + dueDate + (template OU custom)
//      → backend marca sendStatus='PENDING'
//   2. Extensao Chrome (scheduler.ts roda chrome.alarms a cada 1 min):
//      - Chama GET /tasks/pending-whatsapp pra pegar fila
//      - Pra cada uma: navega WhatsApp Web pra conversa, injeta texto,
//        dispara Enter
//   3. Apos envio:
//      - Sucesso → POST /tasks/:id/whatsapp-sent → marca isDone=true,
//        sendStatus='SENT', sentAt=now
//      - Falha → POST /tasks/:id/whatsapp-failed → sendStatus='FAILED',
//        sendError=msg, cria Notification no CRM pra vendedor saber
//   4. Vendedor pode reenfileirar via POST /tasks/:id/whatsapp-retry
//      → reseta sendStatus='PENDING', limpa sendError

// Lista tarefas WhatsApp pendentes de envio cuja due_date ja passou.
// Escopa por responsibleId (vendedor so envia as proprias) — proximo
// ciclo do scheduler da extensao pega essa fila.
export async function getPendingWhatsappTasks(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId
    const now = new Date()

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        responsibleId: userId,
        type: 'WHATSAPP',
        sendStatus: 'PENDING',
        isDone: false,
        dueDate: { lte: now, not: null },
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, whatsapp: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    })

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('[Tasks] getPendingWhatsappTasks error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Marca tarefa WhatsApp como enviada com sucesso.
// Decisao de produto (Lucas confirmou): sendStatus='SENT' tambem
// marca a tarefa como concluida (isDone=true) — vendedor nao precisa
// fechar manualmente.
export async function markWhatsappSent(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId
    const id = req.params.id as string

    const task = await prisma.task.findFirst({
      where: { id, tenantId, responsibleId: userId, type: 'WHATSAPP' },
    })
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' } })
      return
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        sendStatus: 'SENT',
        sentAt: new Date(),
        sendError: null,
        isDone: true,
        doneAt: new Date(),
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Tasks] markWhatsappSent error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Marca tarefa WhatsApp como falha de envio. Cria Notification pro
// vendedor saber e poder retentar manualmente pelo CRM.
export async function markWhatsappFailed(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId
    const id = req.params.id as string
    const errorMessage = String(req.body?.error ?? 'Erro desconhecido').slice(0, 500)

    const task = await prisma.task.findFirst({
      where: { id, tenantId, responsibleId: userId, type: 'WHATSAPP' },
      include: { lead: { select: { name: true } } },
    })
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' } })
      return
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        sendStatus: 'FAILED',
        sendError: errorMessage,
      },
    })

    // Notificacao pro sininho do CRM. Tipo WHATSAPP_FAILED ja existe no enum.
    try {
      await prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: 'WHATSAPP_FAILED',
          title: 'Falha ao enviar WhatsApp agendado',
          body: `Não consegui enviar a mensagem para ${task.lead.name}. Motivo: ${errorMessage}`,
          link: `/vendas/tarefas?taskId=${id}`,
        },
      })
    } catch (e) {
      // Falha na notificacao nao deve bloquear o markFailed em si
      console.error('[Tasks] Notificacao WHATSAPP_FAILED falhou:', e)
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Tasks] markWhatsappFailed error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Retentar envio: reseta sendStatus='PENDING' pra que o scheduler
// pegue de novo no proximo ciclo. Botao "Enviar de novo" no CRM.
export async function retryWhatsappSend(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userId = req.user!.userId
    const id = req.params.id as string

    const task = await prisma.task.findFirst({
      where: { id, tenantId, responsibleId: userId, type: 'WHATSAPP' },
    })
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tarefa não encontrada' } })
      return
    }
    if (!task.whatsappMessageBody) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tarefa não tem mensagem WhatsApp pra reenviar' },
      })
      return
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        sendStatus: 'PENDING',
        sendError: null,
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Tasks] retryWhatsappSend error:', error)
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
          // Logical relation — null for SUPER_ADMIN-created rows
          // (see schema.prisma ManagerialTask note).
          createdByUser: { select: { id: true, name: true } },
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
        createdByUser: { select: { id: true, name: true } },
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

export async function updateManagerialTask(req: Request, res: Response): Promise<void> {
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

    const { title, description, dueDate } = req.body as { title?: string; description?: string | null; dueDate?: string | null }

    const data: Prisma.ManagerialTaskUpdateInput = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description ?? null
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null

    const task = await prisma.managerialTask.update({
      where: { id },
      data,
      include: {
        taskType: { select: { id: true, name: true } },
        participants: { select: { id: true, userId: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: task })
  } catch (error) {
    console.error('[Tasks] updateManagerialTask error:', error)
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
        createdByUser: { select: { id: true, name: true } },
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
