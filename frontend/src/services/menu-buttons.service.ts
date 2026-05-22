import api from './api'

export interface MenuButton {
  id: string
  type: 'MENTORIA' | 'TREINAMENTOS'
  label: string
  url: string
  isActive: boolean
  order: number
}

// Admin: lista todos pra editar
export async function fetchAllMenuButtons(): Promise<MenuButton[]> {
  const { data } = await api.get('/admin/menu-buttons')
  return data?.success && Array.isArray(data.data) ? data.data : []
}

// Admin: atualiza um botão
export async function updateMenuButton(
  id: string,
  patch: Partial<Pick<MenuButton, 'label' | 'url' | 'order' | 'isActive'>>
): Promise<MenuButton> {
  const { data } = await api.patch(`/admin/menu-buttons/${id}`, patch)
  return data.data
}

// Cliente: lista ativos pra renderizar no menu lateral
export async function fetchActiveMenuButtons(): Promise<MenuButton[]> {
  try {
    const { data } = await api.get('/menu-buttons/active')
    return data?.success && Array.isArray(data.data) ? data.data : []
  } catch {
    return []
  }
}
