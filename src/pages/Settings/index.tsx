import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  getLlmSettings,
  saveLlmSettings,
  type LlmSettings,
  LLM_PROVIDERS,
  type LlmProvider,
} from '@/utils/llmSettings'
import { getGameSettings, saveGameSettings, type GameSettings } from '@/utils/gameSettings'
import { soundManager } from '@/utils/sound'
import SidebarUserCard from '@/components/SidebarUserCard'
import '@/styles/avatars.css'
import '../Profile/style.css'
import '../LobbyHome/style.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() => getLlmSettings())
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => getGameSettings())
  const [settingsTab, setSettingsTab] = useState<'ai' | 'game' | 'audio'>('ai')

  const currentProviderConfig =
    LLM_PROVIDERS[llmSettings.provider] || LLM_PROVIDERS.deepseek

  // 根据当前配置同步全局音频状态
  useEffect(() => {
    soundManager.setSoundEnabled(gameSettings.sfxEnabled)
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    } else {
      soundManager.stopBackgroundMusic()
    }

    return () => {
      soundManager.stopBackgroundMusic()
    }
  }, [gameSettings.bgmEnabled, gameSettings.sfxEnabled])

  const handleToggleLlmEnabled = (e: any) => {
    const enabled = !!e.target?.checked
    setLlmSettings((prev) => ({ ...prev, enabled }))
  }

  const handleChangeProvider = (e: any) => {
    const value = String(e.target?.value || '').trim() as LlmProvider
    setLlmSettings((prev) => {
      const provider: LlmProvider = (['deepseek', 'qwen', 'openai', 'custom'] as const).includes(
        value as LlmProvider,
      )
        ? value
        : 'deepseek'
      const config = LLM_PROVIDERS[provider]
      const defaultModel = (config?.models && config.models[0]) || prev.model || 'deepseek-chat'
      return {
        ...prev,
        provider,
        model: provider === 'custom' ? defaultModel : defaultModel,
      }
    })
  }

  const handleChangeModel = (e: any) => {
    const model = String(e.target?.value || '').trim()
    setLlmSettings((prev) => ({ ...prev, model }))
  }

  const handleChangeCustomBaseUrl = (e: any) => {
    const customBaseUrl = String(e.target?.value || '')
    setLlmSettings((prev) => ({ ...prev, customBaseUrl }))
  }

  const handleChangeCustomModel = (e: any) => {
    const customModel = String(e.target?.value || '').trim()
    setLlmSettings((prev) => ({ ...prev, customModel }))
  }

  const handleChangeApiKey = (e: any) => {
    const apiKey = String(e.target?.value || '')
    setLlmSettings((prev) => ({ ...prev, apiKey }))
  }

  const handleChangeCustomPrompt = (e: any) => {
    const customPrompt = e.target?.value || ''
    setLlmSettings((prev) => ({ ...prev, customPrompt }))
  }

  const handleChangeQuickBotDelay = (e: any) => {
    const value = typeof e.target?.value === 'string' ? Number(e.target.value) : 0
    const ms = Number.isFinite(value) && value >= 0 ? value : 0
    setGameSettings((prev) => ({ ...prev, quickBotDelayMs: ms }))
  }

  const handleToggleBgm = (e: any) => {
    const enabled = !!e.target?.checked
    setGameSettings((prev) => ({ ...prev, bgmEnabled: enabled }))
  }

  const handleToggleSfx = (e: any) => {
    const enabled = !!e.target?.checked
    setGameSettings((prev) => ({ ...prev, sfxEnabled: enabled }))
  }

  const handleCancel = () => {
    navigate(-1)
  }

  const handleSave = () => {
    saveLlmSettings(llmSettings)
    saveGameSettings(gameSettings)
    Toast.show({ content: '设置已保存', icon: 'success' })
    navigate(-1)
  }

  return (
    <div className="profile-page">
      <div className="lobby-settings-layout-container">
        {/* 左侧：用户信息卡片 + 导航菜单 */}
        <div className="lobby-settings-sidebar">
          <SidebarUserCard />
          <div className="lobby-settings-nav-menu">
            <button
              type="button"
              className={
                'lobby-settings-nav-item' + (settingsTab === 'ai' ? ' active' : '')
              }
              onClick={() => setSettingsTab('ai')}
            >
              <span className="nav-icon">🤖</span>
              AI 提示
            </button>
            <button
              type="button"
              className={
                'lobby-settings-nav-item' + (settingsTab === 'game' ? ' active' : '')
              }
              onClick={() => setSettingsTab('game')}
            >
              <span className="nav-icon">🎮</span>
              游戏设置
            </button>
            <button
              type="button"
              className={
                'lobby-settings-nav-item' + (settingsTab === 'audio' ? ' active' : '')
              }
              onClick={() => setSettingsTab('audio')}
            >
              <span className="nav-icon">🔊</span>
              音频设置
            </button>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="lobby-settings-content-panel">
          {settingsTab === 'ai' && (
            <>
              <div className="panel-section-title">AI 出牌提示</div>
              <div className="lobby-settings-card">
                <div className="lobby-settings-field-row lobby-settings-header-row">
                  <div className="lobby-settings-title-main">开启 AI 辅助</div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={llmSettings.enabled}
                      onChange={handleToggleLlmEnabled}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="lobby-settings-desc">
                  开启后优先使用大模型，网络不佳或超时会启用本地提示系统。
                </div>
              </div>

              <div className="lobby-settings-card">
                <div className="lobby-settings-field-header">
                  <span className="settings-label">大模型</span>
                  <select
                    className="lobby-settings-select"
                    value={llmSettings.provider}
                    onChange={handleChangeProvider}
                    disabled={!llmSettings.enabled}
                  >
                    {(Object.keys(LLM_PROVIDERS) as LlmProvider[]).map((key) => (
                      <option key={key} value={key}>
                        {LLM_PROVIDERS[key].name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lobby-settings-label-block">API 地址</div>
                <input
                  type="text"
                  className="lobby-settings-input"
                  placeholder="例如：https://api.example.com/v1"
                  value={
                    llmSettings.provider === 'custom'
                      ? llmSettings.customBaseUrl
                      : currentProviderConfig.baseUrl
                  }
                  onChange={handleChangeCustomBaseUrl}
                  disabled={!llmSettings.enabled || llmSettings.provider !== 'custom'}
                />
                <div className="lobby-settings-desc">
                  需兼容 OpenAI 格式的 /chat/completions 接口。
                </div>

                <div className="lobby-settings-label-block">模型名称</div>
                {llmSettings.provider === 'custom' ? (
                  <input
                    type="text"
                    className="lobby-settings-input"
                    placeholder="例如：gpt-4o-mini 或其他模型 ID"
                    value={llmSettings.customModel}
                    onChange={handleChangeCustomModel}
                    disabled={!llmSettings.enabled}
                  />
                ) : (
                  <select
                    className="lobby-settings-select"
                    value={llmSettings.model}
                    onChange={handleChangeModel}
                    disabled={!llmSettings.enabled}
                  >
                    {currentProviderConfig.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}

                <div className="lobby-settings-label-block">API Key</div>
                <input
                  type="password"
                  className="lobby-settings-input"
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  value={llmSettings.apiKey}
                  onChange={handleChangeApiKey}
                  disabled={!llmSettings.enabled}
                  autoComplete="off"
                />
                <div className="lobby-settings-desc">
                  填写你自己的 API Key 后，将优先使用你的账户额度。密钥仅存储在本地浏览器。
                </div>
              </div>

              <div className="lobby-settings-card">
                <div className="lobby-settings-label-block">自定义出牌策略提示</div>
                <textarea
                  className="lobby-settings-textarea lobby-settings-textarea-large"
                  rows={6}
                  placeholder="在此输入你希望 AI 遵循的出牌策略..."
                  value={llmSettings.customPrompt}
                  onChange={handleChangeCustomPrompt}
                  disabled={!llmSettings.enabled}
                />
                <div className="lobby-settings-desc">
                  这里的文字会作为额外策略说明附加给大模型，用于微调出牌风格。
                </div>
              </div>
            </>
          )}

          {settingsTab === 'game' && (
            <>
              <div className="panel-section-title">游戏设置</div>

              <div className="lobby-settings-card">
                <div className="lobby-settings-label-block">快速游戏：等待真人时长</div>
                <select
                  className="lobby-settings-select"
                  value={String(gameSettings.quickBotDelayMs)}
                  onChange={handleChangeQuickBotDelay}
                >
                  <option value="0">立即补机器人（最快开局）</option>
                  <option value="30000">等待 30 秒无人加入再补机器人</option>
                  <option value="60000">等待 60 秒无人加入再补机器人</option>
                </select>
                <div className="lobby-settings-desc">
                  仅对房间号以 K 开头的快速房间生效，用于控制多久后自动补齐机器人开局。
                </div>
              </div>
            </>
          )}

          {settingsTab === 'audio' && (
            <>
              <div className="panel-section-title">音频设置</div>

              <div className="lobby-settings-card">
                <div className="lobby-settings-field-row">
                  <span className="lobby-settings-label-text">背景音乐</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={gameSettings.bgmEnabled}
                      onChange={handleToggleBgm}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="lobby-settings-desc">
                  关闭后，进入牌局时不再自动播放背景音乐。
                </div>
              </div>

              <div className="lobby-settings-card">
                <div className="lobby-settings-field-row">
                  <span className="lobby-settings-label-text">音效（出牌、抢地主等）</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={gameSettings.sfxEnabled}
                      onChange={handleToggleSfx}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="lobby-settings-desc">
                  关闭后，仅保留背景音乐，不再播放操作音效。
                </div>
              </div>
            </>
          )}

          <div className="lobby-settings-actions">
            <button type="button" className="btn-cancel" onClick={handleCancel}>
              取消
            </button>
            <button type="button" className="btn-save" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
