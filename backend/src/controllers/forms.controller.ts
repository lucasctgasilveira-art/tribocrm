import { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export async function getForms(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const forms = await prisma.captureForm.findMany({
      where: { tenantId },
      include: {
        submissions: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with pipeline/stage names
    const enriched = await Promise.all(
      forms.map(async (form) => {
        const pipeline = await prisma.pipeline.findUnique({
          where: { id: form.destinationPipelineId },
          select: { id: true, name: true },
        })
        const stage = await prisma.pipelineStage.findUnique({
          where: { id: form.destinationStageId },
          select: { id: true, name: true },
        })

        const lastSubmission = await prisma.formSubmission.findFirst({
          where: { formId: form.id },
          orderBy: { submittedAt: 'desc' },
          select: { submittedAt: true },
        })

        return {
          id: form.id,
          name: form.name,
          fieldsConfig: form.fieldsConfig,
          destinationPipelineId: form.destinationPipelineId,
          destinationStageId: form.destinationStageId,
          distributionType: form.distributionType,
          automationId: form.automationId,
          embedToken: form.embedToken,
          isActive: form.isActive,
          createdAt: form.createdAt,
          pipeline: pipeline ?? { id: form.destinationPipelineId, name: 'Desconhecido' },
          stage: stage ?? { id: form.destinationStageId, name: 'Desconhecido' },
          leadsCount: form.submissions.length,
          lastSubmission: lastSubmission?.submittedAt ?? null,
        }
      })
    )

    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('[Forms] getForms error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createForm(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { name, pipelineId, stageId, distributionType = 'MANUAL', automationId, fieldsConfig, successRedirectUrl, successMessage } = req.body

    if (!name || !pipelineId || !stageId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name, pipelineId e stageId são obrigatórios' },
      })
      return
    }

    const embedToken = randomUUID().replace(/-/g, '').slice(0, 24)

    const form = await prisma.captureForm.create({
      data: {
        tenantId,
        name,
        destinationPipelineId: pipelineId,
        destinationStageId: stageId,
        distributionType: distributionType as 'MANUAL' | 'ROUND_ROBIN_ALL' | 'ROUND_ROBIN_TEAM' | 'SPECIFIC_USER',
        automationId: automationId || null,
        fieldsConfig: fieldsConfig ?? [
          { label: 'Nome completo', type: 'text', required: true },
          { label: 'E-mail', type: 'text', required: true },
          { label: 'Telefone', type: 'text', required: true },
        ],
        embedToken,
        successRedirectUrl: typeof successRedirectUrl === 'string' && successRedirectUrl.trim() ? successRedirectUrl.trim().slice(0, 500) : null,
        successMessage: typeof successMessage === 'string' && successMessage.trim() ? successMessage.trim().slice(0, 300) : null,
      },
    })

    res.status(201).json({ success: true, data: form })
  } catch (error) {
    console.error('[Forms] createForm error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateForm(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.captureForm.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Formulário não encontrado' },
      })
      return
    }

    const { name, pipelineId, stageId, distributionType, automationId, fieldsConfig, isActive, successRedirectUrl, successMessage } = req.body

    const data: Prisma.CaptureFormUpdateInput = {}
    if (name !== undefined) data.name = name
    if (pipelineId !== undefined) data.destinationPipelineId = pipelineId
    if (stageId !== undefined) data.destinationStageId = stageId
    if (distributionType !== undefined) data.distributionType = distributionType
    if (automationId !== undefined) data.automationId = automationId
    if (fieldsConfig !== undefined) data.fieldsConfig = fieldsConfig
    if (isActive !== undefined) data.isActive = isActive
    if (successRedirectUrl !== undefined) {
      data.successRedirectUrl = typeof successRedirectUrl === 'string' && successRedirectUrl.trim()
        ? successRedirectUrl.trim().slice(0, 500)
        : null
    }
    if (successMessage !== undefined) {
      data.successMessage = typeof successMessage === 'string' && successMessage.trim()
        ? successMessage.trim().slice(0, 300)
        : null
    }

    const form = await prisma.captureForm.update({ where: { id }, data })

    res.json({ success: true, data: form })
  } catch (error) {
    console.error('[Forms] updateForm error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteForm(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.captureForm.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Formulário não encontrado' },
      })
      return
    }

    await prisma.captureForm.update({ where: { id }, data: { isActive: false } })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Forms] deleteForm error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getFormStats(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const forms = await prisma.captureForm.findMany({
      where: { tenantId },
      select: { id: true, isActive: true },
    })

    const totalForms = forms.length
    const activeForms = forms.filter(f => f.isActive).length
    const formIds = forms.map(f => f.id)

    const totalLeadsCaptured = await prisma.formSubmission.count({
      where: { formId: { in: formIds } },
    })

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thisWeekLeads = await prisma.formSubmission.count({
      where: { formId: { in: formIds }, submittedAt: { gte: oneWeekAgo } },
    })

    res.json({
      success: true,
      data: { totalForms, activeForms, totalLeadsCaptured, thisWeekLeads },
    })
  } catch (error) {
    console.error('[Forms] getFormStats error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
