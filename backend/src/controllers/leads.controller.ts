import { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ── Helpers for import ──

const HEADER_MAP: Record<string, string> = {
  'nome': 'name',
  'empresa': 'company',
  'e-mail': 'email',
  'email': 'email',
  'telefone': 'phone',
  'whatsapp': 'whatsapp',
  'cpf': 'cpf',
  'cnpj': 'cnpj',
  'cargo': 'position',
  'origem': 'source',
  'fonte': 'source',
  'temperatura': 'temperature',
  'valor esperado': 'expectedValue',
  'valor': 'expectedValue',
  'observacoes': 'notes',
  'observações': 'notes',
}

function normalizeKey(s: string): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizePhone(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/\D/g, '')
}

function normalizeEmail(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).trim().toLowerCase()
}

function parseTemperature(v: unknown): 'HOT' | 'WARM' | 'COLD' | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (['hot', 'quente', 'q'].includes(s)) return 'HOT'
  if (['warm', 'morno', 'm'].includes(s)) return 'WARM'
  if (['cold', 'frio', 'f'].includes(s)) return 'COLD'
  return null
}

function parseDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null || v === '') return null
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(',', '.'))
  if (isNaN(num)) return null
  return new Prisma.Decimal(num)
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text ?? '')
  if (typeof v === 'object' && 'richText' in (v as object)) return ((v as { richText: { text: string }[] }).richText ?? []).map(r => r.text).join('')
  return String(v)
}

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
      where.responsibleId = userId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
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

// ── Import Leads from XLSX ──

interface ImportRow {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  cpf: string | null
  cnpj: string | null
  position: string | null
  source: string | null
  temperature: 'HOT' | 'WARM' | 'COLD' | null
  expectedValue: Prisma.Decimal | null
  notes: string | null
}

