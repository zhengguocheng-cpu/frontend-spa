import { useEffect, useState } from 'react'
import { globalSocket, type SocketStatus } from '@/services/socket'

export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(() => globalSocket.getStatus())

  useEffect(() => {
    // 订阅全局 Socket 状态变化
    const unsubscribe = globalSocket.subscribeStatus(() => {
      setStatus(globalSocket.getStatus())
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return status
}
