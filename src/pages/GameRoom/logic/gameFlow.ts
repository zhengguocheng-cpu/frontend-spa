/**
 * 游戏流程业务逻辑
 * 包含准备、开始游戏、离开房间等流程控制
 */

import type { Socket } from 'socket.io-client'

/**
 * 玩家准备/取消准备
 */
export function toggleReady(params: {
  roomId: string
  isReady: boolean
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, isReady, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  const action = isReady ? 'unready' : 'ready'
  console.log(`[${action}] 发送${isReady ? '取消' : ''}准备请求`, { roomId })

  socket.emit(action, { roomId }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || `${isReady ? '取消' : ''}准备失败`)
    }
  })
}

/**
 * 开始游戏
 */
export function startGame(params: {
  roomId: string
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  console.log('[StartGame] 发送开始游戏请求', { roomId })

  socket.emit('start_game', { roomId }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || '开始游戏失败')
    }
  })
}

/**
 * 离开房间
 */
export function leaveRoom(params: {
  roomId: string
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  console.log('[LeaveRoom] 发送离开房间请求', { roomId })

  socket.emit('leave_room', { roomId }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || '离开房间失败')
    }
  })
}

/**
 * 抢地主
 */
export function bidLandlord(params: {
  roomId: string
  userId: string | number
  bid: boolean
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, userId, bid, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  console.log('[Bid] 发送抢地主请求', { roomId, userId, bid })

  socket.emit('bid', { roomId, userId, bid }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || '抢地主失败')
    }
  })
}

/**
 * 发送聊天消息
 */
export function sendChatMessage(params: {
  roomId: string
  message: string
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, message, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  if (!message.trim()) {
    onError?.('消息不能为空')
    return
  }

  console.log('[Chat] 发送聊天消息', { roomId, message })

  socket.emit('send_message', { roomId, message }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || '发送消息失败')
    }
  })
}
