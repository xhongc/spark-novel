import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, ChevronDown, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api-client'

type ModelInputType = 'text' | 'image'

interface AgentConfigResponse {
  models: {
    providers: Record<string, {
      baseUrl?: string
      api?: string
      apiKey?: string
      models: Array<{
        id: string
        name: string
        contextWindow?: number
        maxTokens?: number
        input: ModelInputType[]
        reasoning?: boolean
        cost?: {
          input: number
          output: number
          cacheRead: number
          cacheWrite: number
        }
        compat?: Record<string, unknown>
      }>
      [key: string]: unknown
    }>
  }
  settings: {
    lastChangelogVersion?: string
    defaultProvider: string
    defaultModel: string
    defaultThinkingLevel?: string
    [key: string]: unknown
  }
}

interface ModelForm {
  id: string
  name: string
  contextWindow: string
  maxTokens: string
  reasoning: boolean
}

interface ProviderForm {
  key: string
  baseUrl: string
  apiKey: string
  models: ModelForm[]
}

function createEmptyModel(): ModelForm {
  return {
    id: '',
    name: '',
    contextWindow: '',
    maxTokens: '',
    reasoning: false,
  }
}

function createEmptyProvider(): ProviderForm {
  return {
    key: '',
    baseUrl: '',
    apiKey: '',
    models: [createEmptyModel()],
  }
}

