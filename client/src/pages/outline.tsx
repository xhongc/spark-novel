import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useStoryStore } from '@/stores/story-store'
import { ArrowLeft, Loader2, RefreshCw, Edit3, Check, X } from 'lucide-react'

export default function OutlinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, sections, fetchStory, generateOutline, confirmOutline, isLoading } = useStoryStore()
  const [outlineText, setOutlineText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => {
    if (isGenerating) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [streamingText, isGenerating])

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  // 从 sections 同步大纲文本（已确认的大纲，sections 存在）
  useEffect(() => {
    if (sections.length > 0 && outlineText === null && !isGenerating) {
      // 已有 sections，说明大纲已确认，从服务器读取大纲.md
      // outlineText 保持 null，直接显示 sections
    }
  }, [sections, outlineText, isGenerating])

  const handleGenerate = async () => {
    if (!id) return
    setIsGenerating(true)
    setStreamingText('')
    setOutlineText(null)
    setIsEditing(false)
    try {
      const result = await generateOutline(id, (chunk) => {
        setStreamingText(prev => prev + chunk)
      })
      setOutlineText(result)
    } catch {
      // 错误处理
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartEdit = () => {
    setEditDraft(outlineText || '')
    setIsEditing(true)
    requestAnimationFrame(resizeTextarea)
  }

  const handleSaveEdit = () => {
    setOutlineText(editDraft)
    setIsEditing(false)
  }

  const handleConfirm = async () => {
    if (!id || !outlineText) return
    setIsConfirming(true)
    try {
      await confirmOutline(id, outlineText)
      navigate(`/stories/${encodeURIComponent(id)}/write`)
    } catch {
      // 错误处理
    } finally {
      setIsConfirming(false)
    }
  }

  const hasSections = sections.length > 0
  const showOutlineContent = outlineText !== null && !isGenerating

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/stories/${encodeURIComponent(id || '')}/setting`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">确认大纲</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6 pb-28">
        {isLoading && !isGenerating ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isGenerating ? (
          /* 流式预览 */
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI 正在构思故事结构...</span>
            </div>
            <div ref={scrollRef} className="rounded-lg bg-muted/50 p-4 max-h-[70vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-[1.8] text-foreground/80">
                {streamingText || <span className="animate-pulse">等待响应...</span>}
              </pre>
            </div>
          </section>
        ) : showOutlineContent ? (
          /* 大纲内容（刚生成，待确认） */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                大纲已生成，共 {outlineText.split(/(?=### 第\d+章)/).filter(s => s.trim()).length} 个章节
              </p>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-3.5 w-3.5 mr-1" /> 取消
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-3.5 w-3.5 mr-1" /> 保存
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                  <Edit3 className="h-3.5 w-3.5 mr-1" /> 编辑
                </Button>
              )}
            </div>

            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editDraft}
                onChange={e => { setEditDraft(e.target.value); resizeTextarea() }}
                className="w-full rounded-lg bg-muted/30 p-5 font-serif text-sm leading-[1.8] text-foreground whitespace-pre-wrap resize-none overflow-hidden focus:outline-none"
                autoFocus
              />
            ) : (
              <div
                className="rounded-lg bg-muted/30 p-5 cursor-text select-none"
                onDoubleClick={handleStartEdit}
              >
                <div className="whitespace-pre-wrap font-serif text-sm leading-[1.8] text-foreground/90">
                  {outlineText}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleGenerate}>
                <RefreshCw className="h-4 w-4 mr-2" /> 重新生成
              </Button>
              <Button className="flex-1" size="lg" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                确认大纲
              </Button>
            </div>
          </section>
        ) : hasSections ? (
          /* 已确认的大纲（sections 存在） */
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">共 {sections.length} 个章节</p>
            <div className="space-y-3">
              {sections.map((sec, index) => (
                <div
                  key={sec.id}
                  className="flex items-start gap-3 rounded-xl bg-muted/30 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{sec.title}</span>
                      {sec.targetWordCount && (
                        <span className="text-xs text-muted-foreground">{sec.targetWordCount} 字</span>
                      )}
                    </div>
                    {sec.summary && (
                      <p className="text-sm text-muted-foreground font-serif leading-relaxed">{sec.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleGenerate}>
                <RefreshCw className="h-4 w-4 mr-2" /> 重新生成
              </Button>
              <Button className="flex-1" size="lg" onClick={() => navigate(`/stories/${encodeURIComponent(id || '')}/write`)}>
                进入写作
              </Button>
            </div>
          </section>
        ) : (
          /* 初始状态：无大纲 */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-6">AI 将根据故事设定生成分章大纲</p>
            <Button size="lg" onClick={handleGenerate}>
              生成大纲
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
