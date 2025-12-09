/**
 * useGameEvents Hook
 * 统一管理所有游戏事件的注册和处理
 * 
 * 职责：
 * 1. 注册 Socket 事件监听器
 * 2. 协调各个事件处理模块
 * 3. 在组件卸载时清理事件
 */

import { useEffect } from 'react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import type { Socket } from 'socket.io-client'

export interface UseGameEventsProps {
  socket: Socket | null
  connected: boolean
  roomId: string | undefined
  userId: string | number | undefined
  userName: string | undefined
}

/**
 * 游戏事件管理 Hook
 * 
 * 使用示例：
 * ```ts
 * useGameEvents({
 *   socket,
 *   connected,
 *   roomId,
 *   userId: user?.id,
 *   userName: user?.name
 * })
 * ```
 */
export function useGameEvents(props: UseGameEventsProps) {
  const { socket, connected, roomId, userId, userName } = props
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!socket || !connected || !roomId) {
      return
    }

    console.log('[GameEvents] 开始注册游戏事件监听器')

    // TODO: 这里会引入各个事件处理模块
    // const roomHandlers = useRoomEvents({ socket, roomId, userId, userName, dispatch })
    // const biddingHandlers = useBiddingEvents({ socket, roomId, userId, userName, dispatch })
    // const playHandlers = usePlayEvents({ socket, roomId, userId, userName, dispatch })

    // 清理函数
    return () => {
      console.log('[GameEvents] 清理游戏事件监听器')
      // 这里会清理所有事件监听器
    }
  }, [socket, connected, roomId, userId, userName, dispatch])
}
