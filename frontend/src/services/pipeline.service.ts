import api from './api'

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

export default { getPipelines, getKanban, createPipeline }
