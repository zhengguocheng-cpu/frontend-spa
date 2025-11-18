import { useEffect, useState } from 'react'
import { Card, Button, Toast, Empty, Tag, SpinLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { globalSocket, type RoomSummary } from '@/services/socket'
import { useAuth } from '@/context/AuthContext'
import './style.css'

export default function RoomList() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const checkEnvironment = () => {
      if (typeof window === 'undefined') return

      const isDisplayStandalone = window.matchMedia?.('(display-mode: standalone)').matches
      const isNavigatorStandalone = (window.navigator as any)?.standalone === true

      const ua = window.navigator.userAgent || ''
      const isAndroidWebView = /Android/.test(ua) && /; wv\)/.test(ua)
      const isIOS = /\b(iPhone|iPad|iPod)\b/.test(ua)
      const isSafari = /Safari/.test(ua)
      const isIOSWebView = isIOS && !isSafari

      const isNativeShell = isAndroidWebView || isIOSWebView

      setShowInstallBanner(
        Boolean(!isDisplayStandalone && !isNavigatorStandalone && !isNativeShell)
      )
    }

    checkEnvironment()

    const media = window.matchMedia?.('(display-mode: standalone)')
    media?.addEventListener('change', checkEnvironment)

    return () => {
      media?.removeEventListener('change', checkEnvironment)
    }
  }, [])

  // 使用已有的 Socket 连接（登录时已建立）
  useEffect(() => {
    if (!user) return

    console.log('🔵 使用已有 Socket 连接')
    
    const socket = globalSocket.getSocket()
    if (!socket) {
      console.error('❌ Socket 未连接，请重新登录')
      Toast.show({ content: 'Socket 未连接，请重新登录', icon: 'fail' })
      return
    }

    // 监听连接状态
    const handleConnect = () => {
      console.log('✅ Socket 已连接')
      setConnected(true)
    }

    const handleDisconnect = () => {
      console.log('❌ Socket 已断开')
      setConnected(false)
    }

    // 监听房间更新
    const handleRoomsUpdated = (data: { rooms?: RoomSummary[] }) => {
      console.log('📡 收到房间更新:', data)
      if (data.rooms) {
        setRooms(data.rooms)
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('rooms_updated', handleRoomsUpdated)

    // 检查初始连接状态
    if (socket.connected) {
      setConnected(true)
    }

    return () => {
      console.log('🔵 清理 Socket 监听器')
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('rooms_updated', handleRoomsUpdated)
    }
  }, [user])

  // 连接成功后加载房间列表
  useEffect(() => {
    if (connected && user) {
      console.log('🔵 连接成功，加载房间列表')
      loadRooms()
    }
  }, [connected])

  const loadRooms = async () => {
    if (!user || !globalSocket.getSocket()) {
      return
    }

    console.log('🔵 开始加载房间列表...')
    setLoading(true)
    try {
      const list = await globalSocket.requestRoomList()
      console.log('✅ 房间列表加载成功:', list)
      setRooms(list)
    } catch (error) {
      console.error('❌ 加载房间列表失败:', error)
      const errMsg = error instanceof Error ? error.message : '获取房间列表失败'
      Toast.show({ content: errMsg, icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (roomId: string) => {
    if (!user) return

    setJoiningRoomId(roomId)
    try {
      await globalSocket.joinGame(
        {
          roomId,
          userId: user.id,
          playerName: user.name,
          playerAvatar: user.avatar,
        },
        true
      )
      Toast.show({ content: '成功加入房间', icon: 'success' })
      navigate(`/game/${roomId}`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '加入房间失败'
      Toast.show({ content: errMsg, icon: 'fail' })
    } finally {
      setJoiningRoomId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="room-list-container">
      {showInstallBanner && (
        <div className="install-banner">
          <div className="install-banner-text">
            为了下次可以从桌面一键打开，建议先将「欢乐斗地主」安装到桌面。
          </div>
          <Button
            size="small"
            color="primary"
            className="install-banner-button"
            onClick={() => navigate('/install')}
          >
            安装到桌面
          </Button>
        </div>
      )}
      <div className="room-list-header">
        <h1 className="room-list-title">🎮 游戏大厅</h1>
        <p className="room-list-subtitle">
          欢迎，{user?.name} {user?.avatar}
        </p>
      </div>

      <div className="room-list-actions">
        <Tag
          color={connected ? 'success' : 'danger'}
          className="room-status-tag"
        >
          <span className="action-icon" aria-hidden>
            {connected ? '✅' : '❌'}
          </span>
          <span>{connected ? '已连接' : '未连接'}</span>
        </Tag>
        <Button
          size="small"
          className="room-action-button"
          onClick={loadRooms}
          disabled={!connected}
          loading={loading}
        >
          <span className="action-icon" aria-hidden>🔄</span>
          <span>刷新</span>
        </Button>
        <Button
          size="small"
          className="room-action-button"
          onClick={() => navigate('/leaderboard')}
        >
          <span className="action-icon" aria-hidden>🏆</span>
          <span>排行榜</span>
        </Button>
        <Button
          size="small"
          className="room-action-button"
          onClick={() => navigate('/feedback')}
        >
          <span className="action-icon" aria-hidden>💬</span>
          <span>意见反馈</span>
        </Button>
        <Button
          size="small"
          className="room-action-button"
          onClick={() => navigate('/profile')}
        >
          <span className="action-icon" aria-hidden>👤</span>
          <span>个人中心</span>
        </Button>
        <Button
          size="small"
          color="danger"
          className="room-action-button"
          onClick={handleLogout}
        >
          <span className="action-icon" aria-hidden>🚪</span>
          <span>退出</span>
        </Button>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="loading-state">
          <SpinLoading style={{ '--size': '48px' }} />
          <p>正在加载房间列表...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <Empty description="暂时没有可加入的房间" />
          <p style={{ marginTop: '16px', color: '#999', fontSize: '14px' }}>
            等待其他玩家创建房间，或者刷新列表
          </p>
        </div>
      ) : (
        <div className="room-list-grid">
          {rooms.map((room) => {
            // 处理 players 可能是数组或数字的情况
            const playerCount = Array.isArray(room.players) ? room.players.length : room.players
            const isFull = playerCount >= room.maxPlayers
            const rawStatus = (room as any).status as string | undefined
            const roomStatus: 'waiting' | 'playing' | 'finished' =
              rawStatus === 'playing' ? 'playing' : rawStatus === 'finished' ? 'finished' : 'waiting'
            const tagColor =
              roomStatus === 'playing' ? 'warning' : roomStatus === 'finished' ? 'default' : 'success'
            const tagText =
              roomStatus === 'playing' ? '游戏中' : roomStatus === 'finished' ? '已结束' : '等待中'
            const cardClassName = `room-card room-card-${roomStatus}`

            return (
              <Card className={cardClassName} key={room.id}>
                <div className="room-card-content">
                  <div className={`room-card-status room-card-status-${roomStatus}`} />
                  <div className="room-card-main">
                    <div className="room-info">
                      <span className="room-name">🏠 {room.name}</span>
                      <Tag color={tagColor}>
                        {tagText}
                      </Tag>
                    </div>
                    <div className="room-players">
                      👥 玩家: {playerCount}/{room.maxPlayers}
                    </div>
                  </div>
                  <Button
                    className="join-room-button"
                    color="primary"
                    size="small"
                    onClick={() => handleJoin(room.id)}
                    loading={joiningRoomId === room.id}
                    disabled={isFull}
                  >
                    {isFull ? '房间已满' : '🎮 加入游戏'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
