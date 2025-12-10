import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { useSocketStatus } from '@/hooks/useSocketStatus'
import { globalSocket } from '@/services/socket'
import type { RootState } from '@/store'
import {
  initGame,
  updatePlayers,
  updatePlayerStatus,
  startGame,
  toggleCardSelection,
  playCards as playCardsAction,
  endGame,
  resetGame,
  setLandlord,
  setCurrentPlayer,
  pass as passAction,
  prepareNextGame,
  clearSelection,
  setLastPlayedFromState,
  type SettlementPlayerScore,
} from '@/store/slices/gameSlice'
import { CardHintHelper } from '@/utils/cardHintHelper'
import { soundManager } from '@/utils/sound'
import { getLlmSettings } from '@/utils/llmSettings'
import { getGameSettings } from '@/utils/gameSettings'

// 导入新的 Hooks
import { useGameUI, useGameTimer } from './hooks'
import { useWalletScore } from './hooks/useWalletScore'

// 导入helper函数
import { parseCard } from './logic/helpers'
import { getPlayVoiceText } from './logic/voiceHelper'
import { getPlayerPositions, isLandlordPlayer, getAvatarClassName, getRemainingCardsForPlayer } from './logic/playerHelper'

// 导入设计模式
import { PlayCardsCommand, PassCommand, BidCommand, CommandManager } from './patterns'
import { AutoPlayStrategyManager, type AutoPlayContext } from './patterns'

// 导入游戏特定组件
import { BiddingControls } from '@/games/doudizhu/components'

// 导入 GameRoom 子组件
import { 
  GameActions, 
  BottomCards, 
  HandCards,
  CenterResultPanel,
  TopPlayersArea,
  BottomPlayerInfo,
  BottomPlayedCards,
  ChatContainer,
} from './components'

