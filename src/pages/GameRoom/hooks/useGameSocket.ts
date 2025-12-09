/**
 * useGameSocket Hook
 * 统一管理游戏房间内的所有 Socket 事件监听和处理
 */

import { useEffect, useCallback, useRef } from 'react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { globalSocket } from '@/services/socket'
import {
  updatePlayers,
  updatePlayerStatus,
  startGame,
  setLandlord,
  setCurrentPlayer,
  endGame,
  setLastPlayedFromState,
  playCards as playCardsAction,
  pass as passAction,
} from '@/store/slices/gameSlice'
import { soundManager } from '@/utils/sound'
import type { SocketEventData } from '@/types/game'
import type { Socket } from 'socket.io-client'

interface UseGameSocketProps {
  roomId: string | undefined
  userId: string | undefined
  userName: string | undefined
  // 状态更新回调
  onChatMessage: (sender: string, message: string) => void
  onBiddingStart: (data: any) => void
  onBidResult: (data: any) => void
  onLandlordDetermined: (data: any) => void
  onTurnToPlay: (data: any) => void
  onTurnChanged: (data: any) => void
  onCardsPlayed: (data: any) => void
  onPlayerPassed: (data: any) => void
  onGameOver: (data: any) => void
  onDealCardsAll: (data: any) => void
  onGameStateRestored: (data: any) => void
  onPlayCardsFailed: (data: { error?: string }) => void
  // 连接状态回调
  onConnected?: () => void
  onDisconnected?: () => void
}

