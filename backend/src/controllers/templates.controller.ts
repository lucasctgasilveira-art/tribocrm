import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ── Email Templates ──

export async function getEmailTemplates(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { search, isActive } = req.query as Record<string, string | undefined>

    const where: Prisma.EmailTemplateWhereInput = { tenantId }

    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ]
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: templates })
  } catch (error) {
    console.error('[Templates] getEmailTemplates error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createEmailTemplate(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const { name, subject, body } = req.body

    if (!name || !subject) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name e subject são obrigatórios' },
      })
      return
    }

    const template = await prisma.emailTemplate.create({
      data: {
        tenantId,
        name,
        subject,
        body: body || '',
        createdBy: userId,
      },
    })

    res.status(201).json({ success: true, data: template })
  } catch (error) {
    console.error('[Templates] createEmailTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateEmailTemplate(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.emailTemplate.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Modelo de e-mail não encontrado' },
      })
      return
    }

    const { name, subject, body, isActive } = req.body

    const data: Prisma.EmailTemplateUpdateInput = {}
    if (name !== undefined) data.name = name
    if (subject !== undefined) data.subject = subject
    if (body !== undefined) data.body = body
    if (isActive !== undefined) data.isActive = isActive

    const template = await prisma.emailTemplate.update({ where: { id }, data })

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('[Templates] updateEmailTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteEmailTemplate(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.emailTemplate.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Modelo de e-mail não encontrado' },
      })
      return
    }

    await prisma.emailTemplate.update({ where: { id }, data: { isActive: false } })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Templates] deleteEmailTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── WhatsApp Templates ──

export async function getWhatsappTemplates(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { search, isActive } = req.query as Record<string, string | undefined>

    const where: Prisma.WhatsappTemplateWhereInput = { tenantId }

    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ]
    }

    const templates = await prisma.whatsappTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: templates })
  } catch (error) {
    console.error('[Templates] getWhatsappTemplates error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createWhatsappTemplate(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const { name, body } = req.body

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' },
      })
      return
    }

    const template = await prisma.whatsappTemplate.create({
      data: {
        tenantId,
        name,
        body: body || '',
        createdBy: userId,
      },
    })

    res.status(201).json({ success: true, data: template })
  } catch (error) {
    console.error('[Templates] createWhatsappTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateWhatsappTemplate(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.whatsappTemplate.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Modelo de WhatsApp não encontrado' },
      })
      return
    }

    const { name, body, isActive } = req.body

    const data: Prisma.WhatsappTemplateUpdateInput = {}
    if (name !== undefined) data.name = name
    if (body !== undefined) data.body = body
    if (isActive !== undefined) data.isActive = isActive

    const template = await prisma.whatsappTemplate.update({ where: { id }, data })

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('[Templates] updateWhatsappTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteWhatsappTemplate(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.whatsappTemplate.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Modelo de WhatsApp não encontrado' },
      })
      return
    }

    await prisma.whatsappTemplate.update({ where: { id }, data: { isActive: false } })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Templates] deleteWhatsappTemplate error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
