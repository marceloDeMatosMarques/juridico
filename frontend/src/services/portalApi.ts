import axios from 'axios'

export const portalApi = axios.create({ baseURL: '/', withCredentials: true })

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

portalApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('portal_access_token')
      window.location.href = '/portal/login'
    }
    return Promise.reject(error)
  }
)
