import { create } from 'zustand'
import type { Story, Section } from '@/types'
import { api } from '@/lib/api-client'
import { streamGenerate } from '@/lib/sse-client'

/** 将后端返回的原始故事对象转换为前端类型 */
function parseStory(raw: Record<string, unknown>): Story {
  return {
    ...raw,
    setting: (raw.setting as string) || null,
    outline: (raw.outline as string) || null,
    sectionCount: (raw.sections as unknown[])?.length ?? (raw.sectionCount as number) ?? 0,
  } as Story
}

function normalizeSection(section: Section): Section {
  return {
    ...section,
    status: section.status === 'locked' ? 'review' : section.status,
    sortOrder: typeof section.sortOrder === 'number' ? section.sortOrder : 0,
    wordCount: typeof section.wordCount === 'number' ? section.wordCount : 0,
  }
}

interface StoryState {
  stories: Story[]
  currentStory: Story | null
  sections: Section[]
  isLoading: boolean

  fetchStories: () => Promise<void>
  fetchStory: (id: string) => Promise<void>
  createStory: (title: string, premise: string, genre?: string) => Promise<Story>
  renameStory: (storyId: string, newTitle: string) => Promise<string>
  updateSetting: (storyId: string, setting: string) => Promise<void>
  generateSetting: (storyId: string, onChunk?: (text: string) => void) => Promise<string>
  generateOutline: (storyId: string, onChunk?: (text: string) => void) => Promise<string>
  confirmOutline: (storyId: string, text: string) => Promise<void>
  generateSection: (
    storyId: string,
    sectionId: string,
    onChunk: (text: string) => void,
  ) => Promise<string>
  updateSectionStatus: (sectionId: string, status: Section['status']) => Promise<void>
  reorderSections: (fromIndex: number, toIndex: number) => void
  deleteSection: (sectionId: string) => void
  deleteStory: (storyId: string) => Promise<void>
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: [],
  currentStory: null,
  sections: [],
  isLoading: false,

  fetchStories: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/stories')
      const stories = (data.data.items as Record<string, unknown>[]).map(parseStory)
      set({ stories, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchStory: async (id: string) => {
    set({ isLoading: true })
    try {
      const { data } = await api.get(`/stories/${encodeURIComponent(id)}`)
      const raw = data.data as Record<string, unknown>
      const story = parseStory(raw)
      const sections = ((raw.sections as Section[]) || []).map(normalizeSection)
      set({ currentStory: story, sections, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createStory: async (title: string, premise: string, genre?: string) => {
    const { data } = await api.post('/stories', {
      title,
      premise,
      genre,
    })
    const story = parseStory(data.data as Record<string, unknown>)
    set(state => ({ stories: [story, ...state.stories] }))
    return story
  },

  renameStory: async (storyId: string, newTitle: string) => {
    const { data } = await api.put(`/stories/${encodeURIComponent(storyId)}`, {
      title: newTitle,
    })
    const raw = data.data as Record<string, unknown>
    const newId = raw.title as string
    set(state => {
      const stories = state.stories.map(s =>
        s.id === storyId ? { ...s, id: newId, title: newTitle } : s
      )
      const currentStory = state.currentStory?.id === storyId
        ? { ...state.currentStory, id: newId, title: newTitle }
        : state.currentStory
      return { stories, currentStory }
    })
    return newId
  },

  updateSetting: async (storyId: string, setting: string) => {
    await api.put(`/stories/${encodeURIComponent(storyId)}`, {
      setting,
      stage: 'outline',
    })
    set(state => {
      const stories = state.stories.map(s =>
        s.id === storyId ? { ...s, setting, stage: 'outline' as const } : s
      )
      const currentStory = state.currentStory?.id === storyId
        ? { ...state.currentStory, setting, stage: 'outline' as const }
        : state.currentStory
      return { stories, currentStory }
    })
  },

  generateSetting: async (storyId: string, onChunk?: (text: string) => void) => {
    let result = ''
    await streamGenerate('/api/v1/generate/setting', { storyId }, {
      onChunk: (text) => {
        result += text
        onChunk?.(text)
      },
      onDone: () => {
        set(state => {
          const stories = state.stories.map(s =>
            s.id === storyId ? { ...s, setting: result, stage: 'outline' as const } : s
          )
          const currentStory = state.currentStory?.id === storyId
            ? { ...state.currentStory, setting: result, stage: 'outline' as const }
            : state.currentStory
          return { stories, currentStory }
        })
      },
    })
    return result
  },

  generateOutline: async (storyId: string, onChunk?: (text: string) => void) => {
    let result = ''
    await streamGenerate('/api/v1/generate/outline', { storyId }, {
      onChunk: (text) => {
        result += text
        onChunk?.(text)
      },
    })
    return result
  },

  confirmOutline: async (storyId: string, text: string) => {
    await api.post('/generate/outline/confirm', { storyId, text })
    await get().fetchStory(storyId)
  },

  generateSection: async (
    storyId: string,
    sectionId: string,
    onChunk: (text: string) => void,
  ) => {
    let fullText = ''
    await streamGenerate('/api/v1/generate/section', { storyId, sectionId }, {
      onChunk: (text) => {
        fullText += text
        onChunk(text)
      },
    })
    await get().fetchStory(storyId)
    return fullText
  },

  updateSectionStatus: async (sectionId: string, status: Section['status']) => {
    set(state => ({
      sections: state.sections.map(s =>
        s.id === sectionId ? { ...s, status } : s
      ),
    }))
  },

  reorderSections: (fromIndex: number, toIndex: number) => {
    set(state => {
      const sections = [...state.sections]
      const [moved] = sections.splice(fromIndex, 1)
      sections.splice(toIndex, 0, moved)
      return { sections: sections.map((s, i) => ({ ...s, sortOrder: i })) }
    })
  },

  deleteSection: (sectionId: string) => {
    set(state => ({
      sections: state.sections.filter(s => s.id !== sectionId).map((s, i) => ({ ...s, sortOrder: i })),
    }))
  },

  deleteStory: async (storyId: string) => {
    await api.delete(`/stories/${encodeURIComponent(storyId)}`)
    set(state => ({
      stories: state.stories.filter(s => s.id !== storyId),
      currentStory: state.currentStory?.id === storyId ? null : state.currentStory,
    }))
  },
}))
