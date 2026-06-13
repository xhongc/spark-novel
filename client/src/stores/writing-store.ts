import { create } from 'zustand'
import { streamGenerate } from '@/lib/sse-client'
import type { ChatContext, ChatMessage } from '@/types'

type ChatMode = 'collapsed' | 'half' | 'fullscreen'

let activeChatAbortController: AbortController | null = null
let activeChatRequestId: string | null = null

interface WritingState {
  currentSectionIndex: number
  isEditing: boolean
  selectedText: string
  chatMode: ChatMode
  isDrawerOpen: boolean
  chatMessages: ChatMessage[]
  chatStatusText: string | null
  isChatSending: boolean
  isGenerating: boolean
  generatingSectionId: string | null

  setSectionIndex: (index: number) => void
  toggleEdit: () => void
  setSelectedText: (text: string) => void
  openChat: (mode?: ChatMode) => void
  closeChat: () => void
  toggleDrawer: () => void
  setChatMessages: (messages: ChatMessage[]) => void
  setChatStatusText: (status: string | null) => void
  clearChatMessages: () => void
  stopChatMessage: () => void
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
  chatStatusText: null,
  isChatSending: false,
  isGenerating: false,
  generatingSectionId: null,

  setSectionIndex: (index) => set({ currentSectionIndex: index }),

  toggleEdit: () => set(state => ({ isEditing: !state.isEditing })),

  setSelectedText: (text) => set({ selectedText: text }),

  openChat: (mode = 'half') => set({ chatMode: mode }),

  closeChat: () => set({ chatMode: 'collapsed' }),

  toggleDrawer: () => set(state => ({ isDrawerOpen: !state.isDrawerOpen })),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  setChatStatusText: (status) => set({ chatStatusText: status }),

  clearChatMessages: () => {
    activeChatRequestId = null
    activeChatAbortController?.abort()
    activeChatAbortController = null
    set({ chatMessages: [], chatStatusText: null, isChatSending: false })
  },

  stopChatMessage: () => {
    activeChatRequestId = null
    activeChatAbortController?.abort()
    activeChatAbortController = null
    set({ chatStatusText: null, isChatSending: false })
  },

  sendMessage: async (content, context) => {
    if (get().isChatSending) return

    const timestamp = Date.now()
    const requestId = `chat-${timestamp}`
    const abortController = new AbortController()
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

    activeChatAbortController?.abort()
    activeChatAbortController = abortController
    activeChatRequestId = requestId

    set(state => ({
      chatMessages: [...state.chatMessages, userMsg, assistantMsg],
      chatStatusText: '思考中...',
      isChatSending: true,
    }))

    let hasResponse = false

    try {
      await streamGenerate('/api/v1/assistant/chat', {
        content,
        ...context,
      }, {
        onProgress: (data) => {
          if (activeChatRequestId !== requestId) return
          const nextStatus = typeof data.text === 'string'
            ? data.text
            : data.type === 'start'
              ? '思考中...'
              : null
          if (!nextStatus) return
          set({ chatStatusText: nextStatus })
        },
        onChunk: (text) => {
          if (activeChatRequestId !== requestId) return
          hasResponse = true
          set(state => ({
            chatStatusText: null,
            chatMessages: state.chatMessages.map(message => (
              message.id === assistantMsg.id
                ? { ...message, content: message.content + text }
                : message
            )),
          }))
        },
        onError: (message) => {
          if (activeChatRequestId !== requestId) return
          activeChatAbortController = null
          activeChatRequestId = null
          set(state => ({
            chatStatusText: null,
            chatMessages: state.chatMessages.map(chatMessage => (
              chatMessage.id === assistantMsg.id
                ? { ...chatMessage, content: message || 'AI 回复失败，请稍后重试。' }
                : chatMessage
            )),
            isChatSending: false,
          }))
        },
        onDone: () => {
          if (activeChatRequestId !== requestId) return
          activeChatAbortController = null
          activeChatRequestId = null
          set(state => ({
            chatStatusText: null,
            chatMessages: state.chatMessages.map(chatMessage => (
              chatMessage.id === assistantMsg.id && !hasResponse
                ? { ...chatMessage, content: 'AI 暂时没有返回内容，请重试。' }
                : chatMessage
            )),
            isChatSending: false,
          }))
        },
      }, {
        signal: abortController.signal,
      })
    } catch (error) {
      const isAborted = error instanceof Error && error.name === 'AbortError'
      if (activeChatRequestId === requestId) {
        activeChatAbortController = null
        activeChatRequestId = null
      }

      if (isAborted) {
        set(state => ({
          chatStatusText: null,
          chatMessages: state.chatMessages.map(chatMessage => (
            chatMessage.id === assistantMsg.id && !chatMessage.content
              ? { ...chatMessage, content: '已停止回复。' }
              : chatMessage
          )),
          isChatSending: false,
        }))
        return
      }

      set(state => ({
        chatStatusText: null,
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
