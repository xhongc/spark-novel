import axios from 'axios'
import { API_BASE_URL, toApiUrl } from '@/lib/app-config'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// 请求拦截：自动加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：401 自动刷新 token
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refreshToken')

      if (refreshToken) {
        try {
          const { data } = await axios.post(toApiUrl('/auth/refresh'), { refreshToken })
          localStorage.setItem('accessToken', data.data.accessToken)
          localStorage.setItem('refreshToken', data.data.refreshToken)
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
          return api(originalRequest)
        } catch {
          // refresh 也失败，清除 token 并跳转登录
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(err)
  }
)
