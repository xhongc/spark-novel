import { create } from 'zustand'
import type { Story, Section, StorySetting } from '@/types'
import { mockStories, mockSections } from '@/mocks/data'

interface StoryState {
  stories: Story[]
  currentStory: Story | null
  sections: Section[]
  isLoading: boolean

  fetchStories: () => Promise<void>
  fetchStory: (id: string) => Promise<void>
  createStory: (premise: string) => Promise<Story>
  updateSetting: (storyId: string, setting: StorySetting) => Promise<void>
  updateSectionStatus: (sectionId: string, status: Section['status']) => void
  reorderSections: (fromIndex: number, toIndex: number) => void
  deleteSection: (sectionId: string) => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: [],
  currentStory: null,
  sections: [],
  isLoading: false,

  fetchStories: async () => {
    set({ isLoading: true })
    await new Promise(r => setTimeout(r, 300))
    set({ stories: mockStories.filter(s => !s.isDeleted), isLoading: false })
  },

  fetchStory: async (id: string) => {
    set({ isLoading: true })
    await new Promise(r => setTimeout(r, 300))
    const story = mockStories.find(s => s.id === id) || null
    const sections = mockSections.filter(s => s.storyId === id)
    set({ currentStory: story, sections, isLoading: false })
  },

  createStory: async (premise: string) => {
    await new Promise(r => setTimeout(r, 500))
    const newStory: Story = {
      id: `story-${Date.now()}`,
      userId: 'user-1',
      title: premise.slice(0, 20),
      premise,
      stage: 'setting',
      setting: null,
      currentWordCount: 0,
      sectionCount: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set(state => ({ stories: [...state.stories, newStory] }))
    return newStory
  },

  updateSetting: async (storyId: string, setting: StorySetting) => {
    await new Promise(r => setTimeout(r, 300))
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

  updateSectionStatus: (sectionId: string, status: Section['status']) => {
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
      return { sections: sections.map((s, i) => ({ ...s, sortOrder: i + 1 })) }
    })
  },

  deleteSection: (sectionId: string) => {
    set(state => ({
      sections: state.sections.filter(s => s.id !== sectionId).map((s, i) => ({ ...s, sortOrder: i + 1 })),
    }))
  },
}))
