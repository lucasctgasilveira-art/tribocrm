import { Router } from 'express'
import { apiKeyAuth } from '../middleware/api-key-auth.middleware'
import { apiKeyRateLimit } from '../middleware/api-key-rate-limit.middleware'
import {
  createLeadV1, listLeadsV1, getLeadV1,
  listPipelinesV1, listTasksV1,
} from '../controllers/v1.controller'

// API pública v1. URL pública: https://api.tribocrm.com.br/v1/...
//
// Autenticação: Authorization: Bearer tcrm_live_<32 hex>. Cada tenant
// gera suas keys via UI em /gestao/configuracoes/api. Rate limit
// aplicado POR KEY (60/min, 1000/hora) — não global do tenant.
//
// Endpoints v1 (mínimo viável escolhido com Lucas em 2026-05-04):
//   POST   /v1/leads        criar lead
//   GET    /v1/leads        listar leads (paginado, filtros)
//   GET    /v1/leads/:id    buscar lead específico
//   GET    /v1/pipelines    listar pipelines + stages (pra descobrir IDs)
//   GET    /v1/tasks        listar tarefas (paginado, filtros)
//
// Sem PATCH/DELETE público de propósito — superfície de ataque mínima
// pra v1. Expansão fica pra v2 com aprendizado de uso real.

const router = Router()

router.use(apiKeyAuth)
router.use(apiKeyRateLimit)

// Leads
router.post('/leads', createLeadV1)
router.get('/leads', listLeadsV1)
router.get('/leads/:id', getLeadV1)

// Pipelines (read-only, pra discovery de IDs)
router.get('/pipelines', listPipelinesV1)

// Tasks (read-only)
router.get('/tasks', listTasksV1)

export default router
