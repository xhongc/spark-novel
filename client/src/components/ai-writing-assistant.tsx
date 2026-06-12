import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'
import { useMaterialsStore } from '@/stores/materials-store'
import { useStoryStore } from '@/stores/story-store'
import { useWritingStore } from '@/stores/writing-store'
import type { ChatReference, Material, Skill } from '@/types'
import {
  AtSign,
  FileText,
  Folder,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

type LookupTrigger = '/' | '@'

interface LookupState {
  trigger: LookupTrigger
  query: string
  start: number
  end: number
}

interface AssistantSuggestion {
  id: string
  name: string
  kind: 'material' | 'skill'
  itemType: 'file' | 'folder' | 'virtual'
  parentId?: string | null
  description?: string
  content?: string
  isCurrentPage?: boolean
}

function getLookupState(value: string, caret: number): LookupState | null {
  const beforeCaret = value.slice(0, caret)
  const match = beforeCaret.match(/(^|\s)([@/])([^\s@/]*)$/)
  if (!match) return null

  const fullMatch = match[0]
  const trigger = match[2] as LookupTrigger
  const query = match[3] || ''
  const start = beforeCaret.length - fullMatch.length + match[1].length

  return {
    trigger,
    query,
    start,
    end: caret,
  }
}

function removeLookupToken(value: string, lookup: LookupState | null): string {
  if (!lookup) return value

  const before = value.slice(0, lookup.start).replace(/\s+$/, '')
  const after = value.slice(lookup.end).replace(/^\s+/, '')
  if (!before) return after
  if (!after) return before
  return `${before} ${after}`
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true
  return value.toLowerCase().includes(query.trim().toLowerCase())
}

export default function AIWritingAssistant() {
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { currentStory, sections } = useStoryStore()
  const { currentMaterial } = useMaterialsStore()
  const {
    chatMode,
    chatMessages,
    currentSectionIndex,
    selectedText,
    isChatSending,
    openChat,
    closeChat,
    clearChatMessages,
    sendMessage,
    stopChatMessage,
  } = useWritingStore()

  const [chatInput, setChatInput] = useState('')
  const [caretPosition, setCaretPosition] = useState(0)
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const [dismissedLookupKey, setDismissedLookupKey] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([])
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectedReferences, setSelectedReferences] = useState<AssistantSuggestion[]>([])

  const isWritingRoute = /^\/stories\/[^/]+$/.test(location.pathname)
  const isMaterialsRoute = location.pathname === '/materials'
  const currentSection = sections[currentSectionIndex]

  const currentPageMaterial = useMemo(() => {
    if (isMaterialsRoute && currentMaterial?.type === 'file') {
      return {
        id: currentMaterial.id,
        name: currentMaterial.name,
        kind: 'material' as const,
        itemType: 'file' as const,
        parentId: currentMaterial.parentId,
        content: currentMaterial.content,
        isCurrentPage: true,
      }
    }

    if (isWritingRoute && currentSection) {
      return {
        id: `section:${currentSection.id}`,
        name: currentSection.title,
        kind: 'material' as const,
        itemType: 'virtual' as const,
        content: currentSection.content || '',
        isCurrentPage: true,
      }
    }

    return null
  }, [currentMaterial, currentSection, isMaterialsRoute, isWritingRoute])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    const nextLookup = getLookupState(chatInput, caretPosition)
    if (!nextLookup) {
      setLookup(null)
      return
    }

    const nextLookupKey = `${nextLookup.trigger}:${nextLookup.start}:${nextLookup.query}`
    if (dismissedLookupKey === nextLookupKey) {
      setLookup(null)
      return
    }

    setLookup(nextLookup)
  }, [chatInput, caretPosition, dismissedLookupKey])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      if (!lookup) {
        setSuggestions([])
        setHighlightedIndex(0)
        return
      }

      setIsSuggestionLoading(true)

      try {
        if (lookup.trigger === '/') {
          const { data } = await api.get('/skills/search', {
            params: {
              q: lookup.query,
              limit: 6,
            },
          })

          if (cancelled) return

          const nextSuggestions = (data.data as Skill[])
            .filter(skill => skill.type === 'folder')
            .map(skill => ({
              id: skill.id,
              name: skill.name,
              kind: 'skill' as const,
              itemType: skill.type,
              parentId: skill.parentId,
              description: skill.description,
            }))

          setSuggestions(nextSuggestions)
          setHighlightedIndex(0)
          return
        }

        const { data } = await api.get('/materials/search', {
          params: {
            q: lookup.query,
            limit: 8,
          },
        })

        if (cancelled) return

        const nextSuggestions = (data.data as Material[])
          .filter(material => material.type === 'file')
          .map(material => ({
            id: material.id,
            name: material.name,
            kind: 'material' as const,
            itemType: 'file' as const,
            parentId: material.parentId,
          }))

        const filteredCurrentPageMaterial = currentPageMaterial && matchesQuery(currentPageMaterial.name, lookup.query)
          ? currentPageMaterial
          : null

        const otherMaterials = nextSuggestions
          .filter(material => material.id !== filteredCurrentPageMaterial?.id)
          .slice(0, 4)

        setSuggestions(filteredCurrentPageMaterial ? [filteredCurrentPageMaterial, ...otherMaterials] : otherMaterials)
        setHighlightedIndex(0)
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setHighlightedIndex(0)
        }
      } finally {
        if (!cancelled) {
          setIsSuggestionLoading(false)
        }
      }
    }

    const timer = window.setTimeout(() => {
      void loadSuggestions()
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [lookup, currentPageMaterial])

  const handleSelectSuggestion = (suggestion: AssistantSuggestion) => {
    setDismissedLookupKey(null)
    setSelectedReferences(prev => (
      prev.some(item => item.kind === suggestion.kind && item.id === suggestion.id)
        ? prev
        : [...prev, suggestion]
    ))

    const nextInput = removeLookupToken(chatInput, lookup)
    setChatInput(nextInput)
    setCaretPosition(nextInput.length)
    setLookup(null)
    setSuggestions([])
    setHighlightedIndex(0)

    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextInput.length, nextInput.length)
    })
  }

  const handleRemoveReference = (reference: AssistantSuggestion) => {
    setSelectedReferences(prev => prev.filter(item => !(item.kind === reference.kind && item.id === reference.id)))
  }

  const resolveReferenceContent = async (reference: AssistantSuggestion): Promise<ChatReference | null> => {
    if (reference.kind === 'material') {
      if (reference.itemType === 'virtual') {
        return reference.content
          ? { id: reference.id, name: reference.name, content: reference.content }
          : null
      }

      const { data } = await api.get('/materials/file', {
        params: { path: reference.id },
      })

      return {
        id: reference.id,
        name: reference.name,
        content: data.data.content,
      }
    }

    const skillPath = reference.itemType === 'folder'
      ? `${reference.id}/SKILL.md`
      : reference.id
    const { data } = await api.get('/skills/file', {
      params: { path: skillPath },
    })

    return {
      id: reference.id,
      name: reference.name,
      content: data.data.content,
    }
  }

  const handleSendChat = async () => {
    const content = chatInput.trim()
    if (!content || isChatSending) return

    const resolvedReferences = await Promise.all(
      selectedReferences.map(async (reference) => {
        try {
          const resolved = await resolveReferenceContent(reference)
          return resolved ? { kind: reference.kind, reference: resolved } : null
        } catch {
          return null
        }
      }),
    )

    const referencedMaterials = resolvedReferences
      .filter((item): item is { kind: 'material' | 'skill'; reference: ChatReference } => !!item && item.kind === 'material')
      .map(item => item.reference)
    const referencedSkills = resolvedReferences
      .filter((item): item is { kind: 'material' | 'skill'; reference: ChatReference } => !!item && item.kind === 'skill')
      .map(item => item.reference)

    await sendMessage(content, {
      currentPath: location.pathname,
      currentStoryTitle: currentStory?.title,
      currentSectionTitle: isWritingRoute ? currentSection?.title : undefined,
      currentSectionContent: isWritingRoute ? currentSection?.content : undefined,
      selectedText: selectedText || undefined,
      referencedMaterials: referencedMaterials.length > 0 ? referencedMaterials : undefined,
      referencedSkills: referencedSkills.length > 0 ? referencedSkills : undefined,
    })

    setChatInput('')
    setCaretPosition(0)
    setLookup(null)
    setDismissedLookupKey(null)
    setSuggestions([])
    setSelectedReferences([])
  }

  const handleClearChat = () => {
    clearChatMessages()
    setChatInput('')
    setCaretPosition(0)
    setLookup(null)
    setDismissedLookupKey(null)
    setSuggestions([])
    setHighlightedIndex(0)
    setSelectedReferences([])
  }

  if (chatMode === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => openChat('half')}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-foreground shadow-lg backdrop-blur-lg transition-colors hover:bg-white/90"
        aria-label="打开 AI 写作助手"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div
      className={`fixed z-40 rounded-t-xl bg-background shadow-2xl transition-all ${
        chatMode === 'fullscreen' ? 'inset-0' : 'bottom-0 left-0 right-0 h-[40vh]'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center justify-between px-4 shadow-sm">
          <span className="text-sm font-medium">AI 写作助手</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClearChat}
              title="清空会话"
              aria-label="清空会话"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openChat(chatMode === 'fullscreen' ? 'half' : 'fullscreen')}
            >
              {chatMode === 'fullscreen' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {msg.type === 'diff' && msg.diffData ? (
                    <div className="space-y-2">
                      <p>{msg.content}</p>
                      <div className="overflow-hidden rounded-lg text-xs shadow-sm">
                        <div className="bg-red-50 px-3 py-2 text-red-600 line-through">
                          {msg.diffData.original}
                        </div>
                        <div className="bg-emerald-50 px-3 py-2 text-emerald-700">
                          {msg.diffData.modified}
                        </div>
                        <div className="flex shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]">
                          <button
                            type="button"
                            className="flex-1 px-3 py-2 text-center font-medium transition-colors hover:bg-muted"
                          >
                            接受
                          </button>
                          <button
                            type="button"
                            className="flex-1 px-3 py-2 text-center shadow-[inset_1px_0_0_rgba(0,0,0,0.06)] transition-colors hover:bg-muted"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap font-serif">
                      {msg.content || (msg.role === 'assistant' && isChatSending ? '思考中...' : '')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div className="bg-background px-4 pb-3 pt-2 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          {selectedReferences.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedReferences.map(reference => (
                <button
                  key={`${reference.kind}:${reference.id}`}
                  type="button"
                  onClick={() => handleRemoveReference(reference)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  {reference.kind === 'skill' ? <Zap className="h-3 w-3" /> : <AtSign className="h-3 w-3" />}
                  <span className="max-w-[160px] truncate">{reference.name}</span>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            {(lookup || isSuggestionLoading) && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-background shadow-xl">
                <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                  {lookup?.trigger === '/'
                    ? '输入 / 检索技能'
                    : '输入 @ 检索素材'}
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {isSuggestionLoading ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>检索中...</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.kind}:${suggestion.id}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          highlightedIndex === index ? 'bg-accent' : 'hover:bg-accent/70'
                        }`}
                      >
                        <div className="mt-0.5 text-muted-foreground">
                          {suggestion.kind === 'skill' ? (
                            suggestion.itemType === 'folder'
                              ? <Zap className="h-4 w-4" />
                              : <Sparkles className="h-4 w-4" />
                          ) : (
                            suggestion.itemType === 'folder'
                              ? <Folder className="h-4 w-4" />
                              : <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{suggestion.name}</p>
                            {suggestion.isCurrentPage && (
                              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                                本页
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {suggestion.description || suggestion.parentId || (suggestion.kind === 'skill' ? '技能' : '素材')}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">没有匹配结果</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={chatInput}
                onChange={e => {
                  setDismissedLookupKey(null)
                  setChatInput(e.target.value)
                  setCaretPosition(e.target.selectionStart ?? e.target.value.length)
                }}
                onClick={e => setCaretPosition(e.currentTarget.selectionStart ?? chatInput.length)}
                onKeyUp={e => setCaretPosition(e.currentTarget.selectionStart ?? chatInput.length)}
                onKeyDown={e => {
                  if ((lookup || suggestions.length > 0) && e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightedIndex(prev => (
                      suggestions.length === 0 ? 0 : (prev + 1) % suggestions.length
                    ))
                    return
                  }

                  if ((lookup || suggestions.length > 0) && e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightedIndex(prev => (
                      suggestions.length === 0 ? 0 : (prev - 1 + suggestions.length) % suggestions.length
                    ))
                    return
                  }

                  if ((lookup || suggestions.length > 0) && e.key === 'Escape') {
                    e.preventDefault()
                    const nextLookup = getLookupState(chatInput, e.currentTarget.selectionStart ?? caretPosition)
                    if (nextLookup) {
                      setDismissedLookupKey(`${nextLookup.trigger}:${nextLookup.start}:${nextLookup.query}`)
                    }
                    setLookup(null)
                    setSuggestions([])
                    return
                  }

                  if ((lookup || suggestions.length > 0) && e.key === 'Enter' && suggestions[highlightedIndex]) {
                    e.preventDefault()
                    handleSelectSuggestion(suggestions[highlightedIndex])
                    return
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendChat()
                  }
                }}
                placeholder="输入问题，/ 调用技能，@ 引用素材"
                className="flex-1"
                disabled={isChatSending}
              />
              {isChatSending ? (
                <Button
                  size="icon"
                  variant="destructive"
                  className="shrink-0"
                  onClick={stopChatMessage}
                  title="终止回复"
                  aria-label="终止回复"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button size="icon" className="shrink-0" onClick={() => void handleSendChat()} disabled={!chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
