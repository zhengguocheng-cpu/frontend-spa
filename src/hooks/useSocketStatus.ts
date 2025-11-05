import { useSyncExternalStore } from 'react'
import { globalSocket, type SocketStatus } from '@/services/socket'

export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(
    (notify) => globalSocket.subscribeStatus(notify),
    () => globalSocket.getStatus(),
    () => globalSocket.getStatus()
  )
}