export async function importLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId

    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado' } })
      return
    }

    const {
      pipelineId, stageId, responsibleId, teamId,
      distributionType = 'SPECIFIC_USER',
    } = req.body as Record<string, string | undefined>

    if (!pipelineId || !stageId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'pipelineId e stageId são obrigatórios' },
      })
      return
    }

    if (!['ROUND_ROBIN_ALL', 'ROUND_ROBIN_TEAM', 'SPECIFIC_USER'].includes(distributionType)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'distributionType inválido' },
      })
      return
    }

    // Validate pipeline + stage belong to tenant
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, tenantId },
    })
    if (!stage) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Etapa não encontrada neste pipeline' },
      })
      return
    }

    // Resolve the rotation pool of user IDs based on distributionType.
    // For SPECIFIC_USER it's a single-element list (so the round-robin
    // logic later still works — every lead gets the same one). For
    // ROUND_ROBIN_* it's the list of eligible sellers.
    let rotationPool: string[] = []
    let resolvedTeamId: string | null = null

    if (distributionType === 'SPECIFIC_USER') {
      let chosen = userId // fallback to current user
      if (responsibleId && responsibleId !== '') {
        const respUser = await prisma.user.findFirst({
          where: { id: responsibleId, tenantId, deletedAt: null },
          select: { id: true },
        })
        if (!respUser) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Responsável não encontrado neste tenant' },
          })
          return
        }
        chosen = respUser.id
      }
      rotationPool = [chosen]
    } else if (distributionType === 'ROUND_ROBIN_ALL') {
      const sellers = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER'] },
        },
        select: { id: true },
        orderBy: { name: 'asc' },
      })
      if (sellers.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_SELLERS', message: 'Nenhum vendedor ativo encontrado para distribuição automática' },
        })
        return
      }
      rotationPool = sellers.map(s => s.id)
    } else if (distributionType === 'ROUND_ROBIN_TEAM') {
      if (!teamId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'teamId é obrigatório quando distributionType=ROUND_ROBIN_TEAM' },
        })
        return
      }
      const team = await prisma.team.findFirst({
        where: { id: teamId, tenantId },
        include: {
          members: {
            include: { user: { select: { id: true, isActive: true, deletedAt: true } } },
          },
        },
      })
      if (!team) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Equipe não encontrada neste tenant' },
        })
        return
      }
      const activeMembers = team.members
        .filter(m => m.user.isActive && m.user.deletedAt === null)
        .map(m => m.user.id)
      if (activeMembers.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'EMPTY_TEAM', message: 'A equipe selecionada não possui membros ativos' },
        })
        return
      }
      rotationPool = activeMembers
      resolvedTeamId = team.id
    }

    // Parse XLSX
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(req.file.buffer as unknown as ArrayBuffer)
    } catch {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: 'Não foi possível ler o arquivo. Use o modelo .xlsx fornecido.' },
      })
      return
    }

    const sheet = wb.worksheets[0]
    if (!sheet || sheet.rowCount < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'O arquivo está vazio ou sem cabeçalho' },
      })
      return
    }

    // Read header row
    const headerRow = sheet.getRow(1)
    const headerToField: Record<number, string> = {}
    headerRow.eachCell((cell, colNumber) => {
      const text = cellText(cell).trim()
      const norm = normalizeKey(text)
      const field = HEADER_MAP[norm]
      if (field) headerToField[colNumber] = field
    })

    if (!Object.values(headerToField).includes('name')) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_NAME_COLUMN', message: 'Coluna "Nome" obrigatória não encontrada no arquivo' },
      })
      return
    }

    // Pre-load existing emails/phones/whatsapps for dedup (single query)
    const existing = await prisma.lead.findMany({
      where: { tenantId, deletedAt: null },
      select: { email: true, phone: true, whatsapp: true },
    })
    const existingEmails = new Set<string>()
    const existingPhones = new Set<string>()
    for (const e of existing) {
      const em = normalizeEmail(e.email)
      if (em) existingEmails.add(em)
      const ph = normalizePhone(e.phone)
      if (ph) existingPhones.add(ph)
      const wa = normalizePhone(e.whatsapp)
      if (wa) existingPhones.add(wa)
    }

    // Track in-file dedup
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

    const valid: ImportRow[] = []
    const errorDetails: Array<{ row: number; reason: string }> = []
    let duplicates = 0

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      // Skip fully empty rows
      let hasAny = false
      row.eachCell({ includeEmpty: false }, () => { hasAny = true })
      if (!hasAny) continue

      const data: Record<string, unknown> = {}
      for (const colStr of Object.keys(headerToField)) {
        const col = Number(colStr)
        const field = headerToField[col]!
        data[field] = cellText(row.getCell(col)).trim() || null
      }

      const name = (data.name as string | null) ?? ''
      if (!name || name.length === 0) {
        errorDetails.push({ row: r, reason: 'Campo "Nome" vazio' })
        continue
      }

      const email = normalizeEmail(data.email as string | null)
      const phone = normalizePhone(data.phone as string | null)
      const whatsapp = normalizePhone(data.whatsapp as string | null)

      // Dedup against DB
      if (email && existingEmails.has(email)) { duplicates++; continue }
      if (phone && existingPhones.has(phone)) { duplicates++; continue }
      if (whatsapp && existingPhones.has(whatsapp)) { duplicates++; continue }
      // Dedup within file
      if (email && seenEmails.has(email)) { duplicates++; continue }
      if (phone && seenPhones.has(phone)) { duplicates++; continue }
      if (whatsapp && seenPhones.has(whatsapp)) { duplicates++; continue }

      if (email) seenEmails.add(email)
      if (phone) seenPhones.add(phone)
      if (whatsapp) seenPhones.add(whatsapp)

      valid.push({
        name,
        company: (data.company as string | null) || null,
        email: (data.email as string | null) || null,
        phone: (data.phone as string | null) || null,
        whatsapp: (data.whatsapp as string | null) || null,
        cpf: (data.cpf as string | null) || null,
        cnpj: (data.cnpj as string | null) || null,
        position: (data.position as string | null) || null,
        source: (data.source as string | null) || null,
        temperature: parseTemperature(data.temperature),
        expectedValue: parseDecimal(data.expectedValue),
        notes: (data.notes as string | null) || null,
      })
    }

    let imported = 0
    if (valid.length > 0) {
      const result = await prisma.lead.createMany({
        data: valid.map((v, i) => ({
          tenantId,
          pipelineId,
          stageId,
          responsibleId: rotationPool[i % rotationPool.length]!,
          teamId: resolvedTeamId,
          createdBy: userId,
          name: v.name,
          company: v.company,
          email: v.email,
          phone: v.phone,
          whatsapp: v.whatsapp,
          cpf: v.cpf,
          cnpj: v.cnpj,
          position: v.position,
          source: v.source,
          temperature: v.temperature ?? 'COLD',
          expectedValue: v.expectedValue,
          notes: v.notes,
          status: 'ACTIVE' as const,
        })),
      })
      imported = result.count
    }

    res.json({
      success: true,
      data: {
        imported,
        duplicates,
        errors: errorDetails.length,
        errorDetails: errorDetails.slice(0, 50),
      },
    })
  } catch (error: any) {
    console.error('[Leads] importLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: error?.code ?? 'INTERNAL_ERROR', message: error?.message ?? 'Erro ao importar leads' },
    })
  }
}

