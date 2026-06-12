import { create } from 'zustand'
import type { Skill } from '@/types'
import { api } from '@/lib/api-client'

interface SkillsState {
  skills: Skill[]
  isLoading: boolean
  currentSkill: Skill | null
  editingSkillId: string | null

  fetchSkills: (path?: string) => Promise<void>
  createFolder: (name: string, parentId: string | null) => Promise<void>
  createFile: (name: string, parentId: string | null) => Promise<void>
  openSkill: (id: string) => Promise<void>
  closeSkill: () => void
  updateContent: (id: string, content: string) => Promise<void>
  renameSkill: (id: string, newName: string) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  startRename: (id: string) => void
  stopRename: () => void
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  isLoading: false,
  currentSkill: null,
  editingSkillId: null,

  fetchSkills: async (path = '') => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/skills', { params: { path } })
      set({ skills: data.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createFolder: async (name, parentId) => {
    const { data } = await api.post('/skills/folder', { name, parentId: parentId || '' })
    set(state => ({ skills: [...state.skills, data.data] }))
  },

  createFile: async (name, parentId) => {
    const { data } = await api.post('/skills/file', { name, parentId: parentId || '' })
    set(state => ({ skills: [...state.skills, data.data] }))
  },

  openSkill: async (id) => {
    const skill = get().skills.find(m => m.id === id)
    if (!skill) return
    set({ currentSkill: { ...skill, content: '' } })

    if (skill.type === 'file') {
      try {
        const { data } = await api.get('/skills/file', { params: { path: id } })
        set(state => ({
          currentSkill: state.currentSkill
            ? { ...state.currentSkill, content: data.data.content }
            : null,
        }))
      } catch {
        // 加载失败
      }
    }
  },

  closeSkill: () => {
    set({ currentSkill: null })
  },

  updateContent: async (id, content) => {
    try {
      const { data } = await api.put('/skills/file', { path: id, content })
      set(state => ({
        skills: state.skills.map(m =>
          m.id === id ? { ...m, updatedAt: data.data.updatedAt } : m
        ),
        currentSkill: state.currentSkill?.id === id
          ? { ...state.currentSkill, content, updatedAt: data.data.updatedAt }
          : state.currentSkill,
      }))
    } catch {
      // 保存失败
    }
  },

  renameSkill: async (id, newName) => {
    try {
      const { data } = await api.put('/skills/rename', { path: id, newName })
      const { id: newPath, name } = data.data
      set(state => ({
        skills: state.skills.map(m =>
          m.id === id ? { ...m, id: newPath, name } : m
        ),
        currentSkill: state.currentSkill?.id === id
          ? { ...state.currentSkill, id: newPath, name }
          : state.currentSkill,
      }))
    } catch {
      // 重命名失败
    }
  },

  deleteSkill: async (id) => {
    try {
      await api.delete('/skills', { data: { path: id } })
      set(state => ({
        skills: state.skills.filter(m => m.id !== id),
        currentSkill: state.currentSkill?.id === id ? null : state.currentSkill,
      }))
    } catch {
      // 删除失败
    }
  },

  startRename: (id) => set({ editingSkillId: id }),
  stopRename: () => set({ editingSkillId: null }),
}))
