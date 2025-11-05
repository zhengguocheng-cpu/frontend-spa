import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { Provider } from 'react-redux'
import { Router } from './router'
import { AuthProvider } from './context/AuthContext'
import { store } from './store'
import './App.css'

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider locale={zhCN}>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </ConfigProvider>
    </Provider>
  )
}

export default App