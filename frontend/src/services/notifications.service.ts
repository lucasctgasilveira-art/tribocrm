import api from './api'

export async function getNotifications(unreadOnly?: boolean) {
  const params = unreadOnly !== undefined ? { unreadOnly: String(unreadOnly) } : undefined
  const response = await api.get('/notifications', { params })
  return { data: response.data.data, meta: response.data.meta }
}

export async function markAsRead(id: string) {
  const response = await api.patch(`/notifications/${id}/read`)
  return response.data.data
}

export async function markAllAsRead() {
  const response = await api.patch('/notifications/read-all')
  return response.data.data
}

export default { getNotifications, markAsRead, markAllAsRead }
