import { useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, FolderOpen, Settings } from 'lucide-react'

const tabs = [
  { path: '/materials', label: '素材', icon: FolderOpen },
  { path: '/stories', label: '故事', icon: BookOpen },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/90 backdrop-blur-sm shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-around">
        {tabs.map(tab => {
          const isActive = location.pathname.startsWith(tab.path)
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-6 py-1.5 transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
