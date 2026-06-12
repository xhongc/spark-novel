import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/login'
import StoryListPage from '@/pages/story-list'
import CreateStoryPage from '@/pages/create-story'
import SettingPage from '@/pages/setting'
import OutlinePage from '@/pages/outline'
import WritingPage from '@/pages/writing'
import { useAuthStore } from '@/stores/auth-store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/stories" element={<ProtectedRoute><StoryListPage /></ProtectedRoute>} />
        <Route path="/stories/new" element={<ProtectedRoute><CreateStoryPage /></ProtectedRoute>} />
        <Route path="/stories/:id/setting" element={<ProtectedRoute><SettingPage /></ProtectedRoute>} />
        <Route path="/stories/:id/outline" element={<ProtectedRoute><OutlinePage /></ProtectedRoute>} />
        <Route path="/stories/:id" element={<ProtectedRoute><WritingPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/stories" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
