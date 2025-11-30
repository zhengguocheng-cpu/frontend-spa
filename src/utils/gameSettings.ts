export interface GameSettings {
  quickBotDelayMs: number
  bgmEnabled: boolean
  sfxEnabled: boolean
}

const STORAGE_KEY = 'ddz_game_settings_v1'

const DEFAULT_SETTINGS: GameSettings = {
  quickBotDelayMs: 0,
  bgmEnabled: true,
  sfxEnabled: true,
}

export function getGameSettings(): GameSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed: any = JSON.parse(raw)
    const quickBotDelayMs = typeof parsed.quickBotDelayMs === 'number' && parsed.quickBotDelayMs >= 0
      ? parsed.quickBotDelayMs
      : DEFAULT_SETTINGS.quickBotDelayMs
    const bgmEnabled = typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : DEFAULT_SETTINGS.bgmEnabled
    const sfxEnabled = typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled

    return {
      quickBotDelayMs,
      bgmEnabled,
      sfxEnabled,
    }
  } catch (e) {
    console.warn('[gameSettings] 读取本地配置失败，将使用默认配置:', e)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return

  const safe: GameSettings = {
    quickBotDelayMs:
      typeof settings.quickBotDelayMs === 'number' && settings.quickBotDelayMs >= 0
        ? settings.quickBotDelayMs
        : DEFAULT_SETTINGS.quickBotDelayMs,
    bgmEnabled: !!settings.bgmEnabled,
    sfxEnabled: !!settings.sfxEnabled,
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (e) {
    console.warn('[gameSettings] 写入本地配置失败:', e)
  }
}
