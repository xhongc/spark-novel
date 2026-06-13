import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface StoryStageNavProps {
  storyId: string
  current: 'setting' | 'outline' | 'writing'
}

const items: Array<{ key: StoryStageNavProps['current']; label: string; getHref: (storyId: string) => string }> = [
  { key: 'setting', label: '设定', getHref: storyId => `/stories/${encodeURIComponent(storyId)}/setting` },
  { key: 'outline', label: '大纲', getHref: storyId => `/stories/${encodeURIComponent(storyId)}/outline` },
  { key: 'writing', label: '正文', getHref: storyId => `/stories/${encodeURIComponent(storyId)}` },
]

export default function StoryStageNav({ storyId, current }: StoryStageNavProps) {
  return (
    <div className="border-b border-border/60 bg-background/95">
      <div className="mx-auto flex max-w-2xl items-center gap-1 px-4">
        {items.map(item => (
          <Link
            key={item.key}
            to={item.getHref(storyId)}
            className={cn(
              'inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors',
              current === item.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
