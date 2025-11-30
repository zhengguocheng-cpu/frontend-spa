import { Button, Card } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import './style.css'

export default function Home() {
  const navigate = useNavigate()
  const appVersion = (import.meta as any).env?.VITE_APP_BUILD_VERSION || 'dev'

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <h1 className="home-title">🎮 斗地主</h1>
          <p className="home-subtitle">
            经典斗地主游戏，支持多人在线对战
          </p>
        </div>

        <Card className="home-card">
          <div className="home-description">
            <p>• 实时在线对战</p>
            <p>• 智能出牌提示</p>
            <p>• 断线自动重连</p>
            <p>• 完整游戏规则</p>
          </div>
        </Card>

        <div className="home-actions">
          <Button
            color="primary"
            size="large"
            block
            onClick={() => navigate('/rooms')}
          >
            查看房间列表
          </Button>
          <Button
            size="large"
            block
            onClick={() => navigate('/login')}
            style={{ marginTop: '12px' }}
          >
            前往登录
          </Button>
        </div>
        <div className="home-version">版本：{appVersion}</div>
      </div>
    </div>
  )
}