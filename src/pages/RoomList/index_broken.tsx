import { useCallback, useEffect, useState } from 'react'
import { Card, List, Button, Toast, Empty, Tag, SpinLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { globalSocket, type RoomSummary } from '@/services/socket'
import { useAuth } from '@/context/AuthContext'
import { useSocketStatus } from '@/hooks/useSocketStatus'
import './style.css'

export default function RoomList() {
  const { user } = useAuth()
  const status = useSocketStatus()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const connected = status.connected

  useEffect(() => {
    if (!user) {
      return
    }

    const socket = globalSocket.connect({
      userName: user.name,
      userId: user.id,
      playerAvatar: user.avatar,
      htmlName: 'rooms',
    })

    const handleRoomsUpdated = (data: { rooms?: RoomSummary[] }) => {
      if (data.rooms) {
        setRooms(data.rooms)
      }
    }

    socket.on('rooms_updated', handleRoomsUpdated)

    return () => {
      socket.off('rooms_updated', handleRoomsUpdated)
    }
  }, [user])

  const loadRooms = useCallback(async () => {
    if (!user) {
      return
    }
    if (!globalSocket.getSocket()) {
      return
    }
    setLoading(true)
    try {
      const list = await globalSocket.requestRoomList()
      setRooms(list)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '获取房间列表失败'
      Toast.show({ content: errMsg, icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }
    if (connected) {
      loadRooms()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, user]) // 移除 loadRooms 依赖，避免无限循环

  const handleJoin = async (roomId: string) => {
    if (!user) {
      return
    }
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
        <h1 className="room-list-title">游戏房间</h1>
        <p className="room-list-subtitle">
          欢迎，{user?.name} {user?.avatar}
        </p>
      </div>

      <div className="room-list-actions">
        <Tag color={connected ? 'success' : 'danger'}>
          {connected ? '已连接' : '未连接'}
        </Tag>
        <Button
          size="small"
          onClick={loadRooms}
          disabled={!connected}
          loading={loading}
        >
          刷新
        </Button>
        <Button
          size="small"
          color="danger"
          onClick={handleLogout}
        >
          退出
        </Button>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="loading-state">
          <SpinLoading style={{ '--size': '48px' }} />
          <p>正在加载房间列表...</p>
        </div>
      ) : rooms.length === 0 ? (
        <Empty description="暂时没有可加入的房间" />
      ) : (
        <List>
          {rooms.map((room) => {
            const playerCount = Array.isArray(room.players) ? room.players.length : room.players
            const isFull = playerCount >= room.maxPlayers

            return (
              <List.Item key={room.id}>
                <Card className="room-card">
                  <div className="room-card-content">
                    <div className="room-info">
                      <span className="room-name">{room.name}</span>
                      <span className="room-status">{isFull ? '游戏中' : '等待中'}</span>
                    </div>
                    <div className="room-players">
                      玩家: {playerCount}/{room.maxPlayers}
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
                      {isFull ? '房间已满' : '加入游戏'}
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
