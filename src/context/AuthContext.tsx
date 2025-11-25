import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Toast } from 'antd-mobile'
import { globalSocket, type ConnectOptions } from '@/services/socket'
import { setGuestName } from '@/utils/guestIdentity'

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
  updateUser: (patch: Partial<Pick<AuthUser, 'name' | 'avatar'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 从 sessionStorage 恢复用户信息（标签页隔离）
function getStoredUser(): AuthUser | null {
  try {
    const storedUserId = sessionStorage.getItem('userId')
    const storedUserName = sessionStorage.getItem('userName')
    const playerAvatar = sessionStorage.getItem('playerAvatar')

    // 没有任何缓存，直接返回 null
    if (!storedUserId && !storedUserName) {
      return null
    }

    // 规则：
    // - id 始终代表后端用的唯一标识（优先使用 userId 字段）
    // - name 仅用于展示（优先使用 userName 字段）
    const id = storedUserId || storedUserName!
    const name = storedUserName || storedUserId!

    console.log('🔄 从 sessionStorage 恢复用户信息:', { id, name })
    return {
      id,
      name,
      avatar: playerAvatar || '👑',
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
      globalSocket
        .connectAndWait({
          userId: storedUser.id,
          userName: storedUser.name,
          playerAvatar: storedUser.avatar,
        })
        .then(() => {
          console.log('✅ Socket 重连成功')
        })
        .catch((error) => {
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

      const id = options.userId ?? options.userName
      const name = options.userName ?? options.userId ?? id

      if (!id || !name) {
        throw new Error('缺少用户标识信息')
      }

      const authUser: AuthUser = {
        id,
        name,
        avatar: options.playerAvatar ?? '👑',
      }

      // 保存到 sessionStorage（标签页隔离）
      sessionStorage.setItem('userId', authUser.id)
      sessionStorage.setItem('userName', authUser.name)
      sessionStorage.setItem('playerAvatar', authUser.avatar)
      console.log('💾 用户信息已保存到 sessionStorage')

      // 同步更新本地游客昵称缓存，确保下次自动登录显示最新昵称
      try {
        setGuestName(authUser.name)
      } catch (e) {
        console.warn('更新本地游客昵称失败:', e)
      }

      setUser(authUser)
      Toast.show({ content: '登录成功，正在进入大厅', icon: 'success' })
      return authUser
    } finally {
      setLoading(false)
    }
  }, [])

  const updateUser = useCallback(
    (patch: Partial<Pick<AuthUser, 'name' | 'avatar'>>) => {
      setUser((prev) => {
        if (!prev) return prev
        const next: AuthUser = {
          ...prev,
          ...patch,
        }

        sessionStorage.setItem('userId', next.id)
        sessionStorage.setItem('userName', next.name)
        sessionStorage.setItem('playerAvatar', next.avatar)

        // 更新游客昵称缓存，保证下次自动登录时使用最新昵称
        try {
          setGuestName(next.name)
        } catch (e) {
          console.warn('更新本地游客昵称失败:', e)
        }

        try {
          globalSocket.updateUser(next)
        } catch (error) {
          console.error('更新 Socket 用户信息失败:', error)
        }

        return next
      })
    },
    [],
  )

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
    () => ({ user, loading, login, logout, updateUser }),
    [user, loading, login, logout, updateUser]
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
