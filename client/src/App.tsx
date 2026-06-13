import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AIWritingAssistant from '@/components/ai-writing-assistant'
import LoginPage from '@/pages/login'
import StoryListPage from '@/pages/story-list'
import CreateStoryPage from '@/pages/create-story'
import SettingPage from '@/pages/setting'
import OutlinePage from '@/pages/outline'
import WritingPage from '@/pages/writing'
import MaterialsPage from '@/pages/materials'
import SkillsPage from '@/pages/skills'
import SettingsPage from '@/pages/settings'
import ModelSettingsPage from '@/pages/model-settings'
import { useAuthStore } from '@/stores/auth-store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <>
      {children}
      <AIWritingAssistant />
    </>
  )
}

export default function App() {
  const { isAuthenticated, initAuth } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      initAuth()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/stories" element={<ProtectedRoute><StoryListPage /></ProtectedRoute>} />
        <Route path="/stories/new" element={<ProtectedRoute><CreateStoryPage /></ProtectedRoute>} />
        <Route path="/stories/:id/setting" element={<ProtectedRoute><SettingPage /></ProtectedRoute>} />
        <Route path="/stories/:id/outline" element={<ProtectedRoute><OutlinePage /></ProtectedRoute>} />
        <Route path="/stories/:id" element={<ProtectedRoute><WritingPage /></ProtectedRoute>} />
        <Route path="/materials" element={<ProtectedRoute><MaterialsPage /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><SkillsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/settings/models" element={<ProtectedRoute><ModelSettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/materials" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