// ── Export Leads (xlsx or csv, all rows for the tenant respecting filters) ──

export async function exportLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const { format = 'xlsx', search, pipelineId, stageId, status, temperature } =
      req.query as Record<string, string | undefined>

    if (format !== 'xlsx' && format !== 'csv') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'format deve ser xlsx ou csv' } })
      return
    }

    const where: Prisma.LeadWhereInput = { tenantId, deletedAt: null }
    if (status) where.status = status as 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'
    if (pipelineId) where.pipelineId = pipelineId
    if (stageId) where.stageId = stageId
    if (temperature) where.temperature = temperature as 'HOT' | 'WARM' | 'COLD'
    if (role === 'SELLER') where.responsibleId = userId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const sheet = wb.addWorksheet('Leads')

    const headers = [
      'Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp',
      'CPF', 'CNPJ', 'Cargo', 'Origem', 'Temperatura', 'Valor Esperado',
      'Etapa', 'Pipeline', 'Responsável', 'Última Atividade', 'Data de Criação',
    ]
    sheet.addRow(headers)

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    const tempLabel: Record<string, string> = { HOT: 'Quente', WARM: 'Morno', COLD: 'Frio' }
    function fmtDate(d: Date | null | undefined): string {
      if (!d) return ''
      return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    for (const l of leads) {
      sheet.addRow([
        l.name,
        l.company ?? '',
        l.email ?? '',
        l.phone ?? '',
        l.whatsapp ?? '',
        l.cpf ?? '',
        l.cnpj ?? '',
        l.position ?? '',
        l.source ?? '',
        tempLabel[l.temperature] ?? l.temperature,
        l.expectedValue ? Number(l.expectedValue) : '',
        l.stage?.name ?? '',
        l.pipeline?.name ?? '',
        l.responsible?.name ?? '',
        fmtDate(l.lastActivityAt),
        fmtDate(l.createdAt),
      ])
    }

    const widths = [22, 24, 28, 18, 18, 18, 22, 22, 16, 14, 16, 18, 18, 22, 22, 22]
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    const today = new Date().toISOString().slice(0, 10)
    if (format === 'csv') {
      const buffer = await wb.csv.writeBuffer({ formatterOptions: { delimiter: ',', quote: '"' } } as any)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="leads_export_${today}.csv"`)
      // Prepend UTF-8 BOM so Excel opens with correct encoding
      res.send(Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(buffer as ArrayBuffer)]))
    } else {
      const buffer = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="leads_export_${today}.xlsx"`)
      res.send(Buffer.from(buffer as ArrayBuffer))
    }
  } catch (error: any) {
    console.error('[Leads] exportLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao exportar leads' },
    })
  }
}

// ── GET import template (xlsx, generated on-the-fly) ──

export async function getImportTemplate(_req: Request, res: Response): Promise<void> {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const sheet = wb.addWorksheet('Leads')

    const headers = [
      'Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp',
      'CPF', 'CNPJ', 'Cargo', 'Origem', 'Temperatura', 'Valor Esperado', 'Observações',
    ]
    sheet.addRow(headers)

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    sheet.addRow(['João Silva', 'Empresa ABC Ltda', 'joao@empresaabc.com.br', '(11) 99999-0001', '(11) 99999-0001', '123.456.789-00', '', 'Diretor Comercial', 'Instagram', 'Quente', 15000, 'Lead captado via campanha de fim de ano'])
    sheet.addRow(['Maria Santos', 'Tech Solutions', 'maria@techsolutions.com', '(21) 98888-0002', '(21) 98888-0002', '', '12.345.678/0001-90', 'CEO', 'Indicação', 'Morno', 8500, ''])
    sheet.addRow(['Pedro Oliveira', 'Comércio XYZ', 'pedro@xyz.com.br', '(31) 97777-0003', '', '987.654.321-00', '', 'Gerente', 'Site', 'Frio', '', 'Aguardando retorno na próxima semana'])

    const widths = [22, 24, 28, 18, 18, 18, 22, 22, 16, 14, 16, 36]
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    const buffer = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-leads.xlsx"')
    res.send(Buffer.from(buffer as ArrayBuffer))
  } catch (error: any) {
    console.error('[Leads] getImportTemplate error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar modelo' } })
  }
}
