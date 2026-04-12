import api from './api'

export type PipelineDistributionType = 'MANUAL' | 'ROUND_ROBIN_ALL' | 'ROUND_ROBIN_TEAM' | 'SPECIFIC_USER'

export interface UpdatePipelinePayload {
  name?: string
  distributionType?: PipelineDistributionType
  teamId?: string | null
  specificUserId?: string | null
}

export async function getPipelines() {
  const response = await api.get('/pipelines')
  return response.data.data
}

export async function getKanban(pipelineId: string, opts?: { includeArchived?: boolean }) {
  // `includeArchived` widens the WON-stage filter server-side so
  // historical sales flipped to ARCHIVED by the monthly cron job
  // reappear in the kanban. Defaults to false to preserve the
  // existing behaviour when callers don't pass anything.
  const response = await api.get(`/pipelines/${pipelineId}/kanban`, {
    params: opts?.includeArchived ? { includeArchived: 'true' } : undefined,
  })
  return response.data.data
}

export async function createPipeline(name: string) {
  const response = await api.post('/pipelines', { name })
  return response.data.data
}

export async function updatePipeline(id: string, payload: UpdatePipelinePayload) {
  const response = await api.patch(`/pipelines/${id}`, payload)
  return response.data.data
}

export default { getPipelines, getKanban, createPipeline, updatePipeline }
