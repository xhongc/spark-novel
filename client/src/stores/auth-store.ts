import { create } from 'zustand'
import type { User } from '@/types'
import { mockApi } from '@/mocks/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const result = await mockApi.auth.login(email, password)
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      set({ user: result.user, accessToken: result.accessToken, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false })
      throw new Error('登录失败')
    }
  },

  register: async (email, password, nickname) => {
    set({ isLoading: true })
    try {
      const result = await mockApi.auth.register(email, password, nickname)
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      set({ user: result.user, accessToken: result.accessToken, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false })
      throw new Error('注册失败')
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
      const user = await mockApi.auth.getMe()
      set({ user, isAuthenticated: true, accessToken: token })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({ user: null, accessToken: null, isAuthenticated: false })
    }
  },
}))
