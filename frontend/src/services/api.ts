import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

const api = axios.create({
  baseURL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        if (data.success) {
          localStorage.setItem('accessToken', data.data.accessToken)
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
          return api(originalRequest)
        }
      } catch {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
      }
    }
    // Defesa secundária: se o backend bloquear um tenant suspenso,
    // força navegação pra tela de assinatura. O TenantStatusGate vai
    // detectar o novo status ao recarregar /auth/me e renderizar a
    // tela apropriada. Guard !== '/gestao/assinatura' evita loop caso
    // algum request dessa página dispare 403.
    if (
      error.response?.status === 403 &&
      error.response?.data?.error?.code === 'TENANT_SUSPENDED'
    ) {
      if (window.location.pathname !== '/gestao/assinatura') {
        window.location.href = '/gestao/assinatura'
      }
      return Promise.reject(error)
    }
    return Promise.reject(error)
  },
)

export default api
