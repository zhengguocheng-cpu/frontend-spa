import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'
import { getOrCreateGuestIdentity } from '@/utils/guestIdentity'
import { getLevelByScore } from '@/utils/playerLevel'
import { getLlmSettings, saveLlmSettings, type LlmSettings } from '@/utils/llmSettings'
import { getGameSettings, saveGameSettings, type GameSettings } from '@/utils/gameSettings'
import { soundManager } from '@/utils/sound'
import { formatScore } from '@/utils/scoreFormatter'
import '@/styles/avatars.css'
import './style.css'

export default function LobbyHome() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const appVersion = (import.meta as any).env?.VITE_APP_BUILD_VERSION || 'dev'
  const [autoLoggingIn, setAutoLoggingIn] = useState(false)
  const [walletScore, setWalletScore] = useState<number | null>(null)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() => getLlmSettings())
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => getGameSettings())
  const [settingsTab, setSettingsTab] = useState<'ai' | 'game' | 'audio'>('ai')

  const handleGoProfile = () => {
    if (!user) {
      Toast.show({ content: '请先登录再查看个人信息', icon: 'info' })
      return
    }
    navigate('/profile')
  }

  const handleSyncWeChat = () => {
    Toast.show({ content: '微信信息同步功能开发中', icon: 'info' })
  }

  const openSettings = () => {
    setLlmSettings(getLlmSettings())
    setGameSettings(getGameSettings())
    setSettingsTab('ai')
    setSettingsVisible(true)
  }

  const closeSettings = () => {
    setSettingsVisible(false)
  }

  const handleSaveSettings = () => {
    saveLlmSettings(llmSettings)
    saveGameSettings(gameSettings)
    Toast.show({ content: '设置已保存', icon: 'success' })
    setSettingsVisible(false)
  }

  const handleToggleLlmEnabled = (e: any) => {
    const enabled = e.target?.checked
    setLlmSettings((prev) => ({ ...prev, enabled }))
  }

  const handleChangeModel = (e: any) => {
    const model = e.target?.value
    setLlmSettings((prev) => ({ ...prev, model }))
  }

  const handleChangeCustomPrompt = (e: any) => {
    const customPrompt = e.target?.value
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

  useEffect(() => {
    if (user || loading || autoLoggingIn) return

    const guest = getOrCreateGuestIdentity()
    setAutoLoggingIn(true)

    login({
      userId: guest.id,
      userName: guest.name,
      playerAvatar: '👑',
      htmlName: 'spa',
    })
      .catch((error) => {
        const errMsg = error instanceof Error ? error.message : '登录失败，请稍后重试'
        Toast.show({ content: errMsg, icon: 'fail' })
      })
      .finally(() => {
        setAutoLoggingIn(false)
      })
  }, [user, loading, autoLoggingIn, login])

  useEffect(() => {
    if (!user) {
      setWalletScore(null)
      return
    }

    const controller = new AbortController()

    const loadWallet = async () => {
      try {
        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        const res = await fetch(
          `${baseUrl}/api/score/${encodeURIComponent(user.id)}`,
          {
            signal: controller.signal,
          },
        )

        let json: any = null
        try {
          json = await res.json()
        } catch {
          // ignore body parse error
        }

        if (!res.ok || !json?.success || !json.data) {
          console.warn('加载钱包失败或返回结构异常:', res.status, json?.message)
          setWalletScore(0)
          return
        }

        const data = json.data
        const scoreValue =
          typeof data.totalScore === 'number' ? data.totalScore : 0
        setWalletScore(scoreValue)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载钱包失败:', err)
        setWalletScore(0)
      }
    }

    loadWallet()

    return () => {
      controller.abort()
    }
  }, [user])

  // 同步当前积分到 sessionStorage，供其他页面（如房间列表）做积分校验
  useEffect(() => {
    if (walletScore == null) return
    try {
      sessionStorage.setItem('lastWalletScore', String(walletScore))
    } catch {
      // ignore storage error
    }
  }, [walletScore])

  useEffect(() => {
    soundManager.setSoundEnabled(gameSettings.sfxEnabled)
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    } else {
      soundManager.stopBackgroundMusic()
    }
  }, [gameSettings.bgmEnabled, gameSettings.sfxEnabled])

  useEffect(() => {
    return () => {
      soundManager.stopBackgroundMusic()
    }
  }, [])

  const handleQuickStart = async () => {
    if (!user) {
      Toast.show({ content: '请先登录后再开始游戏', icon: 'info' })
      return
    }

    // 积分不足时禁止开始游戏
    if (walletScore !== null && walletScore <= 0) {
      Toast.show({ content: '积分不足，请前往积分中心充值', icon: 'info' })
      return
    }

    const socket = globalSocket.getSocket()
    if (!socket) {
      Toast.show({ content: '服务器未连接，请稍后重试', icon: 'fail' })
      return
    }

    try {
      const rooms: any[] = await globalSocket.requestRoomList()
      if (!rooms || rooms.length === 0) {
        Toast.show({ content: '暂时没有可加入的房间', icon: 'info' })
        return
      }

      const getPlayerCount = (room: any) => {
        if (Array.isArray(room.players)) return room.players.length
        if (typeof room.players === 'number') return room.players
        if (Array.isArray(room.playerList)) return room.playerList.length
        return 0
      }

      const isWaiting = (room: any) => {
        const status = (room as any).status as string | undefined
        return !status || status === 'waiting'
      }

      // 快速游戏区：默认房间（ID 以 K 开头），且未开始、未满
      const quickWaitingRooms = rooms.filter((room) => {
        const playerCount = getPlayerCount(room)
        return String(room.id).startsWith('K') && isWaiting(room) && playerCount < room.maxPlayers
      })

      let targetRoom: any | undefined

      if (quickWaitingRooms.length > 0) {
        quickWaitingRooms.sort((a, b) => getPlayerCount(b) - getPlayerCount(a))
        targetRoom = quickWaitingRooms[0]
      } else {
        // 找不到快速游戏区房间时，退化为任意等待中的未满房间
        const waitingRooms = rooms.filter((room) => {
          const playerCount = getPlayerCount(room)
          return isWaiting(room) && playerCount < room.maxPlayers
        })

        if (waitingRooms.length > 0) {
          waitingRooms.sort((a, b) => getPlayerCount(b) - getPlayerCount(a))
          targetRoom = waitingRooms[0]
        }
      }

      if (!targetRoom) {
        Toast.show({ content: '暂时没有可加入的房间', icon: 'info' })
        return
      }

      await globalSocket.joinGame(
        {
          roomId: targetRoom.id,
          userId: user.id,
          playerName: user.name,
          playerAvatar: user.avatar,
        },
        true,
      )

      navigate(`/game/${targetRoom.id}`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '快速开始失败，请稍后重试'
      Toast.show({ content: errMsg, icon: 'fail' })
    }
  }

  const handleGoRooms = () => {
    navigate('/rooms')
  }

  const handleBombZone = () => {
    Toast.show({ content: '炸弹专区暂未开放，敬请期待', icon: 'info' })
  }

  const handleBottomClick = (type: string) => {
    switch (type) {
      case 'settings':
        openSettings()
        break
      case 'shop':
        Toast.show({ content: '商城暂未开放', icon: 'info' })
        break
      case 'vip':
        Toast.show({ content: '会员中心暂未开放', icon: 'info' })
        break
      case 'leaderboard':
        navigate('/leaderboard')
        break
      case 'feedback':
        navigate('/feedback')
        break
    }
  }

  const formatAmount = (value: number | null) => {
    const safe = typeof value === 'number' && value >= 0 ? value : 0
    return formatScore(safe)
  }

  const displayName = user?.name ?? '未登录玩家'
  const displayId = user?.id ?? '--'
  const { name: playerLevelName, icon: playerLevelIcon } = getLevelByScore(walletScore)

  const renderUserAvatar = () => {
    const raw = (user?.avatar || '').trim()
    if (!raw) {
      return <div className="lobby-avatar-img" />
    }

    const match = raw.match(/^avatar-(\d+)$/)
    if (match) {
      const id = Number(match[1])
      if (!Number.isNaN(id) && id > 0) {
        return <div className={`avatar-sprite avatar-${id} avatar-sprite-small`} />
      }
    }

    // 兼容旧的 emoji 头像
    return <span className="lobby-avatar-emoji">{raw}</span>
  }

  return (
    <div className="lobby-container">
      <div className="lobby-header-block">
        <div className="lobby-header">
          <button className="lobby-user" onClick={handleGoProfile} type="button">
            <div className="lobby-user-avatar">
              {renderUserAvatar()}
            </div>
            <div className="lobby-user-info">
              <div className="lobby-user-level">
                <span className="lobby-level-icon" aria-hidden>
                  {playerLevelIcon}
                </span>
                <span className="lobby-level-text">{playerLevelName}</span>
              </div>
              <div className="lobby-user-name">{displayName}</div>
              <div className="lobby-user-id">ID: {displayId}</div>
            </div>
          </button>
          <div className="lobby-assets">
            <div className="lobby-asset-item">
              <span className="asset-icon asset-icon-diamond" aria-hidden />
              <span className="asset-value">{formatAmount(walletScore)}</span>
            </div>
            <div className="lobby-asset-item">
              <span className="asset-icon asset-icon-coin" aria-hidden />
              <span className="asset-value">{formatAmount(walletScore)}</span>
            </div>
          </div>
        </div>
        {user && (
          <button type="button" className="lobby-sync-wechat" onClick={handleSyncWeChat}>
            点击同步微信信息
          </button>
        )}
      </div>

      <div className="lobby-model-slot">
        <div className="lobby-model-image" />
      </div>

      <div className="lobby-main-cards">
        <div className="lobby-card quick" onClick={handleQuickStart}>
          <div className="lobby-card-title">快速游戏</div>
          <div className="lobby-card-img lobby-card-img-quick" />
          <div className="lobby-card-desc">一键进入可用房间</div>
        </div>
        <div className="lobby-card join" onClick={handleGoRooms}>
          <div className="lobby-card-title">加入房间</div>
          <div className="lobby-card-img lobby-card-img-join" />
          <div className="lobby-card-desc">查看房间列表，手动选择</div>
        </div>
        <div className="lobby-card bomb" onClick={handleBombZone}>
          <div className="lobby-card-title">炸弹专区</div>
          <div className="lobby-card-img lobby-card-img-bomb" />
          <div className="lobby-card-desc">玩法升级，敬请期待</div>
        </div>
      </div>

      <div className="lobby-bottom-nav">
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('settings')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            ⚙️
          </span>
          <span className="bottom-nav-label">设置</span>
        </button>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('shop')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            🛒
          </span>
          <span className="bottom-nav-label">商城</span>
        </button>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('vip')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            👑
          </span>
          <span className="bottom-nav-label">会员</span>
        </button>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('leaderboard')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            🏆
          </span>
          <span className="bottom-nav-label">排行榜</span>
        </button>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('feedback')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            💬
          </span>
          <span className="bottom-nav-label">反馈</span>
        </button>
      </div>

      <div className="lobby-version">版本：{appVersion}</div>

      {settingsVisible && (
        <div className="lobby-settings-mask" onClick={closeSettings}>
          <div
            className="lobby-settings-panel"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="lobby-settings-header"></div>
            <div className="lobby-settings-body">
              <div className="lobby-settings-tabs-vertical">
                <button
                  type="button"
                  className={
                    'lobby-settings-tab-item' + (settingsTab === 'ai' ? ' active' : '')
                  }
                  onClick={() => setSettingsTab('ai')}
                >
                  AI 提示
                </button>
                <button
                  type="button"
                  className={
                    'lobby-settings-tab-item' + (settingsTab === 'game' ? ' active' : '')
                  }
                  onClick={() => setSettingsTab('game')}
                >
                  游戏设置
                </button>
                <button
                  type="button"
                  className={
                    'lobby-settings-tab-item' + (settingsTab === 'audio' ? ' active' : '')
                  }
                  onClick={() => setSettingsTab('audio')}
                >
                  音频设置
                </button>
              </div>

              <div className="lobby-settings-section">
                {/* AI 出牌提示设置 */}
                {settingsTab === 'ai' && (
                  <>
                    <div className="lobby-settings-group-title">🤖 AI 出牌提示</div>

                    <div className="lobby-settings-field">
                      <div className="lobby-settings-field-row">
                        <span className="lobby-settings-label-text">启用大模型提示</span>
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
                        关闭后，提示只使用本地算法，不再调用 LLM，避免拆炸弹等高风险操作。
                      </div>
                    </div>

                    <div className="lobby-settings-field">
                      <div className="lobby-settings-label-block">大模型类型</div>
                      <select
                        className="lobby-settings-select"
                        value={llmSettings.model}
                        onChange={handleChangeModel}
                        disabled={!llmSettings.enabled}
                      >
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                      </select>
                      <div className="lobby-settings-desc">
                        不同模型在速度和思考深度上有所差异，可按需要切换。
                      </div>
                    </div>

                    <div className="lobby-settings-field">
                      <div className="lobby-settings-label-block">自定义提示偏好（可选）</div>
                      <textarea
                        className="lobby-settings-textarea"
                        rows={3}
                        placeholder="例如：尽量保留炸弹，不要轻易拆 4444 等大牌；有顺子、连对、飞机时优先整体出。"
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

                {/* 游戏设置 */}
                {settingsTab === 'game' && (
                  <>
                    <div className="lobby-settings-group-title">🎮 游戏设置</div>

                    <div className="lobby-settings-field">
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

                {/* 音频设置 */}
                {settingsTab === 'audio' && (
                  <>
                    <div className="lobby-settings-group-title">🔊 音频设置</div>

                    <div className="lobby-settings-field">
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

                    <div className="lobby-settings-field">
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
              </div>
            </div>

            <div className="lobby-settings-actions">
              <button type="button" className="btn-cancel" onClick={closeSettings}>
                取消
              </button>
              <button type="button" className="btn-save" onClick={handleSaveSettings}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
