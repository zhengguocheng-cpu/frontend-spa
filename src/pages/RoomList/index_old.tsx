import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, SpinLoading, Tag, Toast } from 'antd-mobile'
import { AddOutline, RedoOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { globalSocket, type RoomSummary } from '@/services/socket'
import { useAuth } from '@/context/AuthContext'
import { useSocketStatus } from '@/hooks/useSocketStatus'
import './style.css'

export default function RoomList() {
  const { user } = useAuth();
  const status = useSocketStatus();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const connected = status.connected;

  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = globalSocket.connect({
      userName: user.name,
      userId: user.id,
      playerAvatar: user.avatar,
      htmlName: 'rooms',
    });

    const handleRoomsUpdated = (data: { rooms?: RoomSummary[] }) => {
      if (data.rooms) {
        setRooms(data.rooms);
      }
    };

    socket.on('rooms_updated', handleRoomsUpdated);

    return () => {
      socket.off('rooms_updated', handleRoomsUpdated);
    };
  }, [user]);

  const loadRooms = useCallback(async () => {
    if (!user) {
      return;
    }
    if (!globalSocket.getSocket()) {
      return;
    }
    setLoading(true);
    try {
      const list = await globalSocket.requestRoomList();
      setRooms(list);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '获取房间列表失败';
      Toast.show({ content: errMsg, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (connected) {
      loadRooms();
    }
  }, [connected, loadRooms, user]);

  const handleJoin = async (roomId: string) => {
    if (!user) {
      return;
    }
    setJoiningRoomId(roomId);
    try {
      await globalSocket.joinGame(
        {
          roomId,
          userId: user.id,
          playerName: user.name,
          playerAvatar: user.avatar,
        },
        true
      );
      Toast.show({ content: '成功加入房间', icon: 'success' });
      navigate(`/game/${roomId}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '加入房间失败';
      Toast.show({ content: errMsg, icon: 'fail' });
    } finally {
      setJoiningRoomId(null);
    }
  };

  const roomList = useMemo(() => rooms, [rooms]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 8px' }}>游戏房间</h2>
          <p style={{ margin: 0, color: '#999' }}>实时查看大厅房间状态，选择加入或等待新房间。</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={connected ? 'success' : 'danger'}>{connected ? '已连接' : '未连接'}</Tag>
          <Button
            size="small"
            color="primary"
            fill="outline"
            onClick={loadRooms}
            disabled={!connected}
            loading={loading}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RedoOutline />
              刷新
            </span>
          </Button>
          <Button size="small" color="primary" disabled>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <AddOutline />
              创建房间
            </span>
          </Button>
        </div>
      </div>

      {loading && roomList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <SpinLoading style={{ '--size': '48px' }} />
          <p style={{ marginTop: 16, color: '#999' }}>正在加载房间列表...</p>
        </div>
      ) : roomList.length === 0 ? (
        <Empty description="暂时没有可加入的房间" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {roomList.map((room) => {
            const playerCount = Array.isArray(room.players) ? room.players.length : room.players
            const isFull = playerCount >= room.maxPlayers

            return (
              <Card
                key={room.id}
                style={{ width: 260 }}
                title={room.name}
                extra={<Tag color={isFull ? 'danger' : 'success'}>{isFull ? '游戏中' : '等待中'}</Tag>}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>玩家: {playerCount}/{room.maxPlayers}</div>
                  <Button
                    color="primary"
                    size="small"
                    block
                    loading={joiningRoomId === room.id}
                    onClick={() => handleJoin(room.id)}
                    disabled={isFull}
                  >
                    {isFull ? '房间已满' : '加入游戏'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}