import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useStoryStore } from '@/stores/story-store'
import { ArrowLeft, Loader2, RefreshCw, GripVertical, Plus, Trash2, Edit3 } from 'lucide-react'
import type { OutlineItem } from '@/types'

const mockOutline: OutlineItem[] = [
  { title: '雨夜来客', summary: '雨夜，第一位客人推开了「夜半」的门。林远端出一碗热气腾腾的阳春面，唤起了客人尘封多年的记忆。', targetWordCount: 1500 },
  { title: '隐藏的味觉', summary: '苏晚第一次来到「夜半」，她敏锐地察觉到林远的异样。一道糖醋排骨引发了两人之间的对话。', targetWordCount: 1800 },
  { title: '厨房里的秘密', summary: '苏晚开始频繁光顾「夜半」，她逐渐发现了林远失去味觉的秘密。老周道出了林远的过去。', targetWordCount: 1600 },
  { title: '意外的坦白', summary: '苏晚提出帮助林远重新训练味觉，两人开始了艰难的尝试。', targetWordCount: 1500 },
  { title: '深夜的对峙', summary: '林远面对来自老东家的邀请，陷入两难。苏晚的鼓励让他开始正视自己的内心。', targetWordCount: 1500 },
  { title: '真相大白', summary: '味觉恢复的契机出现在一个意想不到的时刻，林远终于理解了味觉的真正含义。', targetWordCount: 1500 },
  { title: '最后一餐', summary: '林远为苏晚做了一顿特别的晚餐，两人之间的关系迎来了转折。', targetWordCount: 1500 },
  { title: '味觉的回归', summary: '故事尾声，林远重新找到了烹饪的意义，「夜半」迎来了新的开始。', targetWordCount: 1500 },
]

export default function OutlinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, fetchStory, isLoading } = useStoryStore()
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    setOutline(mockOutline)
    setIsGenerating(false)
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const newOutline = [...outline]
    const [moved] = newOutline.splice(dragIndex, 1)
    newOutline.splice(index, 0, moved)
    setOutline(newOutline)
    setDragIndex(index)
  }

  const handleDelete = (index: number) => {
    setOutline(outline.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    setOutline([...outline, { title: '新小节', summary: '', targetWordCount: 1500 }])
  }

  const handleConfirm = () => {
    if (!id) return
    // In real app, this would save to backend and create sections
    navigate(`/stories/${id}`)
  }

  const totalWordCount = outline.reduce((sum, item) => sum + item.targetWordCount, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/stories')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">确认大纲</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {!outline.length && !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-6">AI 将根据故事设定生成分章大纲</p>
            <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 生成中...</>
              ) : (
                <>生成大纲</>
              )}
            </Button>
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">AI 正在构思故事结构...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">共 {outline.length} 个小节，约 {totalWordCount.toLocaleString()} 字</p>
            </div>

            <div className="space-y-3">
              {outline.map((item, index) => (
                <Card
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={() => setDragIndex(null)}
                  className={`transition-shadow ${dragIndex === index ? 'opacity-50 shadow-lg' : ''}`}
                >
                  <CardContent className="p-4">
                    {editingIndex === index ? (
                      <div className="space-y-3">
                        <Input
                          value={item.title}
                          onChange={e => {
                            const newOutline = [...outline]
                            newOutline[index] = { ...item, title: e.target.value }
                            setOutline(newOutline)
                          }}
                          placeholder="小节标题"
                        />
                        <Textarea
                          value={item.summary}
                          onChange={e => {
                            const newOutline = [...outline]
                            newOutline[index] = { ...item, summary: e.target.value }
                            setOutline(newOutline)
                          }}
                          placeholder="小节摘要"
                          className="min-h-[80px] font-serif"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">预估字数：</span>
                          <Input
                            type="number"
                            value={item.targetWordCount}
                            onChange={e => {
                              const newOutline = [...outline]
                              newOutline[index] = { ...item, targetWordCount: Number(e.target.value) }
                              setOutline(newOutline)
                            }}
                            className="w-24"
                          />
                        </div>
                        <Button size="sm" onClick={() => setEditingIndex(null)}>完成</Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0 cursor-grab">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{index + 1}. {item.title}</span>
                            <span className="text-xs text-muted-foreground">{item.targetWordCount} 字</span>
                          </div>
                          <p className="text-sm text-muted-foreground font-serif leading-relaxed">{item.summary}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingIndex(index)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> 添加小节
            </button>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                重新生成
              </Button>
              <Button className="flex-1" size="lg" onClick={handleConfirm}>
                确认大纲
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
