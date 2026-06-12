import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useStoryStore } from '@/stores/story-store'
import { ArrowLeft, Sparkles } from 'lucide-react'

const placeholders = [
  '一个失去味觉的厨师在小镇开了一家深夜食堂...',
  '一枚能看见他人记忆的戒指，辗转到了一个失忆女孩手中...',
  '在一座永不下雪的城市里，有人开始寄出雪花形状的信件...',
]

const randomInspirations = [
  '一个退休的宇航员在小镇图书馆里发现了一本来自未来的日记。',
  '一座只有在梦中才能到达的书店，每个读者只能带走一本书。',
  '一个能听懂植物说话的园丁，发现公园里的老槐树想要搬家。',
]

export default function CreateStoryPage() {
  const [premise, setPremise] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { createStory } = useStoryStore()
  const navigate = useNavigate()

  const placeholder = placeholders[Math.floor(Math.random() * placeholders.length)]

  const handleCreate = async () => {
    if (!premise.trim() || isCreating) return
    setIsCreating(true)
    try {
      const story = await createStory(premise.trim())
      navigate(`/stories/${story.id}/setting`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRandom = () => {
    const inspiration = randomInspirations[Math.floor(Math.random() * randomInspirations.length)]
    setPremise(inspiration)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stories')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">创建新故事</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">开始一个新故事</h2>
            <p className="text-muted-foreground">用几句话描述你的故事想法</p>
          </div>

          <div className="space-y-4">
            <Textarea
              value={premise}
              onChange={e => setPremise(e.target.value)}
              placeholder={placeholder}
              className="min-h-[160px] resize-none text-base leading-relaxed font-serif"
            />

            <button
              type="button"
              onClick={handleRandom}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              没有灵感？随机一个
            </button>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={!premise.trim() || isCreating}
            onClick={handleCreate}
          >
            {isCreating ? '正在创建...' : '开始创作'}
          </Button>
        </div>
      </main>
    </div>
  )
}
