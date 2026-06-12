import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSkillsStore } from '@/stores/skills-store'
import BottomNav from '@/components/bottom-nav'
import {
  ArrowLeft, ChevronRight, Zap, Folder, FileText, Loader2,
  MoreVertical, Trash2, Edit3, FolderPlus, FilePlus, X, Check,
} from 'lucide-react'

export default function SkillsPage() {
  const {
    skills, isLoading, currentSkill,
    fetchSkills, createFolder, createFile,
    openSkill, closeSkill, updateContent,
    renameSkill, deleteSkill,
  } = useSkillsStore()

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: '技能库' }])
  const [newItemName, setNewItemName] = useState('')
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [editDraft, setEditDraft] = useState<{ skillId: string; content: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const newItemRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  useEffect(() => {
    if (newItemType && newItemRef.current) newItemRef.current.focus()
  }, [newItemType])

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  const currentItems = skills.filter(m => m.parentId === currentFolderId)
  const folders = currentItems.filter(m => m.type === 'folder')
  const files = currentItems.filter(m => m.type === 'file')

  const enterFolder = (id: string, name: string) => {
    setCurrentFolderId(id)
    setBreadcrumbs(prev => [...prev, { id, name }])
    setContextMenuId(null)
    fetchSkills(id)
  }

  const goToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index]
    setCurrentFolderId(target.id)
    setBreadcrumbs(prev => prev.slice(0, index + 1))
    setContextMenuId(null)
    fetchSkills(target.id || '')
  }

  const handleCreate = () => {
    if (!newItemName.trim() || !newItemType) return
    if (newItemType === 'folder') {
      createFolder(newItemName.trim(), currentFolderId)
    } else {
      createFile(newItemName.trim(), currentFolderId)
    }
    setNewItemName('')
    setNewItemType(null)
  }

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
    setContextMenuId(null)
  }

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameSkill(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleDelete = (id: string) => {
    deleteSkill(id)
    setContextMenuId(null)
  }

  const handleSaveContent = async () => {
    if (currentSkill) {
      await updateContent(currentSkill.id, currentEditContent)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const currentEditContent = currentSkill?.type === 'file'
    ? editDraft?.skillId === currentSkill.id
      ? editDraft.content
      : currentSkill.content || ''
    : ''

  // 文件编辑视图
  if (currentSkill && currentSkill.type === 'file') {
    return (
      <div className="h-screen bg-background flex flex-col pb-14">
        <header className="shrink-0 z-10 bg-background/80 backdrop-blur-sm shadow-sm">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { closeSkill(); setEditDraft(null) }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-base font-medium truncate max-w-[200px]">{currentSkill.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {saved && <span className="text-sm text-emerald-600">已保存</span>}
              <Button size="sm" onClick={handleSaveContent}>
                <Check className="h-3.5 w-3.5 mr-1" /> 保存
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-4 overflow-hidden">
          <Textarea
            value={currentEditContent}
            onChange={e => setEditDraft({ skillId: currentSkill.id, content: e.target.value })}
            className="h-full resize-none font-serif text-base leading-[1.8] border-0 bg-muted/50 focus-visible:ring-0 p-4"
            placeholder="开始写点什么..."
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // 目录视图
  return (
    <div className="min-h-screen bg-background pb-14">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">我的技能</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setNewItemType('folder')
                setNewItemName('')
              }}
              aria-label="新建文件夹"
              title="新建文件夹"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setNewItemType('file')
                setNewItemName('')
              }}
              aria-label="新建文件"
              title="新建文件"
            >
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* 面包屑 */}
        {breadcrumbs.length > 1 && (
          <div className="flex items-center gap-1 mb-4 text-sm overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id ?? 'root'} className="flex items-center gap-1 shrink-0">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <button
                  type="button"
                  onClick={() => goToBreadcrumb(index)}
                  className={`transition-colors ${
                    index === breadcrumbs.length - 1
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentItems.length === 0 && !newItemType ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">这里还没有技能</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* 文件夹 */}
            {folders.map(folder => (
              <div
                key={folder.id}
                className="relative"
              >
                {renamingId === folder.id ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                    <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                    <Input
                      ref={renameRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingId(null) }}
                      onBlur={handleConfirmRename}
                      className="h-7 border-0 bg-transparent focus-visible:ring-0 p-0"
                    />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => enterFolder(folder.id, folder.name)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') enterFolder(folder.id, folder.name) }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      {folder.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{folder.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setContextMenuId(contextMenuId === folder.id ? null : folder.id) }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                {contextMenuId === folder.id && (
                  <div className="absolute right-12 top-full z-20 bg-background shadow-lg rounded-lg py-1 min-w-[120px]">
                    <button type="button" onClick={() => handleStartRename(folder.id, folder.name)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Edit3 className="h-3.5 w-3.5" /> 重命名
                    </button>
                    <button type="button" onClick={() => handleDelete(folder.id)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 文件 */}
            {files.map(file => (
              <div
                key={file.id}
                className="relative"
              >
                {renamingId === file.id ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <Input
                      ref={renameRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingId(null) }}
                      onBlur={handleConfirmRename}
                      className="h-7 border-0 bg-transparent focus-visible:ring-0 p-0"
                    />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={async () => await openSkill(file.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openSkill(file.id) }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {file.content && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{file.content.slice(0, 60)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setContextMenuId(contextMenuId === file.id ? null : file.id) }}
                      className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
                {contextMenuId === file.id && (
                  <div className="absolute right-10 top-full z-20 bg-background shadow-lg rounded-lg py-1 min-w-[120px]">
                    <button type="button" onClick={() => handleStartRename(file.id, file.name)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Edit3 className="h-3.5 w-3.5" /> 重命名
                    </button>
                    <button type="button" onClick={() => handleDelete(file.id)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 新建输入框 */}
            {newItemType && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                {newItemType === 'folder' ? (
                  <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <Input
                  ref={newItemRef}
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setNewItemType(null); setNewItemName('') } }}
                  placeholder={newItemType === 'folder' ? '文件夹名称' : '文件名称'}
                  className="h-7 border-0 bg-transparent focus-visible:ring-0 p-0"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCreate} disabled={!newItemName.trim()}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setNewItemType(null); setNewItemName('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
