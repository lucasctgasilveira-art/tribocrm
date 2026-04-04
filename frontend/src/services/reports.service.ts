import api from './api'

export async function getDashboard(period?: 'month' | 'quarter' | 'year') {
  const response = await api.get('/reports/dashboard', { params: { period } })
  return response.data.data
}

export async function getGestaoReports(params?: { period?: string; startDate?: string; endDate?: string }) {
  const response = await api.get('/reports/gestao', { params })
  return response.data.data
}

export default { getDashboard, getGestaoReports }
