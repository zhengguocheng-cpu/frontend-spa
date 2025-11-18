import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'
import { getOrCreateGuestIdentity } from '@/utils/guestIdentity'
import './style.css'

export default function LobbyHome() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [autoLoggingIn, setAutoLoggingIn] = useState(false)
  const [walletScore, setWalletScore] = useState<number | null>(null)

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
          setWalletScore(null)
          return
        }

        const data = json.data
        const scoreValue =
          typeof data.totalScore === 'number' ? data.totalScore : 0
        setWalletScore(scoreValue)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载钱包失败:', err)
        setWalletScore(null)
      }
    }

    loadWallet()

    return () => {
      controller.abort()
    }
  }, [user])

  const handleQuickStart = async () => {
    if (!user) {
      Toast.show({ content: '请先登录后再开始游戏', icon: 'info' })
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

      socket.emit('player_ready', {
        roomId: targetRoom.id,
        userId: user.id,
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
        Toast.show({ content: '设置功能开发中', icon: 'info' })
        break
      case 'shop':
        Toast.show({ content: '商城暂未开放', icon: 'info' })
        break
      case 'vip':
        Toast.show({ content: '会员中心暂未开放', icon: 'info' })
        break
      case 'forum':
        Toast.show({ content: '论坛暂未开放', icon: 'info' })
        break
      case 'more':
        Toast.show({ content: '更多功能开发中', icon: 'info' })
        break
    }
  }

  const formatAmount = (value: number | null) => {
    if (value == null) return '--'
    if (value >= 10000) {
      return `${(value / 10000).toFixed(2)}万`
    }
    return String(value)
  }

  const displayName = user?.name ?? '未登录玩家'
  const displayId = user?.id ?? '--'
  const playerLevel = '新手IV'

  return (
    <div className="lobby-container">
      <div className="lobby-header-block">
        <div className="lobby-header">
          <button className="lobby-user" onClick={handleGoProfile} type="button">
            <div className="lobby-user-avatar">
              <div className="lobby-avatar-img" />
            </div>
            <div className="lobby-user-info">
              <div className="lobby-user-name">{displayName}</div>
              <div className="lobby-user-id">ID: {displayId}</div>
            </div>
          </button>
          <div className="lobby-user-level">
            <span className="lobby-level-icon" aria-hidden>
              🛡
            </span>
            <span className="lobby-level-text">{playerLevel}</span>
          </div>
          <div className="lobby-assets">
            <div className="lobby-asset-item">
              <span className="asset-icon" aria-hidden>
                💎
              </span>
              <span className="asset-value">{formatAmount(walletScore)}</span>
            </div>
            <div className="lobby-asset-item">
              <span className="asset-icon" aria-hidden>
                🪙
              </span>
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
          onClick={() => handleBottomClick('forum')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            📊
          </span>
          <span className="bottom-nav-label">论坛</span>
        </button>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => handleBottomClick('more')}
        >
          <span className="bottom-nav-icon" aria-hidden>
            ⋯
          </span>
          <span className="bottom-nav-label">更多</span>
        </button>
      </div>
    </div>
  )
}
