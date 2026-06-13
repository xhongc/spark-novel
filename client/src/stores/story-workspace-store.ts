import { create } from 'zustand'
import { api } from '@/lib/api-client'
import { streamGenerate } from '@/lib/sse-client'
import type { StoryWorkspaceItem } from '@/types'

interface StoryWorkspaceState {
  storyId: string | null
  items: StoryWorkspaceItem[]
  currentFile: StoryWorkspaceItem | null
  isLoading: boolean

  setStoryId: (storyId: string | null) => void
  fetchItems: (storyId: string, path?: string) => Promise<void>
  createFolder: (storyId: string, name: string, parentId: string | null) => Promise<void>
  createFile: (storyId: string, name: string, parentId: string | null, content?: string) => Promise<void>
  openFile: (storyId: string, id: string) => Promise<void>
  closeFile: () => void
  updateFileContent: (storyId: string, id: string, content: string) => Promise<void>
  renameItem: (storyId: string, id: string, newName: string) => Promise<void>
  deleteItem: (storyId: string, id: string) => Promise<void>
  searchFiles: (storyId: string, query: string, scope?: string, limit?: number) => Promise<StoryWorkspaceItem[]>
  generateOutline: (storyId: string, instructions?: string, onChunk?: (text: string) => void) => Promise<void>
  initDraft: (storyId: string, instructions?: string) => Promise<{ sectionCount: number; createdCount: number }>
}

export const useStoryWorkspaceStore = create<StoryWorkspaceState>((set, get) => ({
  storyId: null,
  items: [],
  currentFile: null,
  isLoading: false,

  setStoryId: (storyId) => set({ storyId }),

  fetchItems: async (storyId, path = '') => {
    set({ isLoading: true, storyId })
    try {
      const { data } = await api.get(`/stories/${encodeURIComponent(storyId)}/workspace`, {
        params: { path },
      })
      set({ items: data.data as StoryWorkspaceItem[], isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createFolder: async (storyId, name, parentId) => {
    const { data } = await api.post(`/stories/${encodeURIComponent(storyId)}/workspace/folder`, {
      name,
      parentId: parentId || '',
    })
    set(state => ({ items: [...state.items, data.data as StoryWorkspaceItem] }))
  },

  createFile: async (storyId, name, parentId, content = '') => {
    const { data } = await api.post(`/stories/${encodeURIComponent(storyId)}/workspace/file`, {
      name,
      parentId: parentId || '',
      content,
    })
    set(state => ({ items: [...state.items, data.data as StoryWorkspaceItem] }))
  },

  openFile: async (storyId, id) => {
    const currentItem = get().items.find(item => item.id === id)
    if (!currentItem || currentItem.type !== 'file') return

    set({ currentFile: { ...currentItem, content: '' } })

    try {
      const { data } = await api.get(`/stories/${encodeURIComponent(storyId)}/workspace/file`, {
        params: { path: id },
      })
      set(state => ({
        currentFile: state.currentFile?.id === id
          ? { ...state.currentFile, content: data.data.content as string }
          : state.currentFile,
      }))
    } catch {
      // Ignore file load failure.
    }
  },

  closeFile: () => set({ currentFile: null }),

  updateFileContent: async (storyId, id, content) => {
    try {
      const { data } = await api.put(`/stories/${encodeURIComponent(storyId)}/workspace/file`, {
        path: id,
        content,
      })
      set(state => ({
        items: state.items.map(item => (
          item.id === id ? { ...item, updatedAt: data.data.updatedAt as string } : item
        )),
        currentFile: state.currentFile?.id === id
          ? { ...state.currentFile, content, updatedAt: data.data.updatedAt as string }
          : state.currentFile,
      }))
    } catch {
      // Ignore save failure.
    }
  },

  renameItem: async (storyId, id, newName) => {
    try {
      const { data } = await api.put(`/stories/${encodeURIComponent(storyId)}/workspace/rename`, {
        path: id,
        newName,
      })
      const nextId = data.data.id as string
      const nextName = data.data.name as string
      set(state => ({
        items: state.items.map(item => (
          item.id === id ? { ...item, id: nextId, name: nextName } : item
        )),
        currentFile: state.currentFile?.id === id
          ? { ...state.currentFile, id: nextId, name: nextName }
          : state.currentFile,
      }))
    } catch {
      // Ignore rename failure.
    }
  },

  deleteItem: async (storyId, id) => {
    try {
      await api.delete(`/stories/${encodeURIComponent(storyId)}/workspace`, {
        data: { path: id },
      })
      set(state => ({
        items: state.items.filter(item => item.id !== id),
        currentFile: state.currentFile?.id === id ? null : state.currentFile,
      }))
    } catch {
      // Ignore delete failure.
    }
  },

  searchFiles: async (storyId, query, scope = '', limit = 8) => {
    const { data } = await api.get(`/stories/${encodeURIComponent(storyId)}/workspace/search`, {
      params: { q: query, scope, limit },
    })
    return data.data as StoryWorkspaceItem[]
  },

  generateOutline: async (storyId, instructions, onChunk) => {
    await streamGenerate(`/api/v1/stories/${encodeURIComponent(storyId)}/actions/generate-outline`, {
      instructions,
    }, {
      onChunk: (text) => {
        onChunk?.(text)
      },
    })
  },

  initDraft: async (storyId, instructions) => {
    const { data } = await api.post(`/stories/${encodeURIComponent(storyId)}/actions/init-draft`, {
      instructions,
    })
    return data.data as { sectionCount: number; createdCount: number }
  },
}))