export function useGameSocket(props: UseGameSocketProps) {
  const {
    roomId,
    userId,
    userName,
    onChatMessage,
    onBiddingStart,
    onBidResult,
    onLandlordDetermined,
    onTurnToPlay,
    onTurnChanged,
    onCardsPlayed,
    onPlayerPassed,
    onGameOver,
    onDealCardsAll,
    onGameStateRestored,
    onPlayCardsFailed,
    onConnected,
    onDisconnected,
  } = props

  const dispatch = useAppDispatch()
  const socket = globalSocket.getSocket() as Socket
  
  const joinAttemptedRef = useRef(false)

  // ==================== 连接管理 ====================
  
  const handleConnect = useCallback(() => {
    console.log('[Socket] 连接成功')
    onConnected?.()
    
    if (roomId && userId && !joinAttemptedRef.current) {
      console.log(`[Socket] 自动重新加入房间: ${roomId}`)
      socket?.emit('join_game', { roomId, userId, userName })
      joinAttemptedRef.current = true
    }
  }, [roomId, userId, userName, socket, onConnected])

  const handleDisconnect = useCallback(() => {
    console.log('[Socket] 连接断开')
    onDisconnected?.()
  }, [onDisconnected])

  // ==================== 房间事件处理 ====================
  
  const handleRoomJoined = useCallback((data: SocketEventData['room_joined']) => {
    console.log('[Room] 成功加入房间:', data)
    dispatch(updatePlayers(data.players as any))
    soundManager.playSound('joinRoom')
  }, [dispatch])

  const handleJoinGameSuccess = useCallback((data: any) => {
    console.log('[Room] join_game_success:', data)
    if (data.players) {
      dispatch(updatePlayers(data.players as any))
    }
  }, [dispatch])

  const handlePlayerJoined = useCallback((data: SocketEventData['player_joined']) => {
    console.log('[Room] 玩家加入:', data.player)
    // 在 Redux 中添加新玩家
    dispatch(updatePlayers([data.player] as any))
    onChatMessage('系统', `${data.player.name} 加入了房间`)
    soundManager.playSound('deal')
  }, [dispatch, onChatMessage])

  const handlePlayerLeft = useCallback((data: SocketEventData['player_left']) => {
    console.log('[Room] 玩家离开:', data)
    onChatMessage('系统', `${data.playerName} 离开了房间`)
  }, [onChatMessage])

  const handlePlayerReady = useCallback((data: SocketEventData['player_ready']) => {
    console.log('[Room] 玩家准备状态变更:', data)
    dispatch(updatePlayerStatus({ playerId: data.playerId, isReady: data.ready }))
  }, [dispatch])

  // ==================== 游戏流程事件处理 ====================
  
  const handleGameStarted = useCallback((data: SocketEventData['game_started']) => {
    console.log('[Game] 游戏开始:', data)
    dispatch(startGame(data.players as any))
    soundManager.stopBackgroundMusic()
    soundManager.playSound('deal') // 游戏开始音效
    onChatMessage('系统', '游戏开始！')
  }, [dispatch, onChatMessage])

  const handleGameStateUpdated = useCallback((data: any) => {
    console.log('[Game] 游戏状态更新:', data)
    // 这里可以根据需要更新 Redux 状态
  }, [])

  // ==================== 出牌事件处理 ====================
  
  const handleTurnToPlayWrapper = useCallback((data: SocketEventData['turn_to_play']) => {
    console.log('[Turn] 轮到玩家出牌:', data)
    dispatch(setCurrentPlayer(data.playerId))
    onTurnToPlay(data)
  }, [dispatch, onTurnToPlay])

  const handleTurnChangedWrapper = useCallback((data: any) => {
    console.log('[Turn] 回合变更:', data)
    onTurnChanged(data)
  }, [onTurnChanged])

  const handleCardsPlayedWrapper = useCallback((data: SocketEventData['cards_played']) => {
    console.log('[Cards] 玩家出牌:', data)
    
    // 更新 Redux：从玩家手牌中移除已出的牌
    dispatch(playCardsAction({
      playerId: data.playerId,
      playerName: data.playerName,
      cards: data.cards,
    }))
    
    // 更新最后出牌记录
    if (data.cardType) {
      dispatch(setLastPlayedFromState({
        playerId: data.playerId,
        playerName: data.playerName,
        cards: data.cards,
      }))
    }
    
    onCardsPlayed(data)
    
    // 播放出牌音效（根据牌型）
    soundManager.playCardTypeSound(data.cardType)
  }, [dispatch, onCardsPlayed])

  const handlePlayerPassedWrapper = useCallback((data: SocketEventData['player_passed']) => {
    console.log('[Cards] 玩家不出:', data)
    dispatch(passAction(data.playerId))
    onPlayerPassed(data)
    soundManager.playSound('pass')
  }, [dispatch, onPlayerPassed])

  // ==================== 抢地主事件处理 ====================
  
  const handleBiddingStartWrapper = useCallback((data: any) => {
    console.log('[Bidding] 抢地主开始:', data)
    onBiddingStart(data)
    soundManager.playSound('bid')
  }, [onBiddingStart])

  const handleBidResultWrapper = useCallback((data: any) => {
    console.log('[Bidding] 抢地主结果:', data)
    onBidResult(data)
    soundManager.playSound('bid') // 统一使用抢地主音效
  }, [onBidResult])

  const handleLandlordDeterminedWrapper = useCallback((data: SocketEventData['landlord_determined']) => {
    console.log('[Bidding] 地主确定:', data)
    dispatch(setLandlord({
      landlordId: data.landlordId,
      landlordCards: data.bottomCards,
    }))
    onLandlordDetermined(data)
    soundManager.playSound('bid') // 地主确定音效
  }, [dispatch, onLandlordDetermined])

  // ==================== 发牌事件处理 ====================
  
  const handleDealCardsAllWrapper = useCallback((data: SocketEventData['deal_cards_all']) => {
    console.log('[Deal] 发牌完成:', data)
    onDealCardsAll(data)
  }, [onDealCardsAll])

  // ==================== 游戏结束事件处理 ====================
  
  const handleGameEndedWrapper = useCallback((data: SocketEventData['game_over']) => {
    console.log('[Game] 游戏结束:', data)
    dispatch(endGame(data as any))
    onGameOver(data)
  }, [dispatch, onGameOver])

  // ==================== 断线重连事件处理 ====================
  
  const handleGameStateRestoredWrapper = useCallback((data: any) => {
    console.log('[Reconnect] 游戏状态恢复:', data)
    onGameStateRestored(data)
  }, [onGameStateRestored])

  // ==================== 聊天事件处理 ====================
  
  const handleChatMessage = useCallback((data: { sender: string; message: string }) => {
    console.log('[Chat] 收到消息:', data)
    onChatMessage(data.sender, data.message)
  }, [onChatMessage])

  // ==================== 错误处理 ====================
  
  const handlePlayCardsFailedWrapper = useCallback((data: { error?: string }) => {
    console.log('[Error] 出牌失败:', data)
    onPlayCardsFailed(data)
  }, [onPlayCardsFailed])

  const handleError = useCallback((data: { message: string }) => {
    console.error('[Socket Error]:', data.message)
    onChatMessage('系统', `错误: ${data.message}`)
  }, [onChatMessage])

  // ==================== 事件注册和清理 ====================
  
  useEffect(() => {
    if (!socket || !roomId) return

    console.log(`[Socket] 注册游戏房间事件监听，房间ID: ${roomId}`)

    // 连接管理
    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // 房间事件
    socket.on('room_joined', handleRoomJoined)
    socket.on('join_game_success', handleJoinGameSuccess)
    socket.on('player_joined', handlePlayerJoined)
    socket.on('player_left', handlePlayerLeft)
    socket.on('player_ready', handlePlayerReady)

    // 游戏流程
    socket.on('game_started', handleGameStarted)
    socket.on('game_state_updated', handleGameStateUpdated)
    socket.on('game_state_restored', handleGameStateRestoredWrapper)

    // 抢地主
    socket.on('bidding_start', handleBiddingStartWrapper)
    socket.on('bid_result', handleBidResultWrapper)
    socket.on('landlord_determined', handleLandlordDeterminedWrapper)

    // 发牌
    socket.on('deal_cards_all', handleDealCardsAllWrapper)

    // 出牌
    socket.on('turn_to_play', handleTurnToPlayWrapper)
    socket.on('turn_changed', handleTurnChangedWrapper)
    socket.on('cards_played', handleCardsPlayedWrapper)
    socket.on('player_passed', handlePlayerPassedWrapper)

    // 游戏结束
    socket.on('game_over', handleGameEndedWrapper)
    socket.on('game_ended', handleGameEndedWrapper)

    // 聊天
    socket.on('message_received', handleChatMessage)

    // 错误处理
    socket.on('play_cards_failed', handlePlayCardsFailedWrapper)
    socket.on('error', handleError)

    // 如果 Socket 已连接，立即尝试加入房间
    if (socket?.connected && !joinAttemptedRef.current) {
      console.log(`[Socket] 已连接，立即加入房间: ${roomId}`)
      socket.emit('join_game', { roomId, userId, userName })
      joinAttemptedRef.current = true
    }

    // 清理函数
    return () => {
      console.log('[Socket] 清理游戏房间事件监听')
      
      if (!socket) return
      
      socket.off('connect', handleConnect)
      socket.off('reconnect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      
      socket.off('room_joined', handleRoomJoined)
      socket.off('join_game_success', handleJoinGameSuccess)
      socket.off('player_joined', handlePlayerJoined)
      socket.off('player_left', handlePlayerLeft)
      socket.off('player_ready', handlePlayerReady)
      
      socket.off('game_started', handleGameStarted)
      socket.off('game_state_updated', handleGameStateUpdated)
      socket.off('game_state_restored', handleGameStateRestoredWrapper)
      
      socket.off('bidding_start', handleBiddingStartWrapper)
      socket.off('bid_result', handleBidResultWrapper)
      socket.off('landlord_determined', handleLandlordDeterminedWrapper)
      
      socket.off('deal_cards_all', handleDealCardsAllWrapper)
      
      socket.off('turn_to_play', handleTurnToPlayWrapper)
      socket.off('turn_changed', handleTurnChangedWrapper)
      socket.off('cards_played', handleCardsPlayedWrapper)
      socket.off('player_passed', handlePlayerPassedWrapper)
      
      socket.off('game_over', handleGameEndedWrapper)
      socket.off('game_ended', handleGameEndedWrapper)
      
      socket.off('message_received', handleChatMessage)
      
      socket.off('play_cards_failed', handlePlayCardsFailedWrapper)
      socket.off('error', handleError)
    }
  }, [
    socket,
    roomId,
    userId,
    userName,
    handleConnect,
    handleDisconnect,
    handleRoomJoined,
    handleJoinGameSuccess,
    handlePlayerJoined,
    handlePlayerLeft,
    handlePlayerReady,
    handleGameStarted,
    handleGameStateUpdated,
    handleGameStateRestoredWrapper,
    handleBiddingStartWrapper,
    handleBidResultWrapper,
    handleLandlordDeterminedWrapper,
    handleDealCardsAllWrapper,
    handleTurnToPlayWrapper,
    handleTurnChangedWrapper,
    handleCardsPlayedWrapper,
    handlePlayerPassedWrapper,
    handleGameEndedWrapper,
    handleChatMessage,
    handlePlayCardsFailedWrapper,
    handleError,
  ])

  // 提供给外部的方法：发送 Socket 事件
  const emitReady = useCallback(() => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 发送准备信号')
    socket.emit('player_ready', { roomId, userId })
  }, [roomId, userId])

  const emitUnready = useCallback(() => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 取消准备')
    socket.emit('player_unready', { roomId, userId })
  }, [roomId, userId])

  const emitLeaveRoom = useCallback(() => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 离开房间')
    socket.emit('leave_game', { roomId, userId })
  }, [roomId, userId])

  const emitPlayCards = useCallback((cards: string[]) => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 发送出牌:', cards)
    socket.emit('play_cards', { roomId, userId, cards })
  }, [roomId, userId])

  const emitPass = useCallback(() => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 发送不出')
    socket.emit('pass', { roomId, userId })
  }, [roomId, userId])

  const emitBid = useCallback((bid: boolean) => {
    if (!socket || !roomId || !userId) return
    console.log('[Socket] 发送抢地主:', bid)
    socket.emit('bid', { roomId, userId, bid })
  }, [roomId, userId])

  const emitChatMessage = useCallback((message: string) => {
    if (!socket || !roomId || !userId || !userName) return
    console.log('[Socket] 发送聊天消息:', message)
    socket.emit('send_message', { roomId, sender: userName, message })
  }, [roomId, userId, userName])

  return {
    // Socket 状态
    isConnected: socket?.connected || false,
    
    // Socket 操作方法
    emitReady,
    emitUnready,
    emitLeaveRoom,
    emitPlayCards,
    emitPass,
    emitBid,
    emitChatMessage,
  }
}
