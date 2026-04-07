import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export async function getLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const {
      pipelineId,
      stageId,
      status,
      temperature,
      search,
      page = '1',
      perPage = '20',
    } = req.query as Record<string, string | undefined>

    const pageNum = Math.max(1, parseInt(page ?? '1'))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage ?? '20')))

    const where: Prisma.LeadWhereInput = {
      tenantId,
      deletedAt: null,
    }

    if (status && status !== '') where.status = status as 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'
    if (pipelineId) where.pipelineId = pipelineId
    if (stageId) where.stageId = stageId
    if (temperature) where.temperature = temperature as 'HOT' | 'WARM' | 'COLD'

    if (role === 'SELLER') {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ responsibleId: userId }, { responsibleId: null }] },
      ]
    }

    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ] },
      ]
    }

    console.log('[Leads] getLeads query:', JSON.stringify({ tenantId, role, userId, where: JSON.stringify(where).slice(0, 500) }))

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          stage: { select: { id: true, name: true, color: true } },
          responsible: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
      }),
      prisma.lead.count({ where }),
    ])

    res.json({
      success: true,
      data: leads,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
      },
    })
  } catch (error) {
    console.error('[Leads] getLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const lead = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        tasks: {
          where: { isDone: false },
        },
      },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    res.json({ success: true, data: lead })
  } catch (error) {
    console.error('[Leads] getLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createLead(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId

    const { name, company, email, phone, whatsapp, expectedValue, stageId, pipelineId, temperature = 'WARM' } = req.body

    if (!name || !stageId || !pipelineId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nome, stageId e pipelineId são obrigatórios' },
      })
      return
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, tenantId, pipelineId },
    })

    if (!stage) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Etapa não encontrada neste pipeline' },
      })
      return
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        pipelineId,
        stageId,
        responsibleId: userId,
        createdBy: userId,
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        expectedValue: expectedValue ? new Prisma.Decimal(expectedValue) : null,
        temperature,
        status: 'ACTIVE',
      },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    res.status(201).json({ success: true, data: lead })
  } catch (error) {
    console.error('[Leads] createLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    const { name, company, email, phone, whatsapp, expectedValue, stageId, temperature, status, notes } = req.body

    const data: Prisma.LeadUpdateInput = {}
    if (name !== undefined) data.name = name
    if (company !== undefined) data.company = company
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (whatsapp !== undefined) data.whatsapp = whatsapp
    if (expectedValue !== undefined) data.expectedValue = expectedValue ? new Prisma.Decimal(expectedValue) : null
    if (stageId !== undefined) data.stage = { connect: { id: stageId } }
    if (temperature !== undefined) data.temperature = temperature
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    const lead = await prisma.lead.update({
      where: { id },
      data,
      include: {
        stage: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: lead })
  } catch (error) {
    console.error('[Leads] updateLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Leads] deleteLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
