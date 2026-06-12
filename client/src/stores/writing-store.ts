import { create } from 'zustand'
import { streamGenerate } from '@/lib/sse-client'
import type { ChatContext, ChatMessage } from '@/types'

type ChatMode = 'collapsed' | 'half' | 'fullscreen'

interface WritingState {
  currentSectionIndex: number
  isEditing: boolean
  selectedText: string
  chatMode: ChatMode
  isDrawerOpen: boolean
  chatMessages: ChatMessage[]
  isChatSending: boolean
  isGenerating: boolean
  generatingSectionId: string | null

  setSectionIndex: (index: number) => void
  toggleEdit: () => void
  setSelectedText: (text: string) => void
  openChat: (mode?: ChatMode) => void
  closeChat: () => void
  toggleDrawer: () => void
  sendMessage: (content: string, context?: ChatContext) => Promise<void>
  startGeneration: (sectionId: string) => void
  stopGeneration: () => void
}

export const useWritingStore = create<WritingState>((set, get) => ({
  currentSectionIndex: 0,
  isEditing: false,
  selectedText: '',
  chatMode: 'collapsed',
  isDrawerOpen: false,
  chatMessages: [],
  isChatSending: false,
  isGenerating: false,
  generatingSectionId: null,

  setSectionIndex: (index) => set({ currentSectionIndex: index }),

  toggleEdit: () => set(state => ({ isEditing: !state.isEditing })),

  setSelectedText: (text) => set({ selectedText: text }),

  openChat: (mode = 'half') => set({ chatMode: mode }),

  closeChat: () => set({ chatMode: 'collapsed' }),

  toggleDrawer: () => set(state => ({ isDrawerOpen: !state.isDrawerOpen })),

  sendMessage: async (content, context) => {
    const timestamp = Date.now()
    const userMsg: ChatMessage = {
      id: `msg-user-${timestamp}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      type: 'text',
    }
    const assistantMsg: ChatMessage = {
      id: `msg-assistant-${timestamp}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      type: 'text',
    }
    const history = [...get().chatMessages, userMsg]

    set(state => ({
      chatMessages: [...state.chatMessages, userMsg, assistantMsg],
      isChatSending: true,
    }))

    let hasResponse = false

    try {
      await streamGenerate('/api/v1/assistant/chat', {
        messages: history.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
        ...context,
      }, {
        onChunk: (text) => {
          hasResponse = true
          set(state => ({
            chatMessages: state.chatMessages.map(message => (
              message.id === assistantMsg.id
                ? { ...message, content: message.content + text }
                : message
            )),
          }))
        },
        onError: (message) => {
          set(state => ({
            chatMessages: state.chatMessages.map(chatMessage => (
              chatMessage.id === assistantMsg.id
                ? { ...chatMessage, content: message || 'AI 回复失败，请稍后重试。' }
                : chatMessage
            )),
            isChatSending: false,
          }))
        },
        onDone: () => {
          set(state => ({
            chatMessages: state.chatMessages.map(chatMessage => (
              chatMessage.id === assistantMsg.id && !hasResponse
                ? { ...chatMessage, content: 'AI 暂时没有返回内容，请重试。' }
                : chatMessage
            )),
            isChatSending: false,
          }))
        },
      })
    } catch {
      set(state => ({
        chatMessages: state.chatMessages.map(chatMessage => (
          chatMessage.id === assistantMsg.id
            ? { ...chatMessage, content: 'AI 回复失败，请稍后重试。' }
            : chatMessage
        )),
        isChatSending: false,
      }))
    }
  },

  startGeneration: (sectionId) => set({ isGenerating: true, generatingSectionId: sectionId }),
  stopGeneration: () => set({ isGenerating: false, generatingSectionId: null }),
}))
