import api from './api'

export async function getDashboard(period?: 'month' | 'quarter' | 'year') {
  const response = await api.get('/reports/dashboard', { params: { period } })
  return response.data.data
}

export async function getGestaoReports(params?: { period?: string; startDate?: string; endDate?: string }) {
  const response = await api.get('/reports/gestao', { params })
  return response.data.data
}

// ── Excel exports ─────────────────────────────────────────
// Each function pulls an xlsx blob from the matching export route
// and triggers a browser download. Consumers just `await` and
// optionally wrap in their own loading state. Filename follows the
// backend Content-Disposition header when the browser respects it;
// the explicit `a.download` below is the fallback.

interface ExportParams {
  period: string
  startDate?: string
  endDate?: string
}

async function downloadXlsx(path: string, filename: string, params: ExportParams): Promise<void> {
  const response = await api.get(path, { params, responseType: 'blob' })
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportGestaoReport(params: ExportParams): Promise<void> {
  await downloadXlsx('/reports/export/gestor', `relatorio-gestor-${params.period}.xlsx`, params)
}

export async function exportVendedorReport(params: ExportParams): Promise<void> {
  await downloadXlsx('/reports/export/vendedor', `meus-resultados-${params.period}.xlsx`, params)
}

export async function exportAdminFinanceiroReport(params: ExportParams): Promise<void> {
  await downloadXlsx('/reports/export/admin-financeiro', `admin-financeiro-${params.period}.xlsx`, params)
}

export async function exportAdminDashboardReport(params: ExportParams): Promise<void> {
  await downloadXlsx('/reports/export/admin-dashboard', `admin-dashboard-${params.period}.xlsx`, params)
}

export default {
  getDashboard,
  getGestaoReports,
  exportGestaoReport,
  exportVendedorReport,
  exportAdminFinanceiroReport,
  exportAdminDashboardReport,
}
