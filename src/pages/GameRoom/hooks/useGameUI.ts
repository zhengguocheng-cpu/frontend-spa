/**
 * useGameUI Hook
 * 统一管理游戏房间的 UI 状态（聊天、结算、动画等）
 */

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@/types/game'

export function useGameUI() {
  // ==================== 聊天相关 ====================
  const [chatVisible, setChatVisible] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const toggleChat = useCallback(() => {
    setChatVisible((prev) => !prev)
  }, [])

  const openChat = useCallback(() => {
    setChatVisible(true)
  }, [])

  const closeChat = useCallback(() => {
    setChatVisible(false)
  }, [])

  const updateChatInput = useCallback((message: string) => {
    setChatMessage(message)
  }, [])

  const clearChatInput = useCallback(() => {
    setChatMessage('')
  }, [])

  const addChatMessage = useCallback((sender: string, message: string) => {
    setChatMessages((prev) => [
      ...prev,
      { sender, message, timestamp: Date.now() }
    ])
  }, [])

  const clearChatMessages = useCallback(() => {
    setChatMessages([])
  }, [])

  // ==================== 结算界面 ====================
  const [showSettlement, setShowSettlement] = useState(false)

  const openSettlement = useCallback(() => {
    console.log('[UI] 显示结算界面')
    setShowSettlement(true)
  }, [])

  const closeSettlement = useCallback(() => {
    console.log('[UI] 关闭结算界面')
    setShowSettlement(false)
  }, [])

  // ==================== 抢地主 UI ====================
  const [showBiddingUI, setShowBiddingUI] = useState(false)

  const openBiddingUI = useCallback(() => {
    console.log('[UI] 显示抢地主界面')
    setShowBiddingUI(true)
  }, [])

  const closeBiddingUI = useCallback(() => {
    console.log('[UI] 关闭抢地主界面')
    setShowBiddingUI(false)
  }, [])

  // ==================== 动画状态 ====================
  const [isDealingAnimation, setIsDealingAnimation] = useState(false)
  const [playPending, setPlayPending] = useState(false)

  const startDealingAnimation = useCallback(() => {
    console.log('[UI] 开始发牌动画')
    setIsDealingAnimation(true)
  }, [])

  const stopDealingAnimation = useCallback(() => {
    console.log('[UI] 停止发牌动画')
    setIsDealingAnimation(false)
  }, [])

  const setPlayPendingState = useCallback((pending: boolean) => {
    setPlayPending(pending)
  }, [])

  // ==================== 拖拽选牌状态 ====================
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const [dragSelectMode, setDragSelectMode] = useState<'select' | 'deselect' | null>(null)

  const startDragSelect = useCallback((mode: 'select' | 'deselect') => {
    setIsDragSelecting(true)
    setDragSelectMode(mode)
  }, [])

  const stopDragSelect = useCallback(() => {
    setIsDragSelecting(false)
    setDragSelectMode(null)
  }, [])

  // ==================== 玩家不出状态 ====================
  const [passedPlayers, setPassedPlayers] = useState<{ [playerId: string]: boolean }>({})

  const markPlayerPassed = useCallback((playerId: string) => {
    setPassedPlayers((prev) => ({
      ...prev,
      [playerId]: true
    }))
  }, [])

  const clearPlayerPassed = useCallback((playerId: string) => {
    setPassedPlayers((prev) => {
      const updated = { ...prev }
      delete updated[playerId]
      return updated
    })
  }, [])

  const clearAllPassedPlayers = useCallback(() => {
    setPassedPlayers({})
  }, [])

  // ==================== 回合状态 ====================
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [canPass, setCanPass] = useState(false)

  const setTurnState = useCallback((myTurn: boolean, canPassTurn: boolean) => {
    setIsMyTurn(myTurn)
    setCanPass(canPassTurn)
  }, [])

  // ==================== 重置所有 UI 状态 ====================
  const resetAllUI = useCallback(() => {
    console.log('[UI] 重置所有 UI 状态')
    closeChat()
    clearChatInput()
    closeSettlement()
    closeBiddingUI()
    stopDealingAnimation()
    setPlayPending(false)
    stopDragSelect()
    clearAllPassedPlayers()
    setIsMyTurn(false)
    setCanPass(false)
  }, [
    closeChat,
    clearChatInput,
    closeSettlement,
    closeBiddingUI,
    stopDealingAnimation,
    stopDragSelect,
    clearAllPassedPlayers,
  ])

  return {
    // 聊天
    chatVisible,
    chatMessage,
    chatMessages,
    toggleChat,
    openChat,
    closeChat,
    updateChatInput,
    clearChatInput,
    addChatMessage,
    clearChatMessages,
    
    // 结算
    showSettlement,
    openSettlement,
    closeSettlement,
    
    // 抢地主
    showBiddingUI,
    openBiddingUI,
    closeBiddingUI,
    
    // 动画
    isDealingAnimation,
    startDealingAnimation,
    stopDealingAnimation,
    playPending,
    setPlayPending: setPlayPendingState,
    
    // 拖拽选牌
    isDragSelecting,
    dragSelectMode,
    startDragSelect,
    stopDragSelect,
    
    // 不出状态
    passedPlayers,
    markPlayerPassed,
    clearPlayerPassed,
    clearAllPassedPlayers,
    
    // 回合状态
    isMyTurn,
    canPass,
    setTurnState,
    
    // 工具方法
    resetAllUI,
  }
}
