import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Toast } from 'antd-mobile'
import { globalSocket, type ConnectOptions } from '@/services/socket'

export interface AuthUser {
  id: string
  name: string
  avatar: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (options: ConnectOptions) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 从 sessionStorage 恢复用户信息（标签页隔离）
function getStoredUser(): AuthUser | null {
  try {
    const userName = sessionStorage.getItem('userName')
    const playerAvatar = sessionStorage.getItem('playerAvatar')
    
    if (userName) {
      console.log('🔄 从 sessionStorage 恢复用户信息:', { userName })
      return {
        id: userName,  // 使用 userName 作为 id
        name: userName,
        avatar: playerAvatar || '👑',
      }
    }
  } catch (error) {
    console.error('恢复用户信息失败:', error)
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [loading, setLoading] = useState(false)

  // 刷新后自动重连 Socket
  useEffect(() => {
    const storedUser = getStoredUser()
    if (storedUser) {
      console.log('🔄 检测到用户信息，尝试重连 Socket...')
      globalSocket.connectAndWait({
        userId: storedUser.name,
        userName: storedUser.name,
        playerAvatar: storedUser.avatar,
      }).then(() => {
        console.log('✅ Socket 重连成功')
      }).catch((error) => {
        console.error('❌ Socket 重连失败:', error)
        // 重连失败时清除用户信息
        sessionStorage.removeItem('userId')
        sessionStorage.removeItem('userName')
        sessionStorage.removeItem('playerAvatar')
        setUser(null)
      })
    }
  }, []) // 只在组件挂载时执行一次

  const login = useCallback(async (options: ConnectOptions) => {
    setLoading(true)
    try {
      await globalSocket.connectAndWait(options)
      const authUser: AuthUser = {
        id: options.userName,
        name: options.userName,
        avatar: options.playerAvatar ?? '👑',
      }
      
      // 保存到 sessionStorage（标签页隔离）
      sessionStorage.setItem('userId', authUser.id)
      sessionStorage.setItem('userName', authUser.name)
      sessionStorage.setItem('playerAvatar', authUser.avatar)
      console.log('💾 用户信息已保存到 sessionStorage')
      
      setUser(authUser)
      Toast.show({ content: '登录成功，正在进入大厅', icon: 'success' })
      return authUser
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    globalSocket.clearAuth()
    
    // 清除 sessionStorage
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('userName')
    sessionStorage.removeItem('playerAvatar')
    console.log('🗑️ 用户信息已从 sessionStorage 清除')
    
    setUser(null)
    Toast.show({ content: '已退出登录', icon: 'success' })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 中使用')
  }
  return ctx
}
