import api from './api'
import type { PopupData } from '../components/shared/PopupManager/PopupManager'

export async function fetchActivePopups(): Promise<PopupData[]> {
  try {
    const { data } = await api.get('/popups/active')
    if (data?.success && Array.isArray(data.data)) return data.data
    return []
  } catch {
    return []
  }
}
