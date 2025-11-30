import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/avatars.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// 注册基础 Service Worker（仅在支持的浏览器中）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/sw.js'
    navigator.serviceWorker
      .register(swUrl)
      .catch((error) => {
        console.warn('Service Worker 注册失败:', error)
      })
  })
}