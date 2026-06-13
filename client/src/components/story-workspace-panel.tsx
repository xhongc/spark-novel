import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useStoryWorkspaceStore } from '@/stores/story-workspace-store'
import type { Story, StoryWorkspaceItem } from '@/types'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  MoreVertical,
  Trash2,
  Edit3,
} from 'lucide-react'

interface StoryWorkspacePanelProps {
  story: Story | null
  storyId: string
  title: string
  rootLabel: string
  initialFolder: string
  primaryActionLabel?: string
  onBack: () => void
  onPrimaryAction?: () => Promise<void> | void
}

export default function StoryWorkspacePanel({
  story,
  storyId,
  title,
  rootLabel,
  initialFolder,
  primaryActionLabel,
  onBack,
  onPrimaryAction,
}: StoryWorkspacePanelProps) {
  const {
    items,
    currentFile,
    isLoading,
    fetchItems,
    createFolder,
    createFile,
    openFile,
    closeFile,
    updateFileContent,
    renameItem,
    deleteItem,
  } = useStoryWorkspaceStore()

  const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolder)
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: initialFolder, name: rootLabel },
  ])
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draftState, setDraftState] = useState<{ fileId: string; content: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [isActionRunning, setIsActionRunning] = useState(false)
  const newItemRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrentFolderId(initialFolder)
    setBreadcrumbs([{ id: initialFolder, name: rootLabel }])
    closeFile()
    void fetchItems(storyId, initialFolder)
  }, [storyId, initialFolder, rootLabel, fetchItems, closeFile])

  useEffect(() => {
    if (newItemType && newItemRef.current) newItemRef.current.focus()
  }, [newItemType])

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  const currentItems = useMemo(
    () => items.filter(item => item.parentId === currentFolderId),
    [items, currentFolderId],
  )

  const currentEditContent = currentFile?.type === 'file'
    ? draftState?.fileId === currentFile.id
      ? draftState.content
      : currentFile.content || ''
    : ''

  const enterFolder = (id: string, name: string) => {
    setCurrentFolderId(id)
    setBreadcrumbs(prev => [...prev, { id, name }])
    setContextMenuId(null)
    void fetchItems(storyId, id)
  }

  const goToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index]
    setCurrentFolderId(target.id)
    setBreadcrumbs(prev => prev.slice(0, index + 1))
    setContextMenuId(null)
    void fetchItems(storyId, target.id)
  }

  const handleCreate = () => {
    if (!newItemType || !newItemName.trim()) return
    if (newItemType === 'folder') {
      void createFolder(storyId, newItemName.trim(), currentFolderId)
    } else {
      void createFile(storyId, newItemName.trim(), currentFolderId)
    }
    setNewItemName('')
    setNewItemType(null)
  }

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      void renameItem(storyId, renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleSaveFile = async () => {
    if (!currentFile) return
    await updateFileContent(storyId, currentFile.id, currentEditContent)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const handlePrimaryAction = async () => {
    if (!onPrimaryAction) return
    setIsActionRunning(true)
    try {
      await onPrimaryAction()
      await fetchItems(storyId, currentFolderId)
    } finally {
      setIsActionRunning(false)
    }
  }

  if (currentFile?.type === 'file') {
    return (
      <div className="h-screen bg-background flex flex-col">
        <header className="shrink-0 z-10 bg-background/80 backdrop-blur-sm shadow-sm">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { closeFile(); setDraftState(null) }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base font-medium truncate">{currentFile.name}</h1>
                <p className="text-xs text-muted-foreground truncate">{story?.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saved && <span className="text-sm text-emerald-600">已保存</span>}
              <Button size="sm" onClick={handleSaveFile}>
                <Check className="h-3.5 w-3.5 mr-1" /> 保存
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-4 overflow-hidden">
          <Textarea
            value={currentEditContent}
            onChange={e => setDraftState({ fileId: currentFile.id, content: e.target.value })}
            className="h-full resize-none font-serif text-base leading-[1.8] border-0 bg-muted/50 focus-visible:ring-0 p-4"
            placeholder="开始写点什么..."
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              <p className="text-xs text-muted-foreground truncate">{story?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {primaryActionLabel && onPrimaryAction && (
              <Button size="sm" onClick={() => void handlePrimaryAction()} disabled={isActionRunning}>
                {isActionRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {primaryActionLabel}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setNewItemType('folder')
                setNewItemName('')
              }}
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
            >
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 mb-4 text-sm overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <button
                  type="button"
                  onClick={() => goToBreadcrumb(index)}
                  className={index === breadcrumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {newItemType && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            {newItemType === 'folder' ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
            <Input
              ref={newItemRef}
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setNewItemType(null)
              }}
              onBlur={handleCreate}
              className="h-8 border-0 bg-transparent focus-visible:ring-0 px-0"
              placeholder={newItemType === 'folder' ? '新建文件夹' : '新建文件'}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Folder className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">这里还没有文件</p>
          </div>
        ) : (
          <div className="space-y-1">
            {currentItems.map(item => (
              <div key={item.id} className="relative">
                {renamingId === item.id ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                    {item.type === 'folder' ? (
                      <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <Input
                      ref={renameRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onBlur={handleConfirmRename}
                      className="h-7 border-0 bg-transparent focus-visible:ring-0 p-0"
                    />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (item.type === 'folder') {
                        enterFolder(item.id, item.name)
                      } else {
                        void openFile(storyId, item.id)
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (item.type === 'folder') {
                          enterFolder(item.id, item.name)
                        } else {
                          void openFile(storyId, item.id)
                        }
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    {item.type === 'folder' ? (
                      <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 text-left text-sm font-medium truncate">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setContextMenuId(contextMenuId === item.id ? null : item.id)
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {item.type === 'folder' ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
                    </div>
                  </div>
                )}

                {contextMenuId === item.id && (
                  <div className="absolute right-12 top-full z-20 bg-background shadow-lg rounded-lg py-1 min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(item.id)
                        setRenameValue(item.name)
                        setContextMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> 重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteItem(storyId, item.id)
                        setContextMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
