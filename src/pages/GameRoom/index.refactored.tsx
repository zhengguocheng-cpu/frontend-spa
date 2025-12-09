/**
 * GameRoom - 游戏房间页面（重构版）
 * 使用新的 Hooks 和组件，大幅简化代码
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from 'antd-mobile'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { useSocketStatus } from '@/hooks/useSocketStatus'
import { globalSocket } from '@/services/socket'
import type { RootState } from '@/store'
import {
  initGame,
  updatePlayers,
  toggleCardSelection,
  clearSelection,
  resetGame,
  prepareNextGame,
  type SettlementPlayerScore,
} from '@/store/slices/gameSlice'
import { CardHintHelper } from '@/utils/cardHintHelper'
import { soundManager } from '@/utils/sound'
import { getLlmSettings } from '@/utils/llmSettings'
import { getGameSettings } from '@/utils/gameSettings'

// 导入新的 Hooks
import { useGameSocket, useGameTimer, useGameUI } from './hooks'

// 导入新的组件
import { ChatPanel } from '@/shared/components'
import { BiddingControls } from '@/games/doudizhu/components'

import '@/styles/avatars.css'
import './style.css'
import './game.css'
import './ai-panel.css'

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const { connected } = useSocketStatus()

  // Redux state
  const gameState = useAppSelector((state: RootState) => state.game) as any
  const {
    players = [],
    gameStatus = 'waiting',
    currentPlayerId = null,
    myCards = [],
    selectedCards = [],
    lastPlayedCards = null,
    landlordCards = [],
    landlordId = null,
  } = gameState

  // ==================== 使用新的 Hooks ====================
  
  // UI 状态管理
  const gameUI = useGameUI()
  const {
    // 聊天
    chatVisible,
    chatMessage,
    chatMessages,
    toggleChat,
    updateChatInput,
    clearChatInput,
    addChatMessage,
    
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
    setPlayPending,
    
    // 拖拽选牌
    isDragSelecting,
    dragSelectMode,
    startDragSelect,
    stopDragSelect,
    
    // 不出状态
    passedPlayers,
    markPlayerPassed,
    clearAllPassedPlayers,
    
    // 回合状态
    isMyTurn,
    canPass,
    setTurnState,
  } = gameUI

  // 定时器管理
  const gameTimer = useGameTimer()
  const {
    // 抢地主定时器
    biddingTimer,
    startBiddingTimer,
    stopBiddingTimer,
    
    // 出牌定时器
    turnTimer,
    startTurnTimer,
    stopTurnTimer,
    resetTurnTimer,
    
    // 自动重玩定时器
    autoReplayCountdown,
    startAutoReplayTimer,
    stopAutoReplayTimer,
    
    // 清理所有定时器
    clearAllTimers,
  } = gameTimer

  // ==================== Socket 事件处理回调 ====================
  
  const handleChatMessage = (sender: string, message: string) => {
    addChatMessage(sender, message)
  }

  const handleBiddingStart = (data: any) => {
    console.log('[Bidding] 抢地主开始:', data)
    openBiddingUI()
    startBiddingTimer(10)
    
    const isMe = data.currentBidderId === (user?.id || user?.name)
    if (isMe) {
      addChatMessage('系统', '轮到你抢地主了')
      soundManager.playTurnStart()
    }
  }

  const handleBidResult = (data: any) => {
    console.log('[Bidding] 抢地主结果:', data)
    const bidText = data.bid ? '抢地主' : '不抢'
    addChatMessage('系统', `${data.userName || '玩家'} ${bidText}`)
    
    if (data.bid) {
      soundManager.playBid()
    }
  }

  const handleLandlordDetermined = (data: any) => {
    console.log('[Bidding] 地主确定:', data)
    closeBiddingUI()
    stopBiddingTimer()
    addChatMessage('系统', `${data.landlordName || '玩家'} 成为地主`)
    soundManager.playSound('bid')
  }

  const handleTurnToPlay = (data: any) => {
    console.log('[Turn] 轮到玩家出牌:', data)
    const isMe = data.playerId === (user?.id || user?.name)
    
    setTurnState(isMe, !data.isFirstPlay)
    
    if (isMe) {
      startTurnTimer(30)
      addChatMessage('系统', '轮到你出牌了')
      soundManager.playTurnStart()
    } else {
      stopTurnTimer()
      addChatMessage('系统', `轮到 ${data.playerName || '玩家'} 出牌...`)
    }
    
    // 清除不出标记（新回合开始）
    clearAllPassedPlayers()
  }

  const handleTurnChanged = (data: any) => {
    console.log('[Turn] 回合变更:', data)
  }

  const handleCardsPlayed = (data: any) => {
    console.log('[Cards] 玩家出牌:', data)
    
    const isMe = data.playerId === (user?.id || user?.name)
    if (!isMe && data.cardType) {
      const cardTypeDesc = data.cardType.description || ''
      if (cardTypeDesc) {
        addChatMessage('系统', `${data.playerName} 打出 ${cardTypeDesc}`)
      }
    }
  }

  const handlePlayerPassed = (data: any) => {
    console.log('[Cards] 玩家不出:', data)
    markPlayerPassed(data.playerId)
    addChatMessage('系统', `${data.playerName || '玩家'} 选择不出`)
    soundManager.playPass()
  }

  const handleGameOver = (data: any) => {
    console.log('[Game] 游戏结束:', data)
    stopTurnTimer()
    setTurnState(false, false)
    openSettlement()
    
    const myId = user?.id || user?.name
    const isWinner = !!myId && (data.winnerId === myId || data.winnerName === user?.name)
    
    if (isWinner) {
      soundManager.playWin()
      soundManager.stopBackgroundMusic()
      soundManager.playVictoryMusic()
    } else {
      soundManager.playLose()
    }
    
    const winnerName = data.winnerName || '玩家'
    const role = data.winnerRole === 'landlord' ? '地主' : '农民'
    addChatMessage('系统', `本局结束：${winnerName}（${role}）获胜`)
  }

  const handleDealCardsAll = (data: any) => {
    console.log('[Deal] 发牌完成:', data)
    addChatMessage('系统', '发牌完成，进入抢地主阶段')
  }

  const handleGameStateRestored = (data: any) => {
    console.log('[Reconnect] 游戏状态恢复:', data)
    addChatMessage('系统', '已重新连接，游戏状态已恢复')
  }

  const handlePlayCardsFailed = (data: { error?: string }) => {
    console.log('[Error] 出牌失败:', data)
    addChatMessage('系统', `出牌失败: ${data.error || '未知错误'}`)
  }

  // Socket Hook
  const socket = useGameSocket({
    roomId,
    userId: user?.id,
    userName: user?.name,
    onChatMessage: handleChatMessage,
    onBiddingStart: handleBiddingStart,
    onBidResult: handleBidResult,
    onLandlordDetermined: handleLandlordDetermined,
    onTurnToPlay: handleTurnToPlay,
    onTurnChanged: handleTurnChanged,
    onCardsPlayed: handleCardsPlayed,
    onPlayerPassed: handlePlayerPassed,
    onGameOver: handleGameOver,
    onDealCardsAll: handleDealCardsAll,
    onGameStateRestored: handleGameStateRestored,
    onPlayCardsFailed: handlePlayCardsFailed,
  })

  // ==================== 本地状态和引用 ====================
  
  const [walletScore, setWalletScore] = useState<number | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiHints, setAiHints] = useState<string[][]>([])
  const autoReadySentRef = useRef(false)
  const playPendingRef = useRef(false)
  const hintContextRef = useRef<{ myCards: string[]; lastCards: string[] | null } | null>(null)
  const autoFullHandPlayedRef = useRef(false)
  const autoFollowHintAppliedRef = useRef(false)

  // ==================== 玩家位置计算 ====================
  
  const getPlayerPositions = () => {
    if (!user) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    const filteredPlayers = Array.isArray(players)
      ? players.filter((p: any) => p && (p.id || p.name))
      : []

    if (filteredPlayers.length === 0) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    const myIndex = filteredPlayers.findIndex(
      (p: any) => p.id === user.id || p.name === user.name
    )

    if (myIndex === -1) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    const currentPlayer = filteredPlayers[myIndex]
    const leftPlayer = filteredPlayers.length >= 2
      ? filteredPlayers[(myIndex - 1 + filteredPlayers.length) % filteredPlayers.length]
      : null
    const rightPlayer = filteredPlayers.length >= 3
      ? filteredPlayers[(myIndex + 1) % filteredPlayers.length]
      : null

    return { leftPlayer, rightPlayer, currentPlayer }
  }

  const { leftPlayer, rightPlayer, currentPlayer } = getPlayerPositions()

  // ==================== 游戏操作函数 ====================
  
  const handleReady = () => {
    socket.emitReady()
  }

  const handleLeaveRoom = () => {
    socket.emitLeaveRoom()
    clearAllTimers()
    dispatch(resetGame())
    navigate('/lobby')
  }

  const handleBid = (bid: boolean) => {
    socket.emitBid(bid)
    closeBiddingUI()
    stopBiddingTimer()
  }

  const handlePlayCards = () => {
    if (selectedCards.length === 0) {
      addChatMessage('系统', '请先选择要出的牌')
      return
    }
    
    setPlayPending(true)
    playPendingRef.current = true
    socket.emitPlayCards(selectedCards)
    dispatch(clearSelection())
    
    setTimeout(() => {
      setPlayPending(false)
      playPendingRef.current = false
    }, 500)
  }

  const handlePass = () => {
    socket.emitPass()
    setTurnState(false, false)
    stopTurnTimer()
  }

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      socket.emitChatMessage(chatMessage)
      clearChatInput()
    }
  }

  // ==================== 初始化和清理 ====================
  
  useEffect(() => {
    if (!roomId || !user) {
      navigate('/lobby')
      return
    }

    dispatch(initGame())
    
    return () => {
      clearAllTimers()
    }
  }, [roomId, user, navigate, dispatch, clearAllTimers])

  // ==================== 渲染 ====================
  
  return (
    <div className="game-room-container">
      {/* 聊天面板 */}
      <ChatPanel
        visible={chatVisible}
        messages={chatMessages}
        currentMessage={chatMessage}
        onClose={toggleChat}
        onMessageChange={updateChatInput}
        onSend={handleSendChat}
      />

      {/* 主游戏区 */}
      <div className="game-main-area">
        {/* 顶部玩家区域 */}
        <div className="top-players">
          {/* TODO: 使用 PlayerArea 组件 */}
          <div>左侧玩家</div>
          <div>右侧玩家</div>
        </div>

        {/* 中间游戏区域 */}
        <div className="center-area">
          {/* 抢地主 UI */}
          {gameStatus === 'bidding' && (
            <BiddingControls
              visible={showBiddingUI}
              timer={biddingTimer}
              onBid={handleBid}
            />
          )}

          {/* 结算界面 */}
          {showSettlement && (
            <div className="settlement-overlay">
              <h2>游戏结束</h2>
              <Button onClick={() => {
                closeSettlement()
                handleReady()
              }}>再来一局</Button>
              <Button onClick={handleLeaveRoom}>返回大厅</Button>
            </div>
          )}
        </div>

        {/* 底部手牌区域 */}
        <div className="bottom-player-area">
          {/* TODO: 手牌显示和操作按钮 */}
          <div>手牌区域</div>
        </div>
      </div>

      {/* 聊天按钮 */}
      <button className="chat-toggle-btn" onClick={toggleChat}>
        💬
      </button>
    </div>
  )
}
