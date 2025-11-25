export interface LlmSettings {
  enabled: boolean
  model: string
  customPrompt: string
}

const STORAGE_KEY = 'ddz_llm_settings_v1'

const DEFAULT_SETTINGS: LlmSettings = {
  enabled: true,
  model: 'deepseek-chat',
  customPrompt: '',
}

export function getLlmSettings(): LlmSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed: any = JSON.parse(raw)
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled
    const model = typeof parsed.model === 'string' && parsed.model.trim()
      ? parsed.model.trim()
      : DEFAULT_SETTINGS.model
    const customPrompt = typeof parsed.customPrompt === 'string' ? parsed.customPrompt : DEFAULT_SETTINGS.customPrompt

    return {
      enabled,
      model,
      customPrompt,
    }
  } catch (e) {
    console.warn('[llmSettings] 读取本地配置失败，将使用默认配置:', e)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  if (typeof window === 'undefined') return

  const safe: LlmSettings = {
    enabled: !!settings.enabled,
    model: settings.model && settings.model.trim() ? settings.model.trim() : DEFAULT_SETTINGS.model,
    customPrompt: settings.customPrompt || '',
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (e) {
    console.warn('[llmSettings] 写入本地配置失败:', e)
  }
}
