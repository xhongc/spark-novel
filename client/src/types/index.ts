export interface User {
  id: string
  email: string
  nickname: string
  avatarUrl?: string
  createdAt: string
}

export type StoryStage = 'setting' | 'outline' | 'writing' | 'completed'
export type SectionStatus = 'locked' | 'review' | 'editing' | 'completed'

export interface StorySetting {
  characters: Array<{
    name: string
    role: string
    description: string
    motivation?: string
  }>
  scenes: Array<{
    name: string
    description: string
    atmosphere?: string
  }>
  era: string
  tone: string
  themes: string[]
  conflictSetup?: string
}

export interface Story {
  id: string
  userId: string
  title: string
  premise: string
  stage: StoryStage
  setting: StorySetting | null
  genre?: string
  targetWordCount?: number
  currentWordCount: number
  sectionCount: number
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  storyId: string
  title: string
  summary?: string
  content?: string
  wordCount: number
  targetWordCount?: number
  sortOrder: number
  status: SectionStatus
  aiModel?: string
  createdAt: string
  updatedAt: string
}

export interface OutlineItem {
  title: string
  summary: string
  targetWordCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  type?: 'text' | 'diff'
  diffData?: {
    original: string
    modified: string
  }
}
