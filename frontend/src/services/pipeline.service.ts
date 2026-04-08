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

export async function getKanban(pipelineId: string) {
  const response = await api.get(`/pipelines/${pipelineId}/kanban`)
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
