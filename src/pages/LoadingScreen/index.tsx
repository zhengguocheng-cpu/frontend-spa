import { SpinLoading } from 'antd-mobile'
import './style.css'

interface StartupLoadingScreenProps {
  text?: string
}

export default function StartupLoadingScreen({ text }: StartupLoadingScreenProps) {
  const displayText = text || '高手请稍候，游戏资源加载中...'

  return (
    <div className="app-loading-screen">
      <div className="app-loading-overlay" />
      <div className="app-loading-content">
        <div className="app-loading-bottom">
          <div className="app-loading-spinner">
            <SpinLoading style={{ '--size': '40px' }} />
          </div>
          <div className="app-loading-text-main">{displayText}</div>
          <div className="app-loading-progress">
            <div className="app-loading-progress-inner" />
          </div>
        </div>
      </div>
    </div>
  )
}
