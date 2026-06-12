import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStoryStore } from '@/stores/story-store'
import { ArrowLeft, Loader2, RefreshCw, Sparkles, Pencil, Check, X } from 'lucide-react'

export default function SettingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, fetchStory, updateSetting, generateSetting, renameStory, isLoading } = useStoryStore()
  const [setting, setSetting] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [editDraft, setEditDraft] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const savedScrollY = window.scrollY
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    requestAnimationFrame(() => {
      window.scrollTo(0, savedScrollY)
    })
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [editDraft, resizeTextarea])

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  useEffect(() => {
    if (currentStory?.setting) {
      setSetting(currentStory.setting)
      setEditDraft(currentStory.setting)
    }
  }, [currentStory])

  const handleGenerate = async () => {
    if (!id) return
    setIsGenerating(true)
    setStreamingText('')
    try {
      const result = await generateSetting(id, (chunk) => {
        setStreamingText(prev => prev + chunk)
      })
      setSetting(result)
      setEditDraft(result)
    } catch {
      // 错误处理
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirm = async () => {
    if (!id || !editDraft) return
    setSetting(editDraft)
    await updateSetting(id, editDraft)
    navigate(`/stories/${encodeURIComponent(id)}/outline`)
  }

  const handleStartEditTitle = () => {
    setTitleDraft(currentStory?.title || '')
    setIsEditingTitle(true)
  }

  const handleSaveTitle = async () => {
    if (!id || !titleDraft.trim() || titleDraft === currentStory?.title) {
      setIsEditingTitle(false)
      return
    }
    try {
      const newId = await renameStory(id, titleDraft.trim())
      navigate(`/stories/${encodeURIComponent(newId)}/setting`, { replace: true })
    } catch {
      // 重命名失败
    }
    setIsEditingTitle(false)
  }

  if (isLoading && !setting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stories')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isEditingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false) }}
                className="h-8 text-lg font-semibold"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsEditingTitle(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartEditTitle}
              className="flex items-center gap-2 group"
            >
              <h1 className="text-lg font-semibold">{currentStory?.title || '确认设定'}</h1>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-6 pb-28" style={{ overflowAnchor: 'none' }}>
        {/* 核心梗概 */}
        <section>
          <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-1">核心梗概</h2>
          <p className="text-sm text-muted-foreground font-serif leading-relaxed">{currentStory?.premise}</p>
        </section>

        {/* 生成中：流式预览 */}
        {isGenerating && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI 正在生成设定...</span>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
                {streamingText || <span className="animate-pulse">等待响应...</span>}
              </pre>
            </div>
          </section>
        )}

        {/* 无设定且未生成：引导按钮 */}
        {!setting && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-6">AI 将根据你的故事梗概生成完整设定</p>
            <Button size="lg" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-2" /> 生成设定
            </Button>
          </div>
        )}

        {/* 设定内容 */}
        {setting && !isGenerating && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">故事设定</h2>
            <textarea
              ref={textareaRef}
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              className="w-full rounded-lg bg-muted/30 p-5 font-serif text-sm leading-[1.8] text-foreground whitespace-pre-wrap resize-none overflow-hidden focus:outline-none"
            />
          </section>
        )}
      </main>

      {/* 底部操作栏 */}
      {setting && !isGenerating && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm p-4 z-10">
          <div className="mx-auto max-w-2xl flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleGenerate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新生成
            </Button>
            <Button className="flex-1" size="lg" onClick={handleConfirm}>
              确认设定
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
