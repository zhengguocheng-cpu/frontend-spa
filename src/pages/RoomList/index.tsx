import { useEffect, useState } from 'react'
import { Card, List, Button, Toast, Empty, Tag, SpinLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { globalSocket, type RoomSummary } from '@/services/socket'
import { useAuth } from '@/context/AuthContext'
import './style.css'

export default function RoomList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

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
    globalSocket.clearAuth()
    navigate('/login')
  }

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <h1 className="room-list-title">🎮 游戏大厅</h1>
        <p className="room-list-subtitle">
          欢迎，{user?.name} {user?.avatar}
        </p>
      </div>

      <div className="room-list-actions">
        <Tag color={connected ? 'success' : 'danger'}>
          {connected ? '✅ 已连接' : '❌ 未连接'}
        </Tag>
        <Button
          size="small"
          onClick={loadRooms}
          disabled={!connected}
          loading={loading}
        >
          🔄 刷新
        </Button>
        <Button
          size="small"
          color="danger"
          onClick={handleLogout}
        >
          🚪 退出
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
        <List>
          {rooms.map((room) => {
            // 处理 players 可能是数组或数字的情况
            const playerCount = Array.isArray(room.players) ? room.players.length : room.players
            const isFull = playerCount >= room.maxPlayers
            
            return (
              <List.Item key={room.id}>
                <Card className="room-card">
                  <div className="room-card-content">
                    <div className="room-info">
                      <span className="room-name">🏠 {room.name}</span>
                      <Tag color={isFull ? 'danger' : 'success'}>
                        {isFull ? '游戏中' : '等待中'}
                      </Tag>
                    </div>
                    <div className="room-players">
                      👥 玩家: {playerCount}/{room.maxPlayers}
                    </div>
                    <Button
                      color="primary"
                      size="small"
                      block
                      onClick={() => handleJoin(room.id)}
                      loading={joiningRoomId === room.id}
                      disabled={isFull}
                      style={{ marginTop: '12px' }}
                    >
                      {isFull ? '房间已满' : '🎮 加入游戏'}
                    </Button>
                  </div>
                </Card>
              </List.Item>
            )
          })}
        </List>
      )}
    </div>
  )
}
