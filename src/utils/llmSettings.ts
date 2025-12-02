export type LlmProvider = 'deepseek' | 'qwen' | 'openai' | 'custom'

export interface LlmSettings {
  enabled: boolean
  provider: LlmProvider
  model: string
  apiKey: string
  customBaseUrl: string
  customModel: string
  customPrompt: string
}

interface LlmProviderConfig {
  name: string
  baseUrl: string
  models: string[]
}

// 预置提供商配置（前端展示用）
export const LLM_PROVIDERS: Record<LlmProvider, LlmProviderConfig> = {
  deepseek: {
    name: 'DeepSeek（默认）',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    models: [],
  },
}

const STORAGE_KEY_V2 = 'ddz_llm_settings_v2'
const STORAGE_KEY_V1 = 'ddz_llm_settings_v1'

const DEFAULT_SETTINGS: LlmSettings = {
  enabled: true,
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: '',
  customBaseUrl: '',
  customModel: '',
  customPrompt: '',
}

export function getLlmSettings(): LlmSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    let raw = window.localStorage.getItem(STORAGE_KEY_V2)
    let fromLegacy = false

    // 兼容旧版本 v1 配置
    if (!raw) {
      raw = window.localStorage.getItem(STORAGE_KEY_V1)
      fromLegacy = !!raw
    }

    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed: any = JSON.parse(raw)

    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled

    const providerRaw = typeof parsed.provider === 'string' ? parsed.provider.trim() : ''
    const provider: LlmProvider = (['deepseek', 'qwen', 'openai', 'custom'] as const).includes(
      providerRaw as LlmProvider,
    )
      ? (providerRaw as LlmProvider)
      : DEFAULT_SETTINGS.provider

    const model = typeof parsed.model === 'string' && parsed.model.trim()
      ? parsed.model.trim()
      : DEFAULT_SETTINGS.model

    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : ''
    const customBaseUrl = typeof parsed.customBaseUrl === 'string' ? parsed.customBaseUrl : ''
    const customModel = typeof parsed.customModel === 'string' ? parsed.customModel : ''

    const customPrompt =
      typeof parsed.customPrompt === 'string' ? parsed.customPrompt : DEFAULT_SETTINGS.customPrompt

    const settings: LlmSettings = {
      enabled,
      provider,
      model,
      apiKey,
      customBaseUrl,
      customModel,
      customPrompt,
    }

    // 如果是从旧版本读取的，顺便写回新版本 key，便于后续统一使用
    if (fromLegacy) {
      saveLlmSettings(settings)
    }

    return settings
  } catch (e) {
    console.warn('[llmSettings] 读取本地配置失败，将使用默认配置:', e)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  if (typeof window === 'undefined') return

  const provider: LlmProvider = (['deepseek', 'qwen', 'openai', 'custom'] as const).includes(
    settings.provider,
  )
    ? settings.provider
    : DEFAULT_SETTINGS.provider

  const safe: LlmSettings = {
    enabled: !!settings.enabled,
    provider,
    model:
      settings.model && settings.model.trim()
        ? settings.model.trim()
        : DEFAULT_SETTINGS.model,
    apiKey: settings.apiKey || '',
    customBaseUrl: settings.customBaseUrl || '',
    customModel: settings.customModel || '',
    customPrompt: settings.customPrompt || '',
  }

  try {
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(safe))
  } catch (e) {
    console.warn('[llmSettings] 写入本地配置失败:', e)
  }
}
