import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import StoryWorkspacePanel from '@/components/story-workspace-panel'
import { useStoryStore } from '@/stores/story-store'
import { useStoryWorkspaceStore } from '@/stores/story-workspace-store'
import { Loader2 } from 'lucide-react'

export default function SettingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, fetchStory, isLoading } = useStoryStore()
  const { generateOutline, fetchItems } = useStoryWorkspaceStore()
  const [isGenerating, setIsGenerating] = useState(false)

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
      title="故事设定"
      rootLabel="设定"
      initialFolder="设定"
      primaryActionLabel={isGenerating ? '生成中' : '生成大纲'}
      onBack={() => navigate('/stories')}
      onPrimaryAction={async () => {
        setIsGenerating(true)
        try {
          await generateOutline(id)
          await fetchStory(id)
          await fetchItems(id, '设定')
          navigate(`/stories/${encodeURIComponent(id)}/outline`)
        } finally {
          setIsGenerating(false)
        }
      }}
    />
  )
}
