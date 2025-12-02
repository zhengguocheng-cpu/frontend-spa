import { useEffect, useState } from 'react'
import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { Provider } from 'react-redux'
import { Router } from './router'
import { AuthProvider } from './context/AuthContext'
import { store } from './store'
import { preloadCoreAssets } from './utils/preload'
import StartupLoadingScreen from './pages/LoadingScreen'
import './App.css'

function AppContent() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await preloadCoreAssets()
      } catch (error) {
        console.warn('预加载核心资源失败:', error)
      } finally {
        if (!cancelled) {
          setReady(true)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return <StartupLoadingScreen />
  }

  return <Router />
}

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider locale={zhCN}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfigProvider>
    </Provider>
  )
}

export default App