function parseNumberString(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function ModelSettingsPage() {
  const navigate = useNavigate()
  const [rawConfig, setRawConfig] = useState<AgentConfigResponse | null>(null)
  const [providers, setProviders] = useState<ProviderForm[]>([])
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [defaultProvider, setDefaultProvider] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [defaultThinkingLevel, setDefaultThinkingLevel] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.get<{ data: AgentConfigResponse }>('/agent/config')
        const data = res.data.data
        setRawConfig(data)
        setProviders(
          Object.entries(data.models.providers).map(([key, provider]) => ({
            key,
            baseUrl: provider.baseUrl ?? '',
            apiKey: provider.apiKey ?? '',
            models: provider.models.length > 0
              ? provider.models.map(model => ({
                  id: model.id,
                  name: model.name,
                  contextWindow: model.contextWindow?.toString() ?? '',
                  maxTokens: model.maxTokens?.toString() ?? '',
                  reasoning: Boolean(model.reasoning),
                }))
              : [createEmptyModel()],
          }))
        )
        setDefaultProvider(data.settings.defaultProvider ?? '')
        setDefaultModel(data.settings.defaultModel ?? '')
        setDefaultThinkingLevel(data.settings.defaultThinkingLevel ?? '')
      } catch {
        setMessage('模型配置读取失败')
        setProviders([createEmptyProvider()])
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  const providerOptions = useMemo(
    () => providers.map(provider => provider.key.trim()).filter(Boolean),
    [providers]
  )

  const modelOptions = useMemo(() => {
    const provider = providers.find(item => item.key.trim() === defaultProvider.trim())
    if (!provider) return []
    return provider.models.map(model => model.id.trim()).filter(Boolean)
  }, [providers, defaultProvider])

  const updateProvider = (providerIndex: number, field: keyof Omit<ProviderForm, 'models'>, value: string) => {
    setProviders(current => current.map((provider, index) => (
      index === providerIndex ? { ...provider, [field]: value } : provider
    )))
  }

  const updateModel = (
    providerIndex: number,
    modelIndex: number,
    field: keyof ModelForm,
    value: string | boolean,
  ) => {
    setProviders(current => current.map((provider, pIndex) => {
      if (pIndex !== providerIndex) return provider
      return {
        ...provider,
        models: provider.models.map((model, mIndex) => (
          mIndex === modelIndex ? { ...model, [field]: value } : model
        )),
      }
    }))
  }

  const addProvider = () => {
    setProviders(current => [...current, createEmptyProvider()])
  }

  const removeProvider = (providerIndex: number) => {
    setProviders(current => current.length === 1 ? current : current.filter((_, index) => index !== providerIndex))
  }

  const addModel = (providerIndex: number) => {
    setProviders(current => current.map((provider, index) => (
      index === providerIndex
        ? { ...provider, models: [...provider.models, createEmptyModel()] }
        : provider
    )))
  }

  const removeModel = (providerIndex: number, modelIndex: number) => {
    setProviders(current => current.map((provider, index) => {
      if (index !== providerIndex) return provider
      return {
        ...provider,
        models: provider.models.length === 1
          ? provider.models
          : provider.models.filter((_, currentModelIndex) => currentModelIndex !== modelIndex),
      }
    }))
  }

  const buildPayload = () => {
    const baseModels = rawConfig?.models.providers ?? {}
    const nextProviders = Object.fromEntries(
      providers
        .map(provider => {
          const key = provider.key.trim()
          if (!key) return null

          const existingProvider = baseModels[key]
          const existingModels = new Map((existingProvider?.models ?? []).map(model => [model.id, model]))
          const models = provider.models
            .map(model => {
              const id = model.id.trim()
              const name = model.name.trim()
              if (!id || !name) return null

              const existingModel = existingModels.get(id)
              return {
                ...existingModel,
                id,
                name,
                ...(parseNumberString(model.contextWindow) !== undefined
                  ? { contextWindow: parseNumberString(model.contextWindow) }
                  : {}),
                ...(parseNumberString(model.maxTokens) !== undefined
                  ? { maxTokens: parseNumberString(model.maxTokens) }
                  : {}),
                reasoning: model.reasoning,
                input: existingModel?.input ?? ['text'],
              }
            })
            .filter(Boolean)

          if (models.length === 0) return null

          return [key, {
            ...existingProvider,
            ...(provider.baseUrl.trim() ? { baseUrl: provider.baseUrl.trim() } : {}),
            ...(provider.apiKey.trim() ? { apiKey: provider.apiKey.trim() } : {}),
            models,
          }]
        })
        .filter(Boolean) as Array<[string, unknown]>
    )

    return {
      models: {
        providers: nextProviders,
      },
      settings: {
        ...(rawConfig?.settings ?? {}),
        defaultProvider: defaultProvider.trim(),
        defaultModel: defaultModel.trim(),
        ...(defaultThinkingLevel.trim() ? { defaultThinkingLevel: defaultThinkingLevel.trim() } : {}),
      },
    }
  }

  const handleSave = async () => {
    setMessage(null)

    const payload = buildPayload()
    if (!payload.settings.defaultProvider || !payload.settings.defaultModel) {
      setMessage('默认 provider 和默认 model 不能为空')
      return
    }

    setIsSaving(true)
    try {
      await api.put('/agent/config', payload)
      setMessage('模型配置已保存')
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? '模型配置保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const getModelKey = (providerIndex: number, modelIndex: number) => `${providerIndex}-${modelIndex}`

  const applyModelAsDefault = (providerIndex: number, modelIndex: number) => {
    const provider = providers[providerIndex]
    const model = provider?.models[modelIndex]
    if (!provider || !model) return

    setDefaultProvider(provider.key)
    setDefaultModel(model.id)
  }

  const toggleModelExpanded = (providerIndex: number, modelIndex: number) => {
    const key = getModelKey(providerIndex, modelIndex)
    setExpandedModels(current => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">模型配置</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6 pb-8">
        <div className="rounded-xl bg-muted/40 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">默认模型</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-provider">默认供应商</Label>
              <Input
                id="default-provider"
                list="provider-options"
                value={defaultProvider}
                onChange={e => setDefaultProvider(e.target.value)}
                placeholder="例如 xiaomi-coding"
              />
              <datalist id="provider-options">
                {providerOptions.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-model">默认模型</Label>
              <Input
                id="default-model"
                list="model-options"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                placeholder="例如 mimo-v2.5-pro"
              />
              <datalist id="model-options">
                {modelOptions.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">供应商与模型</p>
            <Button type="button" variant="outline" size="sm" onClick={addProvider}>
              <Plus className="mr-2 h-4 w-4" />
              新增供应商
            </Button>
          </div>

          {isLoading ? (
            <div className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
              正在读取模型配置...
            </div>
          ) : (
            <div className="space-y-4">
              {providers.map((provider, providerIndex) => (
                <div key={`provider-${providerIndex}`} className="rounded-xl bg-muted/40 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Provider {providerIndex + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProvider(providerIndex)}
                      disabled={providers.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provider Key</Label>
                      <Input
                        value={provider.key}
                        onChange={e => updateProvider(providerIndex, 'key', e.target.value)}
                        placeholder="例如 deepseek"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={provider.baseUrl}
                        onChange={e => updateProvider(providerIndex, 'baseUrl', e.target.value)}
                        placeholder="https://api.example.com"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>API Key</Label>
                      <Input
                        value={provider.apiKey}
                        onChange={e => updateProvider(providerIndex, 'apiKey', e.target.value)}
                        placeholder="sk-xxxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">模型列表</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => addModel(providerIndex)}>
                        <Plus className="mr-2 h-4 w-4" />
                        新增 Model
                      </Button>
                    </div>

                    {provider.models.map((model, modelIndex) => (
                      <div key={`model-${providerIndex}-${modelIndex}`} className="rounded-lg border border-border/60 bg-background/70">
                        <div className="flex items-center gap-3 p-4">
                          <button
                            type="button"
                            onClick={() => toggleModelExpanded(providerIndex, modelIndex)}
                            className="flex flex-1 items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {model.name.trim() || `Model ${modelIndex + 1}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {model.id.trim() || '未填写模型 ID'}
                              </p>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                expandedModels[getModelKey(providerIndex, modelIndex)] ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applyModelAsDefault(providerIndex, modelIndex)}
                          >
                            应用
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeModel(providerIndex, modelIndex)}
                            disabled={provider.models.length === 1}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            
                          </Button>
                        </div>

                        {expandedModels[getModelKey(providerIndex, modelIndex)] && (
                          <div className="space-y-4 border-t border-border/60 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Model ID</Label>
                                <Input
                                  value={model.id}
                                  onChange={e => updateModel(providerIndex, modelIndex, 'id', e.target.value)}
                                  placeholder="例如 deepseek-v4-pro"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>显示名称</Label>
                                <Input
                                  value={model.name}
                                  onChange={e => updateModel(providerIndex, modelIndex, 'name', e.target.value)}
                                  placeholder="例如 DeepSeek V4 Pro"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>上下文长度</Label>
                                <Input
                                  value={model.contextWindow}
                                  onChange={e => updateModel(providerIndex, modelIndex, 'contextWindow', e.target.value)}
                                  placeholder="例如 1000000"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>最大输出 Tokens</Label>
                                <Input
                                  value={model.maxTokens}
                                  onChange={e => updateModel(providerIndex, modelIndex, 'maxTokens', e.target.value)}
                                  placeholder="例如 32000"
                                />
                              </div>
                              <label className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm md:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={model.reasoning}
                                  onChange={e => updateModel(providerIndex, modelIndex, 'reasoning', e.target.checked)}
                                />
                                开启 reasoning
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
          <div className="min-h-5 text-sm text-muted-foreground">{message}</div>
          <Button type="button" onClick={handleSave} disabled={isLoading || isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </main>
    </div>
  )
}
