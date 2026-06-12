import { create } from 'zustand'
import type { ChatMessage } from '@/types'
import { mockChatMessages } from '@/mocks/data'

type ChatMode = 'collapsed' | 'half' | 'fullscreen'

interface WritingState {
  currentSectionIndex: number
  isEditing: boolean
  selectedText: string
  chatMode: ChatMode
  isDrawerOpen: boolean
  chatMessages: ChatMessage[]
  isGenerating: boolean
  generatingSectionId: string | null

  setSectionIndex: (index: number) => void
  toggleEdit: () => void
  setSelectedText: (text: string) => void
  openChat: (mode?: ChatMode) => void
  closeChat: () => void
  toggleDrawer: () => void
  sendMessage: (content: string) => Promise<void>
  startGeneration: (sectionId: string) => void
  stopGeneration: () => void
}

export const useWritingStore = create<WritingState>((set, get) => ({
  currentSectionIndex: 0,
  isEditing: false,
  selectedText: '',
  chatMode: 'collapsed',
  isDrawerOpen: false,
  chatMessages: mockChatMessages,
  isGenerating: false,
  generatingSectionId: null,

  setSectionIndex: (index) => set({ currentSectionIndex: index }),

  toggleEdit: () => set(state => ({ isEditing: !state.isEditing })),

  setSelectedText: (text) => set({ selectedText: text }),

  openChat: (mode = 'half') => set({ chatMode: mode }),

  closeChat: () => set({ chatMode: 'collapsed' }),

  toggleDrawer: () => set(state => ({ isDrawerOpen: !state.isDrawerOpen })),

  sendMessage: async (content) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      type: 'text',
    }
    set(state => ({ chatMessages: [...state.chatMessages, userMsg] }))

    await new Promise(r => setTimeout(r, 800))

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: `好的，我来处理你的请求："${content.slice(0, 30)}..."`,
      createdAt: new Date().toISOString(),
      type: 'text',
    }
    set(state => ({ chatMessages: [...state.chatMessages, assistantMsg] }))
  },

  startGeneration: (sectionId) => set({ isGenerating: true, generatingSectionId: sectionId }),
  stopGeneration: () => set({ isGenerating: false, generatingSectionId: null }),
}))
