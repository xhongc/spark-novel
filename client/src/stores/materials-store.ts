import { create } from 'zustand'
import type { Material } from '@/types'
import { api } from '@/lib/api-client'

interface MaterialsState {
  materials: Material[]
  isLoading: boolean
  currentMaterial: Material | null
  editingMaterialId: string | null

  fetchMaterials: (path?: string) => Promise<void>
  createFolder: (name: string, parentId: string | null) => Promise<void>
  createFile: (name: string, parentId: string | null) => Promise<void>
  openMaterial: (id: string) => Promise<void>
  closeMaterial: () => void
  updateContent: (id: string, content: string) => Promise<void>
  renameMaterial: (id: string, newName: string) => Promise<void>
  deleteMaterial: (id: string) => Promise<void>
  startRename: (id: string) => void
  stopRename: () => void
}

export const useMaterialsStore = create<MaterialsState>((set, get) => ({
  materials: [],
  isLoading: false,
  currentMaterial: null,
  editingMaterialId: null,

  fetchMaterials: async (path = '') => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/materials', { params: { path } })
      // 替换当前目录内容，不累积
      set({ materials: data.data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createFolder: async (name, parentId) => {
    const { data } = await api.post('/materials/folder', { name, parentId: parentId || '' })
    set(state => ({ materials: [...state.materials, data.data] }))
  },

  createFile: async (name, parentId) => {
    const { data } = await api.post('/materials/file', { name, parentId: parentId || '' })
    set(state => ({ materials: [...state.materials, data.data] }))
  },

  openMaterial: async (id) => {
    const material = get().materials.find(m => m.id === id)
    if (!material) return
    set({ currentMaterial: { ...material, content: '' } })

    if (material.type === 'file') {
      try {
        const { data } = await api.get('/materials/file', { params: { path: id } })
        set(state => ({
          currentMaterial: state.currentMaterial
            ? { ...state.currentMaterial, content: data.data.content }
            : null,
        }))
      } catch {
        // 加载失败
      }
    }
  },

  closeMaterial: () => {
    set({ currentMaterial: null })
  },

  updateContent: async (id, content) => {
    try {
      const { data } = await api.put('/materials/file', { path: id, content })
      set(state => ({
        materials: state.materials.map(m =>
          m.id === id ? { ...m, updatedAt: data.data.updatedAt } : m
        ),
        currentMaterial: state.currentMaterial?.id === id
          ? { ...state.currentMaterial, content, updatedAt: data.data.updatedAt }
          : state.currentMaterial,
      }))
    } catch {
      // 保存失败
    }
  },

  renameMaterial: async (id, newName) => {
    try {
      const { data } = await api.put('/materials/rename', { path: id, newName })
      const { id: newPath, name } = data.data
      set(state => ({
        materials: state.materials.map(m =>
          m.id === id ? { ...m, id: newPath, name } : m
        ),
        currentMaterial: state.currentMaterial?.id === id
          ? { ...state.currentMaterial, id: newPath, name }
          : state.currentMaterial,
      }))
    } catch {
      // 重命名失败
    }
  },

  deleteMaterial: async (id) => {
    try {
      await api.delete('/materials', { data: { path: id } })
      set(state => ({
        materials: state.materials.filter(m => m.id !== id),
        currentMaterial: state.currentMaterial?.id === id ? null : state.currentMaterial,
      }))
    } catch {
      // 删除失败
    }
  },

  startRename: (id) => set({ editingMaterialId: id }),
  stopRename: () => set({ editingMaterialId: null }),
}))
