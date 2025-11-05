import { Card, Descriptions, Avatar, Button, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const status = globalSocket.getStatus()

  if (!user) {
    return null
  }

  return (
    <Card title="个人中心" extra={<Avatar size={48}>{user.avatar}</Avatar>}>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="玩家名称">{user.name}</Descriptions.Item>
        <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
        <Descriptions.Item label="当前连接">
          {status.connected ? `已连接 (${status.socketId ?? '未知'})` : '未连接'}
        </Descriptions.Item>
        <Descriptions.Item label="重连状态">
          {status.reconnecting ? `重连中 (${status.attempts})` : '正常'}
        </Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" onClick={() => navigate('/rooms')}>
          返回大厅
        </Button>
        <Button danger onClick={handleLogout}>
          退出登录
        </Button>
      </Space>
    </Card>
  )
}
