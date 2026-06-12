import type { User } from '@/types'

const API_DELAY = 500

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const mockApi = {
  auth: {
    async login(email: string, _password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
      await delay(API_DELAY)
      return {
        user: { id: 'user-1', email, nickname: '作者小明', createdAt: '2026-06-01T00:00:00Z' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      }
    },
    async register(email: string, _password: string, nickname: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
      await delay(API_DELAY)
      return {
        user: { id: 'user-1', email, nickname, createdAt: new Date().toISOString() },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      }
    },
    async getMe(): Promise<User> {
      await delay(200)
      return { id: 'user-1', email: 'author@example.com', nickname: '作者小明', createdAt: '2026-06-01T00:00:00Z' }
    },
  },
}
