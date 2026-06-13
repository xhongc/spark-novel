import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import StoryWorkspacePanel from '@/components/story-workspace-panel'
import { useStoryStore } from '@/stores/story-store'
import { Loader2 } from 'lucide-react'

export default function OutlinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, fetchStory, isLoading } = useStoryStore()

  useEffect(() => {
    if (id) void fetchStory(id)
  }, [id, fetchStory])

  if (!id) return null

  if (isLoading && !currentStory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <StoryWorkspacePanel
      story={currentStory}
      storyId={id}
      title="故事大纲"
      rootLabel="大纲"
      initialFolder="大纲"
      currentStage="outline"
      onBack={() => navigate(`/stories/${encodeURIComponent(id)}/setting`)}
    />
  )
}
