export interface User {
  id: string
  email: string
  nickname: string
  avatarUrl?: string
  createdAt: string
}

export type StoryStage = 'setting' | 'outline' | 'writing' | 'completed'
export type SectionStatus = 'locked' | 'review' | 'editing' | 'completed'

export interface Story {
  id: string          // 故事标题（即目录名）
  title: string
  premise: string
  stage: StoryStage
  setting: string | null   // Markdown 格式的故事设定
  outline: string | null   // Markdown 格式的大纲全文
  genre?: string
  targetWordCount?: number
  currentWordCount: number
  sectionCount: number
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string          // 文件名，如 "01-标题.md"
  storyId: string     // 故事标题（目录名）
  title: string
  summary?: string
  content?: string
  wordCount: number
  targetWordCount?: number
  sortOrder: number
  status: SectionStatus
  createdAt?: string
  updatedAt?: string
}

export interface Material {
  id: string
  name: string
  type: 'folder' | 'file'
  content?: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface Skill {
  id: string
  name: string
  type: 'folder' | 'file'
  content?: string
  description?: string
  parentId: string | null
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

export interface ChatReference {
  id: string
  name: string
  content: string
}

export interface ChatContext {
  currentPath?: string
  currentStoryTitle?: string
  currentSectionTitle?: string
  currentSectionContent?: string
  selectedText?: string
  referencedMaterials?: ChatReference[]
  referencedSkills?: ChatReference[]
}
