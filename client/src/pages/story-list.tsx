import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStoryStore } from '@/stores/story-store'
import { Plus, BookOpen, Loader2, Trash2 } from 'lucide-react'
import type { StoryStage } from '@/types'
import BottomNav from '@/components/bottom-nav'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const stageLabels: Record<StoryStage, { text: string; color: string }> = {
  setting: { text: '设定中', color: 'text-blue-600 bg-blue-50' },
  outline: { text: '大纲中', color: 'text-amber-600 bg-amber-50' },
  writing: { text: '写作中', color: 'text-emerald-600 bg-emerald-50' },
  completed: { text: '已完成', color: 'text-gray-600 bg-gray-100' },
}

export default function StoryListPage() {
  const { stories, isLoading, fetchStories, deleteStory } = useStoryStore()
  const navigate = useNavigate()
  const [deletingStory, setDeletingStory] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  const getStageRoute = (storyId: string, stage: StoryStage) => {
    const routes: Record<StoryStage, string> = {
      setting: `/stories/${storyId}/setting`,
      outline: `/stories/${storyId}/outline`,
      writing: `/stories/${storyId}`,
      completed: `/stories/${storyId}`,
    }
    return routes[stage]
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-background pb-14">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">我的故事</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/stories/new')}
            aria-label="新建故事"
            title="新建故事"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">还没有故事，开始你的第一个故事吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map(story => (
              <Link key={story.id} to={getStageRoute(story.id, story.stage)} className="block">
                <Card className="transition-shadow hover:shadow-md cursor-pointer shadow-sm">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{story.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {story.stage === 'completed'
                            ? `共 ${story.sectionCount} 节`
                            : story.stage === 'writing'
                              ? `${Math.round(story.currentWordCount / 1000)}k / ${story.targetWordCount ? Math.round(story.targetWordCount / 1000) + 'k' : '?'} 字`
                              : stageLabels[story.stage].text}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageLabels[story.stage].color}`}>
                        {stageLabels[story.stage].text}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(story.updatedAt)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeletingStory({ id: story.id, title: story.title })
                        }}
                        className="ml-1 rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="删除故事"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <BottomNav />

      <AlertDialog open={!!deletingStory} onOpenChange={(open) => { if (!open) setDeletingStory(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除《{deletingStory?.title}》？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingStory(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deletingStory) {
                  await deleteStory(deletingStory.id)
                  setDeletingStory(null)
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
