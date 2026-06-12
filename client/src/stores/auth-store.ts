import { create } from 'zustand'
import type { User } from '@/types'
import { api } from '@/lib/api-client'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nickname: string, inviteCode: string) => Promise<void>
  logout: () => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const { user, accessToken, refreshToken } = data.data
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      set({ user, accessToken, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false })
      throw new Error('登录失败')
    }
  },

  register: async (email, password, nickname, inviteCode) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post('/auth/register', { email, password, nickname, inviteCode })
      const { user, accessToken, refreshToken } = data.data
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      set({ user, accessToken, isAuthenticated: true, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  initAuth: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.data, isAuthenticated: true, accessToken: token })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({ user: null, accessToken: null, isAuthenticated: false })
    }
  },
}))
