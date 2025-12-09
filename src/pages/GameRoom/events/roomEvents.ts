/**
 * 房间相关事件处理
 * 包含：加入房间、玩家进出、准备等
 */

import type { Socket } from 'socket.io-client'
import type { AppDispatch } from '@/store'

export interface RoomEventHandlers {
  handleRoomJoined: (data: any) => void
  handleJoinGameSuccess: (data: any) => void
  handlePlayerJoined: (data: any) => void
  handlePlayerLeft: (data: any) => void
  handlePlayerReady: (data: any) => void
}

export interface CreateRoomHandlersParams {
  dispatch: AppDispatch
  roomId: string
  userId: string | number
  appendSystemMessage: (msg: string) => void
  refreshWalletScore: () => void
  updatePlayers: (players: any[]) => void
}

/**
 * 创建房间事件处理器
 */
export function createRoomHandlers(params: CreateRoomHandlersParams): RoomEventHandlers {
  const { dispatch, roomId, userId, appendSystemMessage, refreshWalletScore, updatePlayers } = params

  const handleRoomJoined = (data: any) => {
    console.log('[Room] room_joined 事件:', data)
    appendSystemMessage(`成功加入房间: ${data.roomId || roomId}`)
  }

  const handleJoinGameSuccess = (data: any) => {
    console.log('[Room] join_game_success 事件:', data)
    appendSystemMessage('成功加入游戏')
    
    if (data.players && Array.isArray(data.players)) {
      updatePlayers(data.players)
    }
  }

  const handlePlayerJoined = (data: any) => {
    console.log('[Room] player_joined 事件:', data)
    
    const playerName = data.playerName || data.name || '新玩家'
    appendSystemMessage(`${playerName} 加入了房间`)
    
    if (data.players && Array.isArray(data.players)) {
      updatePlayers(data.players)
    }
    
    refreshWalletScore()
  }

  const handlePlayerLeft = (data: any) => {
    console.log('[Room] player_left 事件:', data)
    
    const playerName = data.playerName || data.name || '玩家'
    appendSystemMessage(`${playerName} 离开了房间`)
    
    if (data.players && Array.isArray(data.players)) {
      updatePlayers(data.players)
    }
  }

  const handlePlayerReady = (data: any) => {
    console.log('[Room] player_ready 事件:', data)
    
    const playerName = data.playerName || data.name || '玩家'
    const isReady = data.isReady !== false
    appendSystemMessage(`${playerName} ${isReady ? '已准备' : '取消准备'}`)
    
    if (data.players && Array.isArray(data.players)) {
      updatePlayers(data.players)
    }
  }

  return {
    handleRoomJoined,
    handleJoinGameSuccess,
    handlePlayerJoined,
    handlePlayerLeft,
    handlePlayerReady,
  }
}

/**
 * 注册房间事件监听器
 */
export function registerRoomEvents(socket: Socket, handlers: RoomEventHandlers) {
  socket.on('room_joined', handlers.handleRoomJoined)
  socket.on('join_game_success', handlers.handleJoinGameSuccess)
  socket.on('player_joined', handlers.handlePlayerJoined)
  socket.on('player_left', handlers.handlePlayerLeft)
  socket.on('player_ready', handlers.handlePlayerReady)
}

/**
 * 移除房间事件监听器
 */
export function unregisterRoomEvents(socket: Socket, handlers: RoomEventHandlers) {
  socket.off('room_joined', handlers.handleRoomJoined)
  socket.off('join_game_success', handlers.handleJoinGameSuccess)
  socket.off('player_joined', handlers.handlePlayerJoined)
  socket.off('player_left', handlers.handlePlayerLeft)
  socket.off('player_ready', handlers.handlePlayerReady)
}
