import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { useStoryStore } from '@/stores/story-store'
import { api } from '@/lib/api-client'
import BottomNav from '@/components/bottom-nav'
import { LogOut, User, BookOpen, FolderOpen, ChevronRight, Moon, Info } from 'lucide-react'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { stories, fetchStories } = useStoryStore()
  const [materialStats, setMaterialStats] = useState({ files: 0, folders: 0 })

  useEffect(() => {
    fetchStories()
    api.get('/materials/stats').then(res => setMaterialStats(res.data.data)).catch(() => {})
  }, [fetchStories])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const totalWords = stories.reduce((sum, s) => sum + s.currentWordCount, 0)
  const completedStories = stories.filter(s => s.stage === 'completed').length

  return (
    <div className="min-h-screen bg-background pb-14">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <h1 className="text-lg font-semibold">设置</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* 账号信息 */}
        <div className="rounded-xl bg-muted/40 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-base">{user?.nickname}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 数据概览 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">数据概览</p>
          <div className="rounded-xl bg-muted/40 divide-y divide-muted/60">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">故事数量</span>
              </div>
              <span className="text-sm font-medium">{stories.length} 篇</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">已完成故事</span>
              </div>
              <span className="text-sm font-medium">{completedStories} 篇</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">总字数</span>
              </div>
              <span className="text-sm font-medium">{totalWords.toLocaleString()} 字</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">素材文件</span>
              </div>
              <span className="text-sm font-medium">{materialStats.files} 个文件 · {materialStats.folders} 个文件夹</span>
            </div>
          </div>
        </div>

        {/* 偏好设置 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">偏好设置</p>
          <div className="rounded-xl bg-muted/40 divide-y divide-muted/60">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">深色模式</span>
              </div>
              <span className="text-sm text-muted-foreground">跟随系统</span>
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">关于</p>
          <div className="rounded-xl bg-muted/40 divide-y divide-muted/60">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">版本</span>
              </div>
              <span className="text-sm text-muted-foreground">v0.1.0</span>
            </div>
          </div>
        </div>

        {/* 退出登录 */}
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> 退出登录
        </Button>
      </main>

      <BottomNav />
    </div>
  )
}
