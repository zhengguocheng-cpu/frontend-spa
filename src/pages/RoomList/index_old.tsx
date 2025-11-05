import { useCallback, useEffect, useState } from 'react'
import { Card, List, Button, PullToRefresh, Toast, Empty, Tag, SpinLoading } from 'antd-mobile'
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
      message.error(errMsg);
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
      message.success('成功加入房间');
      navigate(`/game/${roomId}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '加入房间失败';
      message.error(errMsg);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const roomList = useMemo(() => rooms, [rooms]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Title level={3}>游戏房间</Title>
          <Paragraph type="secondary">
            实时查看游戏大厅中的房间状态，选择一个加入或等待新房间。
          </Paragraph>
        </div>
        <Space>
          <Tag color={connected ? 'green' : 'red'}>{connected ? '连接正常' : '未连接'}</Tag>
          <Button icon={<ReloadOutlined />} onClick={loadRooms} disabled={!connected} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled>
            创建房间
          </Button>
        </Space>
      </Space>
      {loading && roomList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="正在加载房间列表..." />
        </div>
      ) : roomList.length === 0 ? (
        <Empty description="暂时没有可加入的房间" />
      ) : (
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={roomList}
          renderItem={(room) => (
            <List.Item>
              <Card
                title={room.name}
                actions={[
                  <Button
                    type="link"
                    key={`join-${room.id}`}
                    onClick={() => handleJoin(room.id)}
                    loading={joiningRoomId === room.id}
                  >
                    加入游戏
                  </Button>,
                ]}
              >
                <Space direction="vertical">
                  <div>
                    玩家: {room.players}/{room.maxPlayers}
                  </div>
                  <div>状态: {room.players === room.maxPlayers ? '游戏中' : '等待中'}</div>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </Space>
  );
}