import '@/styles/avatars.css'
import './style.css'
import './game.css'

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const dispatch = useAppDispatch()

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

  const { connected } = useSocketStatus()
  const gameUI = useGameUI()
  const {
    // 聊天相关
    chatVisible,
    chatMessage,
    chatMessages,
    toggleChat,
    updateChatInput,
    clearChatInput,
    addChatMessage,
    
    // 抢地主
    showBiddingUI,
    openBiddingUI,
    closeBiddingUI,
    
    // 动画和交互
    isDealingAnimation,
    startDealingAnimation,
    stopDealingAnimation,
    playPending,
    setPlayPending,
    isDragSelecting,
    dragSelectMode,
    startDragSelect,
    stopDragSelect,
    
    // 不出标记
    passedPlayers,
    markPlayerPassed,
    clearAllPassedPlayers,
    
    // 回合状态
    isMyTurn,
    canPass,
    setTurnState,
  } = gameUI

  const gameTimer = useGameTimer()
  const {
    biddingTimer,
    startBiddingTimer,
    stopBiddingTimer,
    turnTimer,
    startTurnTimer,
    stopTurnTimer,
  } = gameTimer
  const dealAnimationTimeoutRef = useRef<number | null>(null)
  const playPendingRef = useRef(false)
  const autoReadySentRef = useRef(false)
  const autoReadyTimerRef = useRef<number | null>(null)
  const settlementAutoLeaveRef = useRef<number | null>(null)
  const [autoReplayCountdown, setAutoReplayCountdown] = useState<number | null>(null)
  const autoReplayTimerRef = useRef<number | null>(null)
  const quickFlowRef = useRef<{
    roomJoinedAt: number | null
    gameStartedAt: number | null
    dealCardsAt: number | null
    biddingStartAt: number | null
  }>({
    roomJoinedAt: null,
    gameStartedAt: null,
    dealCardsAt: null,
    biddingStartAt: null,
  })
  // AI 提示上下文缓存（用于服务端失败时本地兜底）
  const hintContextRef = useRef<{ myCards: string[]; lastCards: string[] | null } | null>(null)
  const autoFullHandPlayedRef = useRef(false)
  const autoFollowHintAppliedRef = useRef(false)
  // 当前局中的炸弹 / 火箭数量统计
  const [currentBombCount, setCurrentBombCount] = useState(0)
  const [currentRocketCount, setCurrentRocketCount] = useState(0)
  // 是否隐藏底牌展示（例如出完牌后收起底牌）
  const [hideBottomCards, setHideBottomCards] = useState(false)
  
  // AI面板已移除，提示信息直接输出到聊天
  
  // 命令管理器（命令模式）
  const commandManager = useRef(new CommandManager())
  
  // 自动出牌策略管理器（策略模式）
  const autoPlayManager = useRef(new AutoPlayStrategyManager())

  const appendSystemMessage = (text: string) => {
    if (!text) return
    addChatMessage('系统', text)
  }

  // DEBUG函数已移除，生产环境不需要

  const { leftPlayer, rightPlayer, currentPlayer } = getPlayerPositions(players, user)

  // 使用钱包积分hook
  const { walletScore, setWalletScore, refreshWalletScore } = useWalletScore(user, leftPlayer, rightPlayer, players)

  const currentUserId = user?.id || user?.name
  const isLeftTurn =
    !!currentPlayerId &&
    !!leftPlayer &&
    (leftPlayer.id === currentPlayerId || leftPlayer.name === currentPlayerId)
  const isRightTurn =
    !!currentPlayerId &&
    !!rightPlayer &&
    (rightPlayer.id === currentPlayerId || rightPlayer.name === currentPlayerId)
  const isBottomTurn =
    !!currentPlayerId &&
    (currentPlayer?.id === currentPlayerId ||
      currentPlayer?.name === currentPlayerId ||
      currentUserId === currentPlayerId)

  const settlementScore = useMemo(() => gameState.gameResult?.score, [gameState.gameResult])
  const settlementPlayerScores = settlementScore?.playerScores ?? []

  const remainingHandsMap = (gameState.gameResult as any)?.remainingHands as
    | {
        [playerId: string]: {
          playerId: string
          playerName: string
          cards: string[]
        }
      }
    | undefined


  const findPlayerScore = (player: any | null): SettlementPlayerScore | null => {
    if (!player || !settlementPlayerScores.length) return null
    const idsToMatch = [player.id, (player as any)?.userId, player.name].filter(Boolean)
    const found = settlementPlayerScores.find((ps: SettlementPlayerScore) =>
      idsToMatch.includes(ps.playerId),
    )
    return found || null
  }

  const leftPlayerScore = findPlayerScore(leftPlayer)
  const rightPlayerScore = findPlayerScore(rightPlayer)
  const bottomPlayerScore = findPlayerScore(currentPlayer)

  // 底部当前玩家金币显示：优先使用房间里的 player.score，缺失时回退到钱包余额
  const bottomCoinValue =
    (currentPlayer as any)?.score ?? walletScore ?? 0

  // 钱包积分管理已由useWalletScore hook接管


  const leftRemainingCards = getRemainingCardsForPlayer(leftPlayer, remainingHandsMap)
  const rightRemainingCards = getRemainingCardsForPlayer(rightPlayer, remainingHandsMap)
  const isBottomLandlord = isLandlordPlayer(currentPlayer, landlordId)

  const renderPlayerAvatar = (avatar: string | undefined) => {
    const avatarInfo = getAvatarClassName(avatar)
    if (avatarInfo.type === 'sprite') {
      return <div className={avatarInfo.value} />
    }
    return <span>{avatarInfo.value}</span>
  }


  // 初始化：进入房间时绑定 Socket，并记录最近房间
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    
    if (!roomId) return

    // 将最近进入的房间信息写入 sessionStorage，方便断线重连
    sessionStorage.setItem('lastRoomId', roomId)
    sessionStorage.setItem('lastRoomTime', Date.now().toString())

    const socket = globalSocket.getSocket()
    if (!socket) {
      navigate('/login', { replace: true })
      return
    }

    const gameSettings = getGameSettings()
    soundManager.setSoundEnabled(gameSettings.sfxEnabled)
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    }

    const handleConnect = () => {
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    const handleDisconnect = () => {}

    const handleHintResult = (data: any) => {

      const { success, cards, reason, analysis, winRate, error } = data || {}

      // 优先使用服务端提示
      if (success && Array.isArray(cards)) {
        if (cards.length > 0) {
          dispatch(clearSelection())
          ;(cards as string[]).forEach((card) => {
            dispatch(toggleCardSelection(card))
          })
          
          // 将AI提示信息输出到聊天消息框
          const hintMsg = `出牌: ${cards.join(', ')}`
          const detailMsg = []
          if (reason) detailMsg.push(`原因: ${reason}`)
          if (winRate) detailMsg.push(`胜率: ${(winRate * 100).toFixed(1)}%`)
          if (analysis) detailMsg.push(`分析: ${analysis}`)
          
          addChatMessage('AI助手', hintMsg)
          if (detailMsg.length > 0) {
            addChatMessage('AI助手', detailMsg.join(' | '))
          }
        } else {
          addChatMessage('AI助手', '建议不出')
        }

        return
      }

      // 服务端失败时，退回到本地 CardHintHelper 计算
      const ctx = hintContextRef.current
      const myCardsSnapshot = ctx?.myCards
      const lastCardsSnapshot = ctx?.lastCards ?? null

      if (error) {
        appendSystemMessage(`AI 提示失败：${String(error)}`)
      }

      if (!myCardsSnapshot || myCardsSnapshot.length === 0) return

      const fallbackHint = CardHintHelper.getHint(myCardsSnapshot, lastCardsSnapshot)
      if (!fallbackHint || fallbackHint.length === 0) return

      dispatch(clearSelection())
      fallbackHint.forEach((card) => {
        dispatch(toggleCardSelection(card))
      })
    }

    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('hint_result', handleHintResult)

    if (socket.connected) {
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    // 初始化前端 Redux 中的游戏状态，避免残留上一局数据
    dispatch(
      initGame({
        roomId,
        players: [],
      })
    )

    return () => {
      socket.off('connect', handleConnect)
      socket.off('reconnect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('hint_result', handleHintResult)
      soundManager.stopBackgroundMusic()
    }
  }, [user, roomId, dispatch])

  useEffect(() => {
    if (!user || !roomId) return

    // 快速匹配性能统计已移除
  }, [user, roomId])

  // 监听游戏相关的 Socket 事件
  useEffect(() => {
    if (!connected) return

    const socket = globalSocket.getSocket()
    if (!socket) return
    
    const mergePlayerData = (newPlayers: any[]) => {
      return newPlayers.map((p: any) => {
        const existingPlayer = players.find((ep: any) => ep.id === p.id || ep.name === p.name)
        return {
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          score: p.score !== undefined ? p.score : (existingPlayer?.score !== undefined ? existingPlayer.score : null)
        }
      })
    }

    const handleRoomJoined = () => {
      appendSystemMessage('已进入房间，等待其他玩家...')
      quickFlowRef.current.roomJoinedAt = Date.now()
    }

    const handleJoinGameSuccess = (data: any) => {
      dispatch(prepareNextGame())
      
      if (data.room && data.room.players) {
        const players = data.room.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0,
          score: p.score ?? p.totalScore ?? null, // 兼容不同字段，统一使用 score
        }))
        dispatch(initGame({
          roomId: data.room.id,
          players: players,
        }))
      } else if (data.players) {
        const players = data.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0,
          score: p.score ?? p.totalScore ?? null,
        }))
        dispatch(updatePlayers(players))
      }
    }

    const handleGameStateRestored = (data: any) => {
      appendSystemMessage('已恢复牌局状态，继续上一局')

      if (!data) return

      const phase = (data as any).phase as string | undefined
      const biddingState = (data as any).biddingState

      if (data.players && Array.isArray(data.players)) {
        const players = data.players.map((p: any) => {
          const cardCount = p.cardCount || p.cards?.length || 0
          return {
            ...p,
            id: p.id || p.userId || p.name,
            name: p.name || p.playerName,
            avatar: p.avatar || p.playerAvatar,
            isReady: true,
            cardCount,
            score:
              typeof p.score === 'number'
                ? p.score
                : typeof p.totalScore === 'number'
                  ? p.totalScore
                  : undefined,
          }
        })
        dispatch(updatePlayers(players))
      }

      const currentPlayerState = data.players?.find(
        (p: any) => p.id === user?.id || p.name === user?.name
      )
      if (currentPlayerState && Array.isArray(currentPlayerState.cards)) {
        dispatch(startGame({ myCards: currentPlayerState.cards }))
      }

      if (data.landlordId) {
        dispatch(
          setLandlord({
            landlordId: data.landlordId,
            landlordCards: data.bottomCards || [],
          })
        )
      }

      if (
        data.lastPlay &&
        data.lastPlay.playerId &&
        Array.isArray(data.lastPlay.cards)
      ) {
        const lastPlay = {
          playerId: data.lastPlay.playerId,
          playerName: data.lastPlay.playerName || data.lastPlay.playerId,
          cards: data.lastPlay.cards,
          type: data.lastPlay.type,
        }
        dispatch(setLastPlayedFromState(lastPlay))
      }
      if (phase === 'bidding' && biddingState && biddingState.currentBidderId) {
        const currentUserId = user?.id || user?.name
        const isMyBidTurn =
          !!currentUserId && biddingState.currentBidderId === currentUserId

        if (isMyBidTurn) {
          openBiddingUI()
          startBiddingTimer(15)
        } else {
          closeBiddingUI()
          stopBiddingTimer()
        }

        return
      }

      if ((!phase || phase === 'playing') && data.currentPlayerId) {
        const currentPlayerInfo = data.players?.find(
          (p: any) =>
            p.id === data.currentPlayerId || p.name === data.currentPlayerId
        )
        handleTurnToPlay({
          playerId: data.currentPlayerId,
          playerName: currentPlayerInfo?.name || data.currentPlayerId,
          isFirst: data.isNewRound,
          lastPattern: data.lastPlayedCards,
        })
      }

      if (data.players && Array.isArray(data.players)) {
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
        }))
        dispatch(updatePlayers(players))
      }
    }

    const handlePlayerJoined = (data: any) => {
      if (data.playerName && data.playerName !== user?.name) {
        addChatMessage('系统', `${data.playerName} 加入了房间`)
      }

      if (data.players && Array.isArray(data.players)) {
        dispatch(updatePlayers(mergePlayerData(data.players)))
      }
    }

    const handlePlayerLeft = (data: any) => {
      addChatMessage('系统', `${data.playerName || '玩家'} 离开了房间`)

      if (data.players && Array.isArray(data.players)) {
        dispatch(updatePlayers(mergePlayerData(data.players)))
      } else if (data.playerId) {
        const filtered = (players || []).filter((p: any) => p.id !== data.playerId && p.userId !== data.playerId)
        dispatch(updatePlayers(filtered))
      }
    }

    const handlePlayerReady = (data: any) => {
      if (data.playerName) {
        addChatMessage('系统', `${data.playerName} 已准备`)
      }
      
      if (data.players && Array.isArray(data.players)) {
        dispatch(updatePlayers(mergePlayerData(data.players)))
      } else if (data.playerId) {
        dispatch(updatePlayerStatus({ playerId: data.playerId, isReady: true }))
      }
    }

    const handleGameStarted = () => {
      quickFlowRef.current.gameStartedAt = Date.now()
      dispatch(prepareNextGame())
      setCurrentBombCount(0)
      setHideBottomCards(false)
      appendSystemMessage('游戏开始，准备抢地主')
    }

    const handleDealCardsAll = (data: any) => {
      quickFlowRef.current.dealCardsAt = Date.now()
      
      const myCards = data.players?.find((p: any) => 
        p.playerId === user?.id || p.playerId === user?.name
      )
      
      if (myCards && myCards.cards && myCards.cards.length > 0) {

        soundManager.playSound('deal')
        dispatch(startGame({ myCards: myCards.cards }))

        if (dealAnimationTimeoutRef.current) {
          clearTimeout(dealAnimationTimeoutRef.current)
        }
        startDealingAnimation()
        dealAnimationTimeoutRef.current = window.setTimeout(() => {
          stopDealingAnimation()
        }, Math.min(1500, myCards.cards.length * 120 + 500))
        
        if (data.players) {
          const playersWithInfo = data.players.map((p: any) => ({
            id: p.playerId || p.id,
            name: p.playerName || p.name,
            avatar: p.playerAvatar ?? p.avatar,
            isReady: p.playerReady ?? p.isReady ?? p.ready ?? true,
            position: p.position,
            cardCount: p.cardCount ?? p.cards?.length ?? 0,
            cards: p.cards ?? [],
            score: typeof p.score === 'number' ? p.score : undefined,
          }))
          dispatch(updatePlayers(playersWithInfo))
        }

        appendSystemMessage('发牌完成，进入抢地主阶段')
      }
    }

    const handleBiddingStart = (data: any) => {
      quickFlowRef.current.biddingStartAt = Date.now()
      addChatMessage('系统', `开始抢地主，先手玩家：${data.firstBidderName || '玩家'}`)
      
      const currentUserId = user?.id || user?.name
      const currentUserName = user?.name || user?.id
      const isMyTurn =
        (!!data.firstBidderId && data.firstBidderId === currentUserId) ||
        (!!data.firstBidderName && data.firstBidderName === currentUserName)

      if (isMyTurn) {
        openBiddingUI()
        startBiddingTimer(15)
      }
    }

    const handleBidResult = (data: any) => {
      const bidText = data.bid ? '抢地主' : '不抢'
      addChatMessage('系统', `${data.userName || '玩家'} ${bidText}`)
      
      closeBiddingUI()
      stopBiddingTimer()
      
      if (data.nextBidderId) {
        setTimeout(() => {
          const currentUserId = user?.id || user?.name
          if (data.nextBidderId === currentUserId) {
            openBiddingUI()
            // 启动 15 秒抢地主倒计时
            startBiddingTimer(15)
          }
        }, 1000)
      }
    }

    const handleLandlordDetermined = (data: any) => {
      if (data.landlordId) {
        closeBiddingUI()
        stopBiddingTimer()
        
        const isLandlord = data.landlordId === user?.id || 
                          data.landlordId === user?.name ||
                          data.landlordName === user?.name
        
        dispatch(setLandlord({
          landlordId: data.landlordId,
          landlordCards: data.bottomCards || [],
          landlordName: data.landlordName,
          landlordHand: data.landlordCards,
          landlordCardCount: data.landlordCardCount,
          isMe: isLandlord,
        }))
        
        addChatMessage('系统', `${data.landlordName || '玩家'} 成为地主`)
        
        if (isLandlord) {
          addChatMessage('系统', `地主获得底牌，共 ${data.bottomCards?.length || 3} 张`)
        }
      }
    }

    const handleGameStateUpdated = () => {
    }

    const handleTurnToPlay = (data: any) => {
      
      if (data.playerId) {
        dispatch(setCurrentPlayer(data.playerId))

        const isMe = data.playerId === (user?.id || user?.name)

        if (isMe) {
          playPendingRef.current = false
          setPlayPending(false)

          CardHintHelper.resetHintIndex()
          autoFullHandPlayedRef.current = false
          autoFollowHintAppliedRef.current = false
          
          const isFirst = data.isFirst
          const hasLastPattern = Boolean(data.lastPattern)
          const canPassNow = !isFirst && hasLastPattern
          
          setTurnState(true, canPassNow)
          
          addChatMessage('系统', '轮到你出牌了')
        } else {
          setTurnState(false, false)

          const otherName = data.playerName || '玩家'
          addChatMessage('系统', `轮到 ${otherName} 出牌...`)
        }

        const initialTime =
          typeof data.remainingTime === 'number' && data.remainingTime > 0
            ? data.remainingTime
            : 30
        startTurnTimer(initialTime)
      }
    }

    const handlePlayCardsFailed = (data: { error?: string }) => {
      playPendingRef.current = false
      setPlayPending(false)

      const message = data?.error || '出牌失败，请稍后重试'
      const lower = message.toLowerCase()
      const notYourTurn =
        message.includes('不是你的回合') ||
        lower.includes('not your turn')

      if (notYourTurn) {
        setTurnState(false, false)
      } else {
        setTurnState(true, canPass)
        setPlayPending(false)
      }

      appendSystemMessage(`出牌失败：${message}`)
    }

    const handleTurnChanged = (data: any) => {
      if (data.currentPlayerId) {
        dispatch(setCurrentPlayer(data.currentPlayerId))
      }
    }

    const handleCardsPlayed = (data: any) => {
      console.log('[DEBUG] handleCardsPlayed 被调用', data)

      if (!data.playerId || !data.cards) {
        console.warn('[DEBUG] handleCardsPlayed 数据不完整', data)
        return
      }

      // 播放对应牌型的出牌音效
      soundManager.playCardTypeSound(data.cardType)
      const typeRaw = (data.cardType?.type || data.cardType?.TYPE || '')
        .toString()
        .toLowerCase()
      const hasDedicatedSound =
        typeRaw === 'bomb' ||
        typeRaw === 'rocket' ||
        typeRaw === 'airplane' ||
        typeRaw === 'airplane_with_wings' ||
        typeRaw === 'plane' ||
        typeRaw === 'plane_plus_wings' ||
        typeRaw === 'triple_with_single'

      // 如果当前牌型没有专门的 mp3，则退回到文案驱动的 TTS 播报
      if (!hasDedicatedSound) {
        const voiceText = getPlayVoiceText(data.cardType, data.cards)
        if (voiceText) {
          soundManager.playVoice(voiceText)
        }
      }

      // 同步 Redux 中的出牌状态
      dispatch(
        playCardsAction({
          playerId: data.playerId,
          playerName: data.playerName || data.playerId,
          cards: data.cards,
          type: data.cardType,
        }),
      )

      const currentUserId = user?.id || user?.name
      const isCurrentUser =
        data.playerId === currentUserId || data.playerName === user?.name

      if (isCurrentUser) {
        setTurnState(false, false)
        playPendingRef.current = false
        setPlayPending(false)
      }

      // 清理本轮出牌倒计时
      stopTurnTimer()

      // 出牌后清空本地选中状态
      dispatch(clearSelection())

      // 出牌后清空所有玩家的“不出”标记
      clearAllPassedPlayers()

      // 有玩家出牌后，如果底牌区域仍展示，则自动收起
      if (!hideBottomCards) {
        setHideBottomCards(true)
      }

      // 统计炸弹 / 火箭数量，用于结算倍数
      const typeRawForBomb = (data.cardType?.type || data.cardType?.TYPE || '')
        .toString()
        .toLowerCase()
      if (typeRawForBomb === 'bomb') {
        setCurrentBombCount((prev) => prev + 1)
      } else if (typeRawForBomb === 'rocket') {
        setCurrentRocketCount((prev) => prev + 1)
      }

      if (!isCurrentUser) {
        const cardTypeDesc = data.cardType ? data.cardType.description : ''
        if (cardTypeDesc) {
          addChatMessage('系统', `${data.playerName} 打出 ${cardTypeDesc}`)
        }
      }
    }

    const handlePlayerPassed = (data: any) => {
      if (!data.playerId) return

      soundManager.playPass()
      dispatch(passAction(data.playerId))
      markPlayerPassed(data.playerId)
      addChatMessage('系统', `${data.playerName || '玩家'} 选择不出`)
    }

    // 游戏结束（game_over / game_ended）- 对齐旧版 frontend 行为
    const handleGameEnded = (data: any) => {
      
      // 清理出牌倒计时
      stopTurnTimer()
      
      // 停止本地“轮到我”状态
      setTurnState(false, false)
      
      // 通知 Redux 结束本局游戏
      dispatch(endGame(data))

      // 播放胜负音效
      const myId = user?.id || user?.name
      const isWinner =
        !!myId && (data.winnerId === myId || data.winnerName === user?.name)
      if (isWinner) {
        // 自己获胜：播放胜利音效 + 结算 BGM
        soundManager.playWin()
        soundManager.stopBackgroundMusic()
        soundManager.playVictoryMusic()
      } else {
        soundManager.playLose()
      }
      
      // 系统提示：本局结束 + 获胜方角色
      const winnerName = data.winnerName || '玩家'
      const role = data.winnerRole === 'landlord' ? '地主' : '农民'
      addChatMessage('系统', `本局结束：${winnerName}（${role}）获胜`)
      ;(async () => {
        const newScore = await refreshWalletScore()
        if (typeof newScore === 'number' && newScore <= 0) {
          addChatMessage('系统', '本局结束后你的积分已用尽，将自动返回大厅进行充值')
          dispatch(prepareNextGame())
          doLeaveRoom()
        }
      })()
    }

    // 聊天消息
    const handleChatMessage = (data: any) => {
      if (data.playerName && data.message) {
        addChatMessage(data.playerName, data.message)
      }
    }

    // 绑定房间 / 游戏相关的 Socket 事件
    socket.on('room_joined', handleRoomJoined)
    socket.on('join_game_success', handleJoinGameSuccess)
    socket.on('game_state_restored', handleGameStateRestored)
    socket.on('player_joined', handlePlayerJoined)
    socket.on('player_left', handlePlayerLeft)
    socket.on('player_ready', handlePlayerReady)
    socket.on('game_started', handleGameStarted)
    socket.on('deal_cards_all', handleDealCardsAll)
    socket.on('bidding_start', handleBiddingStart)
    socket.on('bid_result', handleBidResult)
    socket.on('landlord_determined', handleLandlordDetermined)
    socket.on('game_state_updated', handleGameStateUpdated)
    socket.on('turn_to_play', handleTurnToPlay)
    socket.on('turn_changed', handleTurnChanged)
    socket.on('cards_played', handleCardsPlayed)
    socket.on('player_passed', handlePlayerPassed)
    socket.on('play_cards_failed', handlePlayCardsFailed)
    socket.on('game_over', handleGameEnded)  // 兼容旧版：有的地方发 game_over
    socket.on('game_ended', handleGameEnded)  // 新版事件名：game_ended
    socket.on('message_received', handleChatMessage)

    return () => {
      socket.off('room_joined', handleRoomJoined)
      socket.off('join_game_success', handleJoinGameSuccess)
      socket.off('game_state_restored', handleGameStateRestored)
      socket.off('player_joined', handlePlayerJoined)
      socket.off('player_left', handlePlayerLeft)
      socket.off('player_ready', handlePlayerReady)
      socket.off('game_started', handleGameStarted)
      socket.off('deal_cards_all', handleDealCardsAll)
      socket.off('bidding_start', handleBiddingStart)
      socket.off('bid_result', handleBidResult)
      socket.off('landlord_determined', handleLandlordDetermined)
      socket.off('game_state_updated', handleGameStateUpdated)
      socket.off('turn_to_play', handleTurnToPlay)
      socket.off('turn_changed', handleTurnChanged)
      socket.off('cards_played', handleCardsPlayed)
      socket.off('player_passed', handlePlayerPassed)
      socket.off('play_cards_failed', handlePlayCardsFailed)
      socket.off('game_ended', handleGameEnded)
      socket.off('game_over', handleGameEnded)
      socket.off('message_received', handleChatMessage)
    }
  }, [connected, dispatch, user, roomId])

  // 自动准备：在等待状态且自己未准备时，根据房间配置自动发送一次 player_ready
  useEffect(() => {
    if (!user || !roomId) return
    if (autoReadySentRef.current) return
    if (gameStatus !== 'waiting') return

    const myId = user.id || user.name
    const me = Array.isArray(players)
      ? players.find((p: any) => p && (p.id === myId || p.userId === myId || p.name === user.name))
      : null
    if (!me) return

    if (me.isReady) {
      autoReadySentRef.current = true
      return
    }

    const socket = globalSocket.getSocket()
    if (!socket) return

    const isQuickRoom = typeof roomId === 'string' && roomId.startsWith('K')
    const settings = getGameSettings()
    const delayMs = isQuickRoom ? settings.quickBotDelayMs || 0 : 0

    autoReadySentRef.current = true

    if (delayMs <= 0) {
      const playerId = myId
      socket.emit('player_ready', {
        roomId,
        userId: myId,
        botDelayMs: 0,
      })
      dispatch(updatePlayerStatus({ playerId, isReady: true }))
      return
    }

    if (autoReadyTimerRef.current != null) {
      window.clearTimeout(autoReadyTimerRef.current)
      autoReadyTimerRef.current = null
    }

    autoReadyTimerRef.current = window.setTimeout(() => {
      const latestSocket = globalSocket.getSocket()
      if (!latestSocket) return

      const latestPlayers = Array.isArray(players) ? players : []
      const stillMe = latestPlayers.find((p: any) =>
        p && (p.id === myId || p.userId === myId || p.name === user.name),
      )
      if (!stillMe || stillMe.isReady) {
        return
      }

      const playerId = myId
      socket.emit('player_ready', {
        roomId,
        userId: myId,
        botDelayMs: 0,
      })
      dispatch(updatePlayerStatus({ playerId, isReady: true }))
    }, delayMs)
  }, [user, roomId, players, gameStatus, dispatch])

  // 当回到 waiting 状态时，重置自动准备相关的标记与计时器
  useEffect(() => {
    if (gameStatus === 'waiting') {
      // ...
      autoReadySentRef.current = false
      if (autoReadyTimerRef.current != null) {
        window.clearTimeout(autoReadyTimerRef.current)
        autoReadyTimerRef.current = null
      }
    }
  }, [gameStatus])

  // 结算页面自动离开/再来一局相关的计时器清理
  useEffect(() => {
    const clearTimer = () => {
      if (settlementAutoLeaveRef.current != null) {
        window.clearTimeout(settlementAutoLeaveRef.current)
        settlementAutoLeaveRef.current = null
      }
    }

    clearTimer()
    return clearTimer
  }, [gameStatus, roomId])

  useEffect(() => {
    return () => {
      if (dealAnimationTimeoutRef.current) {
        clearTimeout(dealAnimationTimeoutRef.current)
        dealAnimationTimeoutRef.current = null
      }
      if (autoReadyTimerRef.current != null) {
        window.clearTimeout(autoReadyTimerRef.current)
        autoReadyTimerRef.current = null
      }
    }
  }, [])

  // 自动整手出牌：当整手牌构成单一牌型且可以压过上家时，自动帮玩家出这一手
  useEffect(() => {
    if (!isMyTurn) return
    if (!myCards || myCards.length === 0) return
    if (autoFullHandPlayedRef.current) return

    const fullHandPattern = CardHintHelper.getFullHandIfSinglePattern(myCards)
    if (!fullHandPattern || fullHandPattern.length !== myCards.length) return

    const lastCards: string[] | null = !canPass
      ? null
      : lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    const canPlayFullHand = CardHintHelper.canFullHandBeatLast(fullHandPattern, lastCards)
    if (!canPlayFullHand) return

    console.log('[AutoFullHand] 满足整手出牌条件，准备自动出牌:', fullHandPattern)
    autoFullHandPlayedRef.current = true

    setTimeout(() => {
      console.log('[AutoFullHand] 执行整手出牌')
      doPlayCards(fullHandPattern)
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, myCards, lastPlayedCards, canPass])

// 自动应用跟牌提示
useEffect(() => {
  if (!isMyTurn) return
  // 如果不能跟牌，则不需要自动应用跟牌提示
  if (!canPass) return
  if (autoFollowHintAppliedRef.current) return
  if (!myCards || myCards.length === 0) return

  const hasLastCards =
    !!lastPlayedCards &&
    !!lastPlayedCards.cards &&
    lastPlayedCards.cards.length > 0
  if (!hasLastCards) return // 没有上家出牌，直接返回

  const lastCards = lastPlayedCards!.cards as string[]
  const hint = CardHintHelper.getHint(myCards, lastCards)
  if (!hint || hint.length === 0) return

  autoFollowHintAppliedRef.current = true

  // 自动应用“跟牌提示”结果：先清空已有选择，再勾选提示中的牌
  dispatch(clearSelection())
  hint.forEach((card) => {
    dispatch(toggleCardSelection(card))
  })
}, [isMyTurn, canPass, myCards, lastPlayedCards, dispatch])

// 抢地主倒计时超时处理
useEffect(() => {
  if (biddingTimer !== 0) return
  if (!showBiddingUI) return

  console.log('[AutoBid] 抢地主超时，自动选择不抢')
  closeBiddingUI()
  handleBid(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [biddingTimer, showBiddingUI])

// 自动出牌（使用策略模式）
useEffect(() => {
  if (!isMyTurn) return
  if (turnTimer !== 0) return

  console.log('[AutoPlay] 倒计时到期，使用策略模式处理')

  // 构建策略上下文
  const context: AutoPlayContext = {
    myCards,
    lastPlayedCards: lastPlayedCards?.cards || null,
    canPass,
    isMyTurn,
    turnTimer,
  }

  // 使用策略管理器找到合适的策略
  const result = autoPlayManager.current.execute(context)
  
  if (result) {
    console.log(`[AutoPlay] 使用策略: ${result.strategy.getName()}`)
    
    if (result.cards.length === 0) {
      // 空数组表示不出
      handlePass()
      addChatMessage('系统', '已为你自动选择不出')
    } else {
      doPlayCards(result.cards)
      addChatMessage('系统', `已为你自动出牌: ${result.cards.join(', ')}`)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [turnTimer, isMyTurn, canPass, myCards, lastPlayedCards])

  // 自动“没有可出牌时帮点不出”：如果所有提示都失败，延迟 1 秒自动执行不出
  useEffect(() => {
    if (!isMyTurn || !canPass) return
    if (!myCards || myCards.length === 0) return
    
    // 取出上一位玩家打出的牌作为参照
    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null
    
    if (!lastCards) return // 没有上家出牌，直接返回
    
    // 调用 getAllHints 获取所有可行的跟牌方案，用于判断是否彻底没有牌可出
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)
    
    if (!allHints || allHints.length === 0) {
      setTimeout(() => {
        if (isMyTurn && canPass) {
          handlePass()
          addChatMessage('系统', '没有可出的牌，已自动选择不出')
        }
      }, 1000)
    }
  }, [isMyTurn, canPass, myCards, lastPlayedCards])

  // 离开房间：断开房间并返回大厅
  const doLeaveRoom = () => {
    if (roomId) {
      globalSocket.leaveGame(roomId)
    }
    // 停止胜利音乐并清理最近房间记录
    soundManager.stopVictoryMusic()
    sessionStorage.removeItem('lastRoomId')
    sessionStorage.removeItem('lastRoomTime')
    dispatch(resetGame())
    navigate('/', { replace: true })
  }

  // 处理“开始/准备”按钮点击
  const handleStartGame = () => {
    if (!roomId || !user) return
    
    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('无法连接服务器，无法开始游戏')
      return
    }
    
    // 钱包积分不足时，禁止开始游戏
    if (walletScore !== null && walletScore <= 0) {
      appendSystemMessage('你的积分不足，无法开始游戏')
      return
    }

    // 开始新一局前先停止上一局的胜利音乐
    soundManager.stopVictoryMusic()
    const gameSettings = getGameSettings()
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    }

    // 查找当前玩家在 players 列表中的信息
    const currentPlayer = players.find((p: any) => 
      p.id === user.id || p.name === user.name
    )
    
    // 参考旧版逻辑：本地切换 ready 状态，然后再通知服务端
    const newReadyState = !currentPlayer?.isReady
    
    
    // 先在 Redux 中更新自己的准备状态
    const playerId = user.id || user.name
    dispatch(updatePlayerStatus({ playerId, isReady: newReadyState }))
    
    // 然后通过 socket 把准备状态同步给服务端
    socket.emit('player_ready', {
      roomId,
      userId: user.id || user.name,
    })
  }

  // 实际发送出牌请求到服务器（使用命令模式）
  const doPlayCards = (cardsToPlay: string[]) => {
    if (!roomId || !user || !isMyTurn) {
      appendSystemMessage(isMyTurn ? '无法连接服务器' : '还没轮到你出牌')
      return
    }

    if (playPendingRef.current) {
      appendSystemMessage('正在处理上一手出牌，请稍候...')
      return
    }

    playPendingRef.current = true
    setPlayPending(true)

    // 使用命令模式
    const command = new PlayCardsCommand(
      roomId,
      user.id || user.name,
      cardsToPlay,
      () => {
        playPendingRef.current = false
        setPlayPending(false)
      },
      (msg) => {
        appendSystemMessage(msg)
        playPendingRef.current = false
        setPlayPending(false)
      }
    )

    commandManager.current.execute(command)

    setTimeout(() => {
      if (playPendingRef.current) {
        playPendingRef.current = false
        setPlayPending(false)
      }
    }, 3000)
  }

  // 点击“出牌”按钮时的前端处理
  const handlePlayCards = () => {
    // 如果当前未选择牌，尝试整手自动出牌（例如单一牌型的一整手）
    let cardsToPlay = selectedCards
    if (cardsToPlay.length === 0) {
      const autoFullHand = CardHintHelper.getFullHandIfSinglePattern(myCards)
      if (autoFullHand && autoFullHand.length === myCards.length) {
        cardsToPlay = autoFullHand
      }
    }

    doPlayCards(cardsToPlay)
  }

  // 点击“不出”按钮的前端处理（使用命令模式）
  const handlePass = () => {
    if (!roomId || !user) {
      appendSystemMessage('无法连接服务器，无法执行不出')
      return
    }

    if (!isMyTurn) {
      appendSystemMessage('还没轮到你出牌，不能点不出')
      return
    }

    if (!canPass) {
      appendSystemMessage('当前轮次不能选择不出')
      return
    }

    dispatch(clearSelection())

    // 使用命令模式
    const command = new PassCommand(
      roomId,
      user.id || user.name,
      () => {
        // 不出成功
      },
      (msg) => appendSystemMessage(msg)
    )

    commandManager.current.execute(command)

    // 停止本轮倒计时
    stopTurnTimer()

    // 标记本地为非出牌方
    setTurnState(false, false)
  }

  // 处理抢/不抢按钮点击（使用命令模式）
  const handleBid = (bid: boolean) => {
    if (!roomId || !user) return

    stopBiddingTimer()
    closeBiddingUI()

    if (bid) soundManager.playBid()

    // 使用命令模式
    const command = new BidCommand(
      roomId,
      user.id || user.name,
      bid,
      () => {
        appendSystemMessage(`你选择了：${bid ? '抢地主' : '不抢'}`)
      }
    )

    commandManager.current.execute(command)
  }

  // 出牌提示入口：优先用本地算法，如果开启了 LLM 再走服务端提示
  const handleHint = () => {
    // 播放提示音效
    soundManager.playHint()

    if (!isMyTurn) {
      console.log('[Hint] 当前不是我的出牌轮次，忽略提示')
      return
    }

    if (!roomId || !user) {
      appendSystemMessage('无法连接服务器，无法获取出牌提示')
      return
    }

    if (myCards.length === 0) {
      console.log('[Hint] 当前没有手牌，无法提示')
      return
    }

    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('Socket 未连接，无法请求提示')
      return
    }

    // canPass === false 时表示当前为首手出牌；否则为跟牌
    const isFollowPlay =
      !!lastPlayedCards && !!lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && canPass
    const lastCards: string[] | null = isFollowPlay ? (lastPlayedCards!.cards as string[]) : null

    // 获取所有可行的提示方案
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)
    console.log('[Hint] 所有候选提示方案:', allHints)

    // 情况 1：跟牌轮次且可以不出，但没有任何可出的牌 → 自动不出
    if (isFollowPlay && canPass && (!allHints || allHints.length === 0)) {
      console.log('[Hint] 跟牌轮次且没有任何可出的牌，自动选择不出')
      handlePass()
      appendSystemMessage('当前没有可出的牌，系统已自动为你选择不出')
      return
    }

    // 情况 2：只有一种可行方案时，直接应用这一种
    if (allHints && allHints.length === 1) {
      const onlyHint = allHints[0]
      console.log('[Hint] 只有一种可行提示，直接应用:', onlyHint)

      dispatch(clearSelection())
      onlyHint.forEach((card) => dispatch(toggleCardSelection(card)))

      appendSystemMessage('已根据唯一提示自动为你选择了一手牌')
      return
    }

    // 情况 3：候选方案数量 >= 2
    const llmSettings = getLlmSettings()

    // 3.a 本地提示模式：不开启 LLM 时，用前端算法给出提示
    if (!llmSettings.enabled) {
      console.log('[Hint] LLM 未启用，使用本地算法计算提示')
      const localHint = CardHintHelper.getHint(myCards, lastCards)
      if (!localHint || localHint.length === 0) {
        console.log('[Hint] 本地算法也没有找到可出的牌')
        return
      }

      dispatch(clearSelection())
      localHint.forEach((card) => dispatch(toggleCardSelection(card)))
      appendSystemMessage('已根据本地提示自动为你选择了一手牌')
      return
    }

    // 3.b 当候选方案数量 >= 2 且启用了 LLM 时，交给服务端决策

    // 先把当前手牌和上家牌保存下来，便于服务端失败时本地兜底
    hintContextRef.current = {
      myCards: [...myCards],
      lastCards: lastCards ? [...lastCards] : null,
    }

    console.log('[Hint] 候选方案 >= 2，转由服务端 LLM 提示:', {
      roomId,
      userId: user.id || user.name,
      isFollowPlay,
      lastCards,
      candidateCount: allHints?.length ?? 0,
      llmSettings,
    })

    socket.emit('request_hint', {
      roomId,
      userId: user.id || user.name,
      llmConfig: {
        provider: llmSettings.provider,
        model: llmSettings.model,
        apiKey: llmSettings.apiKey,
        customBaseUrl: llmSettings.customBaseUrl,
        customModel: llmSettings.customModel,
        customPrompt: llmSettings.customPrompt,
      },
    })
  }

  // 工具方法：根据 shouldSelect 决定是否选中某张牌
  const updateCardSelection = (cardStr: string, shouldSelect: boolean) => {
    const isSelected = selectedCards.includes(cardStr)
    if (shouldSelect && !isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }
      console.log('[Select] 选中牌:', cardStr)
    } else if (!shouldSelect && isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }
      console.log('[Select] 取消选中:', cardStr)
    }
  }

  // 记录最近处理的牌以及最近一次播放选牌音效的时间
  const lastProcessedCardRef = useRef<string | null>(null)
  const lastSoundTimeRef = useRef<number>(0)

  // 手牌区域的 PointerDown 事件：支持拖拽选择多张牌
  const handleCardPointerDown = (cardStr: string, ev: any) => {
    ev.preventDefault()
    ev.stopPropagation()
    
    // 释放 pointer capture，避免拖拽时事件被锁定在某个元素上
    if (ev.target && ev.target.setPointerCapture) {
      try {
        ev.target.releasePointerCapture(ev.pointerId)
      } catch (e) {
        // 忽略释放失败的异常
      }
    }
    
    console.log('[Pointer] PointerDown on card:', cardStr)

    // 根据当前是否已选中，决定本次拖拽是选中模式还是取消模式
    const isSelected = selectedCards.includes(cardStr)
    const mode: 'select' | 'deselect' = isSelected ? 'deselect' : 'select'

    startDragSelect(mode)
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, mode === 'select')
  }

  // Pointer 经过其他牌时，根据拖拽模式更新选中状态
  const handleCardPointerEnter = (cardStr: string, ev: any) => {
    if (!isDragSelecting || !dragSelectMode) return
    if (lastProcessedCardRef.current === cardStr) return // 已处理过该牌则不重复处理
    
    ev.preventDefault()
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, dragSelectMode === 'select')
  }

  // 拖拽过程中，根据指针位置命中对应的牌
  const handleHandPointerMove = (ev: React.PointerEvent) => {
    if (!isDragSelecting || !dragSelectMode) return
    
    // 使用 elementFromPoint 命中当前指针下方的 DOM 元素
    const element = document.elementFromPoint(ev.clientX, ev.clientY)
    if (!element) return
    
    // 找到最近的 .card 元素
    const cardElement = element.closest('.card') as HTMLElement
    if (!cardElement) return
    
    // 从 data-card 属性中读取牌面字符串
    const cardKey = cardElement.getAttribute('data-card')
    if (!cardKey || lastProcessedCardRef.current === cardKey) return
    
    lastProcessedCardRef.current = cardKey
    updateCardSelection(cardKey, dragSelectMode === 'select')
  }

  // 拖拽结束时，清理拖拽选择状态
  const handleHandPointerUp = () => {
    if (!isDragSelecting) return
    stopDragSelect()
    lastProcessedCardRef.current = null
  }

  // 发送聊天消息
  const handleSendChat = () => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) return

    if (chatMessage.trim()) {
      socket.emit('send_message', {
        roomId,
        userId: user.id,
        userName: user.name,
        playerName: user.name,
        message: chatMessage,
      })
      clearChatInput()
    }
  }

  // 调试用useEffect已移除

  // 根据手牌数量和容器宽度，动态计算手牌之间的重叠
  useEffect(() => {
    const calculateCardOverlap = () => {
      const handSection = document.querySelector('.player-hand-section') as HTMLElement | null
      const cards = document.querySelectorAll('.player-hand .card')
      
      if (!handSection || cards.length === 0) return
      
      // 手牌容器宽度、手牌数量和单张牌宽度
      const containerWidth = handSection.clientWidth // 手牌区域总宽度
      const n = myCards.length || cards.length       // 手牌数量
      const cardWidth = (cards[0] as HTMLElement).offsetWidth         // 单张牌的可视宽度

      if (n <= 1 || cardWidth <= 0 || containerWidth <= cardWidth) {
        return
      }

      // 希望在容器宽度内平均铺开所有牌，并限制重叠范围
      // 令 visibleWidth 为相邻两张牌的理论间距，则 overlap = visibleWidth - cardWidth
      const availableWidth = containerWidth - cardWidth
      const visibleWidth = availableWidth / (n - 1)

      // overlap 为负数表示牌有重叠；根据 visibleWidth 动态调整
      let overlap = visibleWidth - cardWidth

      // 将重叠的绝对值限制在 [minOverlapAbs, maxOverlapAbs] 区间内
      const maxOverlapAbs = cardWidth * 0.85   // 最大允许重叠 85%
      const minOverlapAbs = cardWidth * 0.2    // 最小重叠 20%

      if (overlap < -maxOverlapAbs) {
        overlap = -maxOverlapAbs
      } else if (overlap > -minOverlapAbs) {
        overlap = -minOverlapAbs
      }

      cards.forEach((card, index) => {
        const el = card as HTMLElement
        if (index === 0) {
          el.style.marginLeft = '0'
        } else {
          el.style.marginLeft = `${overlap}px`
        }
      })

      const actualTotalWidth = cardWidth + (n - 1) * (cardWidth + overlap)
      console.log('[CardLayout] 计算重叠宽度:', {
        containerWidth,
        cardCount: n,
        domCardCount: cards.length,
        cardWidth,
        visibleWidth,
        overlap,
        actualTotalWidth,
      })
    }
    
    // 延迟一小段时间再计算，确保 DOM 已经完成布局
    const timer = setTimeout(calculateCardOverlap, 100)
    
    // 监听窗口尺寸变化，实时更新重叠效果
    window.addEventListener('resize', calculateCardOverlap)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', calculateCardOverlap)
    }
  }, [myCards]) // 手牌变化时重新计算重叠

  useEffect(() => {
    if (!user) {
      setWalletScore(null)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      try {
        await refreshWalletScore()
      } catch {
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [user])

  // 将当前钱包积分写入 sessionStorage，供下次进入房间时兜底使用
  useEffect(() => {
    if (walletScore == null) return
    try {
      sessionStorage.setItem('lastWalletScore', String(walletScore))
    } catch {
      // ignore storage error
    }
  }, [walletScore])

  // 结算面板已移除，使用CenterResultPanel替代

  // 对整局结算后的“自动再来一局”逻辑做统一管理（含 30 秒倒计时）
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      // 切换到结算态时，启动 30 秒自动再来一局倒计时
      setAutoReplayCountdown(30)

      if (autoReplayTimerRef.current != null) {
        window.clearInterval(autoReplayTimerRef.current)
      }

      autoReplayTimerRef.current = window.setInterval(() => {
        setAutoReplayCountdown((prev) => {
          if (prev == null) return prev
          if (prev <= 1) {
            // 倒计时结束，清理定时器并自动离开房间
            window.clearInterval(autoReplayTimerRef.current as number)
            autoReplayTimerRef.current = null
            dispatch(prepareNextGame())
            doLeaveRoom()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // 非结算阶段，清理自动再来一局相关状态
      setAutoReplayCountdown(null)
      if (autoReplayTimerRef.current != null) {
        window.clearInterval(autoReplayTimerRef.current)
        autoReplayTimerRef.current = null
      }
    }

    return () => {
      if (autoReplayTimerRef.current != null) {
        window.clearInterval(autoReplayTimerRef.current)
        autoReplayTimerRef.current = null
      }
    }
  }, [gameStatus, gameState.gameResult, dispatch])

// ...

  return (
    <div className="game-room-container">
      {/* 整个游戏桌面区域 */}
      <div className="game-table">
        {/* 底牌展示区 */}
        {landlordId && (
          <BottomCards
            visible={!hideBottomCards}
            cards={landlordCards}
            baseScore={settlementScore?.baseScore ?? 5000}
            multiplier={
              bottomPlayerScore?.multipliers?.total ??
              Math.max(1, Math.pow(3, currentBombCount) * Math.pow(8, currentRocketCount))
            }
            parseCard={parseCard}
          />
        )}

        <CenterResultPanel
          visible={gameStatus === 'finished' && !!gameState.gameResult}
          landlordWin={gameState.gameResult?.landlordWin ?? false}
          autoReplayCountdown={autoReplayCountdown}
          onReplay={() => {
            dispatch(prepareNextGame())
            handleStartGame()
          }}
          onBackToLobby={() => {
            dispatch(prepareNextGame())
            doLeaveRoom()
          }}
        />

        <TopPlayersArea
          leftPlayer={leftPlayer}
          rightPlayer={rightPlayer}
          landlordId={landlordId}
          isLeftTurn={isLeftTurn}
          isRightTurn={isRightTurn}
          turnTimer={turnTimer}
          lastPlayedCards={lastPlayedCards}
          passedPlayers={passedPlayers}
          leftPlayerScore={leftPlayerScore}
          rightPlayerScore={rightPlayerScore}
          leftRemainingCards={leftRemainingCards}
          rightRemainingCards={rightRemainingCards}
          gameStatus={gameStatus}
          parseCard={parseCard}
          renderPlayerAvatar={renderPlayerAvatar}
        />

        <BottomPlayedCards
          visible={
            !!currentPlayer &&
            !!lastPlayedCards &&
            lastPlayedCards.playerId === currentPlayer.id &&
            !!lastPlayedCards.cards &&
            lastPlayedCards.cards.length > 0 &&
            !!landlordId
          }
          cards={lastPlayedCards?.cards || []}
          isLandlord={isBottomLandlord}
          parseCard={parseCard}
        />

        <BottomPlayerInfo
          player={currentPlayer}
          isLandlord={isBottomLandlord}
          isTurn={isBottomTurn}
          coinValue={bottomCoinValue}
          finalScore={bottomPlayerScore?.finalScore}
          gameStatus={gameStatus}
          renderPlayerAvatar={renderPlayerAvatar}
        />

        {/* 当前玩家选择不出时，底部显示“不出” */}
        {gameStatus === 'playing' && user && passedPlayers[user.id || user.name || ''] && (
          <div className="bottom-played-area">
            <div className="pass-text">不出</div>
          </div>
        )}

        {/* 玩家底部手牌区域（新版前端实现） */}
        <HandCards
          cards={myCards}
          selectedCards={selectedCards}
          isDealingAnimation={isDealingAnimation}
          landlordId={landlordId}
          isBottomLandlord={isBottomLandlord}
          parseCard={parseCard}
          onCardPointerDown={handleCardPointerDown}
          onCardPointerEnter={handleCardPointerEnter}
          onHandPointerUp={handleHandPointerUp}
          onHandPointerMove={handleHandPointerMove}
        />

        {/* 底部控制区 */}
        <div className="game-controls">
          {/* 等待其他玩家 */}
          {gameStatus === 'waiting' && (
            <div className="waiting-controls">
              <span className="waiting-text">等待其他玩家加入...</span>
            </div>
          )}

          {/* 抢地主 UI */}
          <BiddingControls
            visible={gameStatus === 'bidding' && showBiddingUI}
            timer={biddingTimer}
            onBid={handleBid}
          />

          {/* 出牌操作区 */}
          <GameActions
            visible={gameStatus === 'playing' && isMyTurn}
            canPass={canPass}
            turnTimer={turnTimer}
            playPending={playPending}
            onPass={handlePass}
            onHint={handleHint}
            onPlayCards={handlePlayCards}
          />
        </div>
      </div>

      {/* 聊天容器（包含面板和按钮） */}
      <ChatContainer
        visible={chatVisible}
        messages={chatMessages}
        currentMessage={chatMessage}
        onToggle={toggleChat}
        onMessageChange={updateChatInput}
        onSend={handleSendChat}
      />
    </div>
  )
}
