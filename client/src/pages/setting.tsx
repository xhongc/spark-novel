import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useStoryStore } from '@/stores/story-store'
import { ArrowLeft, Loader2, RefreshCw, User, MapPin, Clock, Palette, Sparkles, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { StorySetting } from '@/types'

export default function SettingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentStory, fetchStory, updateSetting, isLoading } = useStoryStore()
  const [setting, setSetting] = useState<StorySetting | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    characters: true,
    scenes: true,
    meta: true,
  })

  useEffect(() => {
    if (id) fetchStory(id)
  }, [id, fetchStory])

  useEffect(() => {
    if (currentStory?.setting) {
      setSetting(currentStory.setting)
    }
  }, [currentStory])

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    const mockSetting: StorySetting = {
      characters: [
        { name: '林远', role: '主角', description: '35岁，前米其林厨师，因意外失去味觉。沉默寡言，内心细腻。', motivation: '重新找回烹饪的意义' },
        { name: '苏晚', role: '配角', description: '28岁，美食博主，性格开朗，善于发现生活中的美好。', motivation: '寻找真正打动人心的美食故事' },
      ],
      scenes: [
        { name: '「夜半」深夜食堂', description: '小镇老街尽头的小食堂，只在深夜营业。昏黄灯光，木质桌椅。', atmosphere: '温暖、静谧' },
      ],
      era: '现代，南方沿海小镇',
      tone: '温暖治愈，带有淡淡的忧伤',
      themes: ['失去与重获', '味觉与记忆', '孤独与陪伴'],
    }
    setSetting(mockSetting)
    setIsGenerating(false)
  }

  const handleConfirm = async () => {
    if (!id || !setting) return
    await updateSetting(id, setting)
    navigate(`/stories/${id}/outline`)
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (isLoading && !setting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stories')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">确认设定</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-8 pb-28">
        {/* 核心梗概 */}
        <section>
          <SectionLabel icon={<Sparkles className="h-4 w-4" />} label="核心梗概" />
          <p className="text-sm text-muted-foreground font-serif leading-relaxed">{currentStory?.premise}</p>
        </section>

        {!setting ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-6">AI 将根据你的故事梗概生成完整设定</p>
            <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 生成中...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> 生成设定</>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* ========== 主要人物 ========== */}
            <section>
              <button type="button" onClick={() => toggleSection('characters')} className="w-full">
                <SectionLabel
                  icon={<User className="h-4 w-4" />}
                  label="主要人物"
                  suffix={expandedSections.characters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                />
              </button>
              {expandedSections.characters && (
                <div className="space-y-6 mt-3">
                  {setting.characters.map((char, i) => (
                    <div key={i} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Input
                          value={char.name}
                          onChange={e => {
                            const newChars = [...setting.characters]
                            newChars[i] = { ...char, name: e.target.value }
                            setSetting({ ...setting, characters: newChars })
                          }}
                          placeholder="角色名"
                          className="font-medium border-0 bg-muted/50 focus-visible:ring-0 h-9"
                        />
                        <Input
                          value={char.role}
                          onChange={e => {
                            const newChars = [...setting.characters]
                            newChars[i] = { ...char, role: e.target.value }
                            setSetting({ ...setting, characters: newChars })
                          }}
                          placeholder="角色"
                          className="w-20 text-center text-xs border-0 bg-muted/50 focus-visible:ring-0 h-9"
                        />
                        <button
                          type="button"
                          onClick={() => setSetting({ ...setting, characters: setting.characters.filter((_, j) => j !== i) })}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Textarea
                        value={char.description}
                        onChange={e => {
                          const newChars = [...setting.characters]
                          newChars[i] = { ...char, description: e.target.value }
                          setSetting({ ...setting, characters: newChars })
                        }}
                        placeholder="角色描述（性格、背景、外貌）"
                        className="min-h-[72px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                      />
                      <Textarea
                        value={char.motivation || ''}
                        onChange={e => {
                          const newChars = [...setting.characters]
                          newChars[i] = { ...char, motivation: e.target.value }
                          setSetting({ ...setting, characters: newChars })
                        }}
                        placeholder="角色动机（可选）"
                        className="min-h-[56px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSetting({ ...setting, characters: [...setting.characters, { name: '', role: '', description: '', motivation: '' }] })}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    <Plus className="h-4 w-4" /> 添加角色
                  </button>
                </div>
              )}
            </section>

            {/* ========== 主要场景 ========== */}
            <section>
              <button type="button" onClick={() => toggleSection('scenes')} className="w-full">
                <SectionLabel
                  icon={<MapPin className="h-4 w-4" />}
                  label="主要场景"
                  suffix={expandedSections.scenes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                />
              </button>
              {expandedSections.scenes && (
                <div className="space-y-6 mt-3">
                  {setting.scenes.map((scene, i) => (
                    <div key={i} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Input
                          value={scene.name}
                          onChange={e => {
                            const newScenes = [...setting.scenes]
                            newScenes[i] = { ...scene, name: e.target.value }
                            setSetting({ ...setting, scenes: newScenes })
                          }}
                          placeholder="场景名称"
                          className="font-medium border-0 bg-muted/50 focus-visible:ring-0 h-9"
                        />
                        <button
                          type="button"
                          onClick={() => setSetting({ ...setting, scenes: setting.scenes.filter((_, j) => j !== i) })}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Textarea
                        value={scene.description}
                        onChange={e => {
                          const newScenes = [...setting.scenes]
                          newScenes[i] = { ...scene, description: e.target.value }
                          setSetting({ ...setting, scenes: newScenes })
                        }}
                        placeholder="场景描述"
                        className="min-h-[72px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                      />
                      <Input
                        value={scene.atmosphere || ''}
                        onChange={e => {
                          const newScenes = [...setting.scenes]
                          newScenes[i] = { ...scene, atmosphere: e.target.value }
                          setSetting({ ...setting, scenes: newScenes })
                        }}
                        placeholder="氛围（如：温暖、紧张、神秘）"
                        className="text-sm border-0 bg-muted/50 focus-visible:ring-0 h-9"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSetting({ ...setting, scenes: [...setting.scenes, { name: '', description: '', atmosphere: '' }] })}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    <Plus className="h-4 w-4" /> 添加场景
                  </button>
                </div>
              )}
            </section>

            {/* ========== 时代与基调 ========== */}
            <section>
              <button type="button" onClick={() => toggleSection('meta')} className="w-full">
                <SectionLabel
                  icon={<Clock className="h-4 w-4" />}
                  label="时代与基调"
                  suffix={expandedSections.meta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                />
              </button>
              {expandedSections.meta && (
                <div className="space-y-5 mt-3">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> 时代背景
                    </label>
                    <Textarea
                      value={setting.era}
                      onChange={e => setSetting({ ...setting, era: e.target.value })}
                      placeholder="如：现代、近未来2045年、唐朝末年"
                      className="min-h-[56px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Palette className="h-3.5 w-3.5" /> 整体基调
                    </label>
                    <Textarea
                      value={setting.tone}
                      onChange={e => setSetting({ ...setting, tone: e.target.value })}
                      placeholder="如：温暖治愈、紧张悬疑、荒诞讽刺"
                      className="min-h-[56px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">主题标签</label>
                    <div className="flex flex-wrap gap-2">
                      {setting.themes.map((theme, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                          <input
                            value={theme}
                            onChange={e => {
                              const newThemes = [...setting.themes]
                              newThemes[i] = e.target.value
                              setSetting({ ...setting, themes: newThemes })
                            }}
                            className="bg-transparent outline-none w-20 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setSetting({ ...setting, themes: setting.themes.filter((_, j) => j !== i) })}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSetting({ ...setting, themes: [...setting.themes, ''] })}
                        className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" /> 添加
                      </button>
                    </div>
                  </div>
                  {setting.conflictSetup !== undefined ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">核心冲突</label>
                      <Textarea
                        value={setting.conflictSetup}
                        onChange={e => setSetting({ ...setting, conflictSetup: e.target.value })}
                        placeholder="故事的核心矛盾和冲突是什么？"
                        className="min-h-[72px] font-serif text-sm border-0 bg-muted/50 focus-visible:ring-0 resize-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSetting({ ...setting, conflictSetup: '' })}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      + 添加核心冲突设定
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* 底部操作栏 */}
      {setting && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm p-4 z-10">
          <div className="mx-auto max-w-2xl flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              重新生成
            </Button>
            <Button className="flex-1" size="lg" onClick={handleConfirm}>
              确认设定
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ icon, label, suffix }: { icon: React.ReactNode; label: string; suffix?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground/80 uppercase tracking-wide">
        {icon} {label}
      </span>
      {suffix}
    </div>
  )
}
