import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'
import { getOrCreateGuestIdentity } from '@/utils/guestIdentity'
import { getLevelByScore } from '@/utils/playerLevel'
import { getGameSettings, type GameSettings } from '@/utils/gameSettings'
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
  const [gameSettings] = useState<GameSettings>(() => getGameSettings())

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

    try {
      try {
        sessionStorage.setItem('debug_quick_click', String(Date.now()))
      } catch {
      }
      // 确保 Socket 已连接（移动端从后台恢复或长时间 idle 后可能被断开）
      let socket = globalSocket.getSocket()
      const status = globalSocket.getStatus()

      if (!socket || !status.connected) {
        socket = await globalSocket.connectAndWait({
          userId: user.id,
          userName: user.name,
          playerAvatar: user.avatar,
          htmlName: 'spa',
        })
      }

      if (!socket) {
        Toast.show({ content: '服务器未连接，请稍后重试', icon: 'fail' })
        return
      }

      const rooms: any[] = await globalSocket.requestRoomList()
      try {
        sessionStorage.setItem('debug_quick_rooms_resolved', String(Date.now()))
      } catch {
      }
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

      try {
        sessionStorage.setItem('debug_quick_join_emit', String(Date.now()))
      } catch {
      }

      globalSocket.joinGame({
        roomId: targetRoom.id,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })

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
        navigate('/settings')
        break
      case 'shop':
        Toast.show({ content: '商城暂未开放', icon: 'info' })
        break
      case 'vip':
        navigate('/membership')
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
    </div>
  )
}
