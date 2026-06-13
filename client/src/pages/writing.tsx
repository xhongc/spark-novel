import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useStoryStore } from '@/stores/story-store'
import { useWritingStore } from '@/stores/writing-store'

import {
  ArrowLeft, ChevronLeft, ChevronRight, Edit3, AlertCircle,
  Check, Loader2, X, BookOpen, FileText,
} from 'lucide-react'
import type { Section } from '@/types'

const statusConfig: Record<Section['status'], { icon: React.ReactNode; label: string; color: string }> = {
  locked: { icon: <AlertCircle className="h-3 w-3" />, label: '待审核', color: 'text-amber-600 bg-amber-50' },
  review: { icon: <AlertCircle className="h-3 w-3" />, label: '待审核', color: 'text-amber-600 bg-amber-50' },
  editing: { icon: <Edit3 className="h-3 w-3" />, label: '编辑中', color: 'text-red-500 bg-red-50' },
  completed: { icon: <Check className="h-3 w-3" />, label: '已完成', color: 'text-emerald-600 bg-emerald-50' },
}

export default function WritingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sections, fetchStory, updateSectionStatus, isLoading } = useStoryStore()
  const {
    currentSectionIndex, isEditing, isDrawerOpen,
    setSectionIndex, toggleEdit, toggleDrawer,
  } = useWritingStore()

  const [editDraft, setEditDraft] = useState<{ sectionId: string; content: string } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const currentSection = sections[currentSectionIndex]
  const totalSections = sections.length
  const editContent = currentSection
    ? editDraft?.sectionId === currentSection.id
      ? editDraft.content
      : currentSection.content || ''
    : ''

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  const goToSection = useCallback((index: number) => {
    if (index >= 0 && index < totalSections) {
      setSectionIndex(index)
    }
  }, [totalSections, setSectionIndex])

  const prevSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null
  const nextSection = currentSectionIndex < totalSections - 1 ? sections[currentSectionIndex + 1] : null

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!currentSection) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="shrink-0 h-12 shadow-sm bg-background/90 backdrop-blur-sm z-20">
          <div className="flex h-full items-center justify-between px-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/stories')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={toggleDrawer}
              className="text-sm font-medium hover:text-foreground/80 transition-colors"
            >
              正文
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDrawer}>
              <X className="h-4 w-4 opacity-0" />
            </Button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">还没有可阅读的正文章节</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              请先在“大纲”里创建章节文件，或通过 AI 助手调用技能，根据设定和大纲生成章节结构与正文内容。
            </p>
          </div>
        </main>
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
              <div className="flex-1 flex items-center justify-center px-6 text-center">
                <div>
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">还没有章节</p>
                </div>
              </div>
              <div className="shadow-[inset_0_1px_0_rgba(0,0,0,0.05)] p-3 space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleDrawer(); navigate(`/stories/${id}/setting`) }}>
                  <FileText className="h-4 w-4 mr-2" /> 返回设定
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleDrawer(); navigate(`/stories/${id}/outline`) }}>
                  <BookOpen className="h-4 w-4 mr-2" /> 返回大纲
                </Button>
              </div>
            </div>
          </>
        )}
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
          {!currentSection.content ? (
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
        {currentSection.status === 'review' && !currentSection.content ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="max-w-sm text-muted-foreground leading-relaxed">
              这一节还没有正文。请通过 AI 助手调用技能，并结合当前故事文件来生成或整理内容。
            </p>
          </div>
        ) : isEditing ? (
          <div className="h-full flex flex-col p-4">
            <Textarea
              value={editContent}
              onChange={e => setEditDraft({ sectionId: currentSection.id, content: e.target.value })}
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
            ) : currentSection.content ? (
              <Button variant="outline" size="sm" onClick={toggleEdit}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> 编辑
              </Button>
            ) : null}
          </div>
        </div>

      </footer>
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
                <FileText className="h-4 w-4 mr-2" /> 返回设定
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleDrawer(); navigate(`/stories/${id}/outline`) }}>
                <BookOpen className="h-4 w-4 mr-2" /> 返回大纲
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
