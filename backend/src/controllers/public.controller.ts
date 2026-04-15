import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// Public handlers — no JWT. Mounted under /public/forms/:embedToken and
// called by the embed.js widget served from /public/embed.js on any
// landing page. The embedToken on capture_forms is the only credential
// linking the submission back to a tenant; it's generated server-side
// at form creation time and is non-guessable.

interface FieldConfig {
  label: string
  type?: string
  required?: boolean
  name?: string
}

export async function getPublicForm(req: Request, res: Response): Promise<void> {
  try {
    const embedToken = req.params.embedToken as string

    const form = await prisma.captureForm.findFirst({
      where: { embedToken, isActive: true },
      select: { id: true, name: true, fieldsConfig: true, successRedirectUrl: true, successMessage: true },
    })

    if (!form) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Formulário não encontrado ou inativo' },
      })
      return
    }

    res.json({
      success: true,
      data: {
        id: form.id,
        name: form.name,
        fieldsConfig: form.fieldsConfig,
        successRedirectUrl: form.successRedirectUrl,
        successMessage: form.successMessage,
      },
    })
  } catch (error) {
    console.error('[Public] getPublicForm error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Picks the next SELLER/TEAM_LEADER/MANAGER/OWNER via round-robin on
// pipeline.lastAssignedUserId. Mirrors the narrower logic in
// leads.controller's resolveResponsibleForPipeline but simplified for
// the embed path: no MANUAL/SPECIFIC_USER/ROUND_ROBIN_TEAM branches
// because public submissions have no authenticated user to assign to
// and no team context.
async function pickResponsible(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pipelineId: string,
  distributionType: string,
  lastAssignedUserId: string | null,
): Promise<string | null> {
  const sellers = await tx.user.findMany({
    where: {
      tenantId,
      isActive: true,
      deletedAt: null,
      role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER'] },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  if (sellers.length === 0) return null
  const pool = sellers.map(s => s.id)

  if (distributionType === 'ROUND_ROBIN_ALL' && lastAssignedUserId) {
    const idx = pool.indexOf(lastAssignedUserId)
    const next = idx === -1 ? pool[0]! : pool[(idx + 1) % pool.length]!
    // Update pipeline cursor; best-effort, ignore mismatch if pipeline
    // was reconfigured between read and write.
    await tx.pipeline.update({ where: { id: pipelineId }, data: { lastAssignedUserId: next } }).catch(() => {})
    return next
  }

  // First-time round robin OR any other distribution type: pick first
  // in pool and record it so the next submission rotates.
  const first = pool[0]!
  await tx.pipeline.update({ where: { id: pipelineId }, data: { lastAssignedUserId: first } }).catch(() => {})
  return first
}

export async function submitPublicForm(req: Request, res: Response): Promise<void> {
  try {
    const embedToken = req.params.embedToken as string
    const body = (req.body ?? {}) as Record<string, unknown>

    const form = await prisma.captureForm.findFirst({
      where: { embedToken, isActive: true },
      include: { tenant: { select: { id: true } } },
    })

    if (!form) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Formulário não encontrado ou inativo' },
      })
      return
    }

    const fields = Array.isArray(form.fieldsConfig) ? (form.fieldsConfig as unknown as FieldConfig[]) : []

    // Validate required fields. fieldsConfig entries may use either
    // `name` or `label` as the payload key — accept both.
    for (const f of fields) {
      if (!f.required) continue
      const key = (f.name ?? f.label ?? '').trim()
      if (!key) continue
      const val = body[key]
      if (val === undefined || val === null || String(val).trim() === '') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Campo obrigatório: ${f.label ?? key}` },
        })
        return
      }
    }

    const pickString = (keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = body[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
      return undefined
    }

    const name =
      pickString(['name', 'nome', 'Nome', 'Nome completo', 'fullName']) ?? 'Lead sem nome'
    const email = pickString(['email', 'Email', 'E-mail', 'e-mail'])
    const phone = pickString(['phone', 'telefone', 'Telefone', 'whatsapp', 'WhatsApp'])
    const company = pickString(['company', 'empresa', 'Empresa'])

    const tenantId = form.tenantId
    const pipelineId = form.destinationPipelineId
    const stageId = form.destinationStageId

    const result = await prisma.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.findFirst({
        where: { id: pipelineId, tenantId },
        select: { id: true, lastAssignedUserId: true },
      })
      if (!pipeline) throw new Error('Pipeline não encontrado')

      const responsibleId = await pickResponsible(
        tx,
        tenantId,
        pipeline.id,
        form.distributionType,
        pipeline.lastAssignedUserId,
      )

      if (!responsibleId) {
        throw new Error('Nenhum usuário disponível para receber o lead')
      }

      const lead = await tx.lead.create({
        data: {
          tenantId,
          pipelineId,
          stageId,
          responsibleId,
          createdBy: responsibleId,
          name,
          email,
          phone,
          company,
          source: 'FORM_EMBED',
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })

      await tx.formSubmission.create({
        data: {
          tenantId,
          formId: form.id,
          leadId: lead.id,
          rawData: body as Prisma.InputJsonValue,
          status: 'PROCESSED',
          ipAddress: (req.ip ?? req.socket.remoteAddress ?? '').slice(0, 50) || null,
        },
      })

      return { leadId: lead.id }
    })

    // Fire LEAD_CREATED automation event (non-blocking). Separate from
    // the form-level automationId: the latter targets a specific
    // workflow wired to THIS form, handled below.
    prisma.automationEvent
      .create({
        data: {
          tenantId,
          triggerType: 'LEAD_CREATED',
          leadId: result.leadId,
          payload: { source: 'FORM_EMBED', formId: form.id },
        },
      })
      .catch((e) => console.error('[Public] LEAD_CREATED event error:', e?.message))

    // Fire FORM_SUBMITTED targeted at the form's linked automation, if
    // any. The automation worker reads both event type and payload.
    if (form.automationId) {
      prisma.automationEvent
        .create({
          data: {
            tenantId,
            triggerType: 'FORM_SUBMITTED',
            leadId: result.leadId,
            payload: { formId: form.id, automationId: form.automationId },
          },
        })
        .catch((e) => console.error('[Public] FORM_SUBMITTED event error:', e?.message))
    }

    res.status(201).json({ success: true, data: { leadId: result.leadId } })
  } catch (error: any) {
    console.error('[Public] submitPublicForm error:', error?.message ?? error)

    // Best-effort record a FAILED submission so operators can see
    // broken embeds in the form stats page.
    try {
      const embedToken = req.params.embedToken as string
      const form = await prisma.captureForm.findFirst({ where: { embedToken }, select: { id: true, tenantId: true } })
      if (form) {
        await prisma.formSubmission.create({
          data: {
            tenantId: form.tenantId,
            formId: form.id,
            rawData: (req.body ?? {}) as Prisma.InputJsonValue,
            status: 'FAILED',
          },
        })
      }
    } catch { /* swallow */ }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar envio' },
    })
  }
}
