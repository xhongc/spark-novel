import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useStoryStore } from '@/stores/story-store'
import { useWritingStore } from '@/stores/writing-store'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Edit3, AlertCircle,
  Check, Lock, Loader2, MessageCircle, X, Send, Sparkles,
  Minimize2, Maximize2, BookOpen, FileText,
  Scissors, PenTool, Mic, Mountain,
} from 'lucide-react'
import type { Section } from '@/types'

const statusConfig: Record<Section['status'], { icon: React.ReactNode; label: string; color: string }> = {
  locked: { icon: <Lock className="h-3 w-3" />, label: '未解锁', color: 'text-gray-400 bg-gray-100' },
  review: { icon: <AlertCircle className="h-3 w-3" />, label: '待审核', color: 'text-amber-600 bg-amber-50' },
  editing: { icon: <Edit3 className="h-3 w-3" />, label: '编辑中', color: 'text-red-500 bg-red-50' },
  completed: { icon: <Check className="h-3 w-3" />, label: '已完成', color: 'text-emerald-600 bg-emerald-50' },
}

export default function WritingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, sections, fetchStory, updateSectionStatus, isLoading } = useStoryStore()
  const {
    currentSectionIndex, isEditing, chatMode, isDrawerOpen, chatMessages,
    isGenerating, generatingSectionId,
    setSectionIndex, toggleEdit, openChat, closeChat, toggleDrawer,
    sendMessage, startGeneration, stopGeneration,
  } = useWritingStore()

  const [editContent, setEditContent] = useState('')
  const [chatInput, setChatInput] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const currentSection = sections[currentSectionIndex]
  const totalSections = sections.length

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  useEffect(() => {
    if (currentSection?.content && isEditing) {
      setEditContent(currentSection.content)
    }
  }, [currentSection, isEditing])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const goToSection = useCallback((index: number) => {
    if (index >= 0 && index < totalSections) {
      setSectionIndex(index)
    }
  }, [totalSections, setSectionIndex])

  const handleGenerate = () => {
    if (!currentSection) return
    startGeneration(currentSection.id)
    setTimeout(() => {
      stopGeneration()
      updateSectionStatus(currentSection.id, 'review')
    }, 3000)
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    await sendMessage(chatInput.trim())
    setChatInput('')
  }

  const prevSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null
  const nextSection = currentSectionIndex < totalSections - 1 ? sections[currentSectionIndex + 1] : null

  if (isLoading || !currentSection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* 顶部栏 */}
      <header className="shrink-0 h-12 shadow-sm bg-background/90 backdrop-blur-sm z-20">
        <div className="flex h-full items-center justify-between px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/stories')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={toggleDrawer}
            className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80 transition-colors"
          >
            §{currentSection.sortOrder} {currentSection.title}
          </button>
          {currentSection.status === 'locked' || !currentSection.content ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[currentSection.status].color}`}>
              {statusConfig[currentSection.status].icon}
              {statusConfig[currentSection.status].label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => updateSectionStatus(currentSection.id, currentSection.status === 'completed' ? 'review' : 'completed')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${statusConfig[currentSection.status].color}`}
            >
              {statusConfig[currentSection.status].icon}
              {statusConfig[currentSection.status].label}
            </button>
          )}
        </div>
      </header>

      {/* 正文区域 */}
      <div className="flex-1 overflow-hidden relative">
        {isGenerating && generatingSectionId === currentSection.id ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="space-y-3 w-full max-w-md px-8">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </div>
            <p className="text-muted-foreground mt-6 text-sm">AI 正在为你创作...</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={stopGeneration}>
              取消
            </Button>
          </div>
        ) : currentSection.status === 'locked' ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Lock className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-2">本节尚未解锁</p>
            <p className="text-sm text-muted-foreground mb-6">请先完成前一节的审核</p>
            {prevSection && (
              <Button variant="outline" onClick={() => goToSection(currentSectionIndex - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> 回到 §{prevSection.sortOrder} {prevSection.title}
              </Button>
            )}
          </div>
        ) : currentSection.status === 'review' && !currentSection.content ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-6">本节大纲已就绪，开始生成正文</p>
            <Button size="lg" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-2" /> 生成正文
            </Button>
          </div>
        ) : isEditing ? (
          <div className="h-full flex flex-col p-4">
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="flex-1 resize-none font-serif text-base leading-[1.8] border-0 focus-visible:ring-0 p-4"
              autoFocus
            />
          </div>
        ) : (
          <div
            ref={contentRef}
            className="h-full overflow-y-auto px-6 py-8"
          >
            <div className="mx-auto max-w-[600px]">
              <article className="font-serif text-base leading-[1.8] text-foreground/90 whitespace-pre-wrap">
                {currentSection.content}
              </article>
              <div className="text-center text-muted-foreground text-sm mt-12 mb-8">
                —— 本节完 · {currentSection.wordCount.toLocaleString()} 字 ——
              </div>
            </div>
          </div>
        )}

        {/* 左右切换箭头 */}
        {currentSection.status !== 'locked' && (
          <>
            {prevSection && (
              <button
                type="button"
                onClick={() => goToSection(currentSectionIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {nextSection && (
              <button
                type="button"
                onClick={() => goToSection(currentSectionIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-md hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* 底部栏 */}
      <footer className="shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] bg-background/90 backdrop-blur-sm z-20">
        <div className="flex items-center justify-between px-4 h-14">
          {/* 左侧导航 */}
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={!prevSection}
              onClick={() => goToSection(currentSectionIndex - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {prevSection && <span className="hidden sm:inline">§{prevSection.sortOrder}</span>}
            </Button>
            <span className="text-muted-foreground px-2">
              {currentSectionIndex + 1} / {totalSections}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!nextSection}
              onClick={() => goToSection(currentSectionIndex + 1)}
              className="gap-1"
            >
              {nextSection && <span className="hidden sm:inline">§{nextSection.sortOrder}</span>}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Button size="sm" onClick={() => {
                updateSectionStatus(currentSection.id, 'editing')
                toggleEdit()
              }}>
                <Check className="h-3.5 w-3.5 mr-1" /> 保存
              </Button>
            ) : currentSection.status === 'locked' ? (
              <span className="text-sm text-muted-foreground">本节未解锁</span>
            ) : currentSection.content ? (
              <Button variant="outline" size="sm" onClick={toggleEdit}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> 编辑
              </Button>
            ) : null}
          </div>
        </div>

      </footer>

      {/* 浮层对话框 */}
      {chatMode === 'collapsed' ? (
        <button
          type="button"
          onClick={() => openChat('half')}
          className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/70 backdrop-blur-lg text-foreground shadow-lg hover:bg-white/90 transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      ) : (
        <div className={`fixed z-30 bg-background shadow-2xl transition-all rounded-t-xl ${
          chatMode === 'fullscreen'
            ? 'inset-0'
            : 'bottom-0 left-0 right-0 h-[40vh]'
        }`}>
          {/* 对话框头部 */}
          <div className="flex items-center justify-between shadow-sm px-4 h-10">
            <span className="text-sm font-medium">AI 写作助手</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openChat(chatMode === 'fullscreen' ? 'half' : 'fullscreen')}>
                {chatMode === 'fullscreen' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeChat}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 消息列表 */}
          <div className="overflow-y-auto" style={{ height: chatMode === 'fullscreen' ? 'calc(100vh - 40px - 120px)' : 'calc(40vh - 40px - 120px)' }}>
            <div className="p-4 space-y-4">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    {msg.type === 'diff' && msg.diffData ? (
                      <div className="space-y-2">
                        <p>{msg.content}</p>
                        <div className="rounded-lg shadow-sm overflow-hidden text-xs">
                          <div className="bg-red-50 px-3 py-2 line-through text-red-600">
                            {msg.diffData.original}
                          </div>
                          <div className="bg-emerald-50 px-3 py-2 text-emerald-700">
                            {msg.diffData.modified}
                          </div>
                          <div className="flex shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]">
                            <button type="button" className="flex-1 px-3 py-2 hover:bg-muted transition-colors text-center font-medium">
                              接受
                            </button>
                            <button type="button" className="flex-1 px-3 py-2 hover:bg-muted transition-colors text-center shadow-[inset_1px_0_0_rgba(0,0,0,0.06)]">
                              拒绝
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap font-serif">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* 快捷按钮 + 输入框 */}
          <div className="absolute bottom-0 left-0 right-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] bg-background">
            <div className="flex gap-2 px-4 py-2 overflow-x-auto">
              {[
                { icon: <PenTool className="h-3 w-3" />, label: '扩写' },
                { icon: <Scissors className="h-3 w-3" />, label: '缩写' },
                { icon: <Sparkles className="h-3 w-3" />, label: '润色' },
                { icon: <Mic className="h-3 w-3" />, label: '改写对白' },
                { icon: <Mountain className="h-3 w-3" />, label: '环境描写' },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => setChatInput(btn.label + '：')}
                  className="flex items-center gap-1 shrink-0 rounded-full shadow-sm px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:shadow-md transition-colors"
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 px-4 pb-3">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                placeholder="输入修改指令..."
                className="flex-1"
              />
              <Button size="icon" className="shrink-0" onClick={handleSendChat} disabled={!chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 小节导航抽屉 */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={toggleDrawer} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-background shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 shadow-sm">
              <span className="text-sm font-medium">小节列表</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleDrawer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {sections.map((section, index) => {
                const status = statusConfig[section.status]
                const isCurrent = index === currentSectionIndex
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => { setSectionIndex(index); toggleDrawer() }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isCurrent ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.color}`}>
                        {status.icon}
                      </span>
                      <span className={`text-sm ${isCurrent ? 'font-semibold' : ''}`}>
                        §{section.sortOrder} {section.title}
                      </span>
                    </div>
                    {section.wordCount > 0 && (
                      <p className="text-xs text-muted-foreground ml-6">{section.wordCount.toLocaleString()} 字</p>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="shadow-[inset_0_1px_0_rgba(0,0,0,0.05)] p-3 space-y-2">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleDrawer(); navigate(`/stories/${id}/setting`) }}>
                <FileText className="h-4 w-4 mr-2" /> 回顾故事设定
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleDrawer(); navigate(`/stories/${id}/outline`) }}>
                <BookOpen className="h-4 w-4 mr-2" /> 返回大纲编辑
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
