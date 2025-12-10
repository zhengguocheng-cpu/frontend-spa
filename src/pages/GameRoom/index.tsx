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
import * as CardOps from './logic/cardOperations'
import * as GameFlow from './logic/gameFlow'
import { soundManager } from '@/utils/sound'
import { getLlmSettings } from '@/utils/llmSettings'
import { getGameSettings } from '@/utils/gameSettings'
import { motion } from 'framer-motion'

// 导入新的 Hooks
import { useGameUI, useGameTimer } from './hooks'

// 导入共享组件
import { ChatPanel } from '@/shared/components'

// 导入游戏特定组件
import { BiddingControls } from '@/games/doudizhu/components'

// 导入 GameRoom 子组件
import { SettlementPanel, GameActions, AiHintPanel, PlayerDisplay, BottomCards, HandCards } from './components'

import '@/styles/avatars.css'
import './style.css'
import './game.css'
import './ai-panel.css'

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

  // 监听 Socket 连接状态，用于控制 UI 和调试流程
  const { connected } = useSocketStatus()

  // ==================== 使用新的 useGameUI Hook ====================
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
    
    // 结算和抢地主
    showSettlement,
    openSettlement,
    closeSettlement,
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

  // ==================== 使用新的 useGameTimer Hook ====================
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
  const [walletScore, setWalletScore] = useState<number | null>(null)
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
  // 是否已经自动应用过“整手出牌”或“跟牌提示”
  const autoFollowHintAppliedRef = useRef(false)
  // 当前局中的炸弹 / 火箭数量统计
  const [currentBombCount, setCurrentBombCount] = useState(0)
  const [currentRocketCount, setCurrentRocketCount] = useState(0)
  // 是否隐藏底牌展示（例如出完牌后收起底牌）
  const [hideBottomCards, setHideBottomCards] = useState(false)
  
  // AI 出牌提示记录结构
  interface AiHintRecord {
    id: number
    timestamp: string
    cards: string[]
    reason?: string
    analysis?: string
    winRate?: number
    isPass: boolean
  }
  const [aiHintHistory, setAiHintHistory] = useState<AiHintRecord[]>([])
  const [showAiPanel, setShowAiPanel] = useState(false)
  const aiHintCounterRef = useRef(0)

  const appendSystemMessage = (text: string) => {
    if (!text) return
    addChatMessage('系统', text)
  }

  const formatTimeWithMs = (date: Date) => {
    const base = date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const ms = date.getMilliseconds().toString().padStart(3, '0')
    return `${base}.${ms}`
  }

  const appendDebugMessage = (tag: string, text: string) => {
    const now = new Date()
    const ts = formatTimeWithMs(now)
    appendSystemMessage(`[DEBUG ${tag}] ${ts} ${text}`)
  }

  // 根据当前用户，计算左右两侧和自己的玩家位置
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

    // 找到当前用户在 players 列表中的索引
    const myIndex = filteredPlayers.findIndex(
      (p: any) => p.id === user.id || p.name === user.name
    )

    if (myIndex === -1) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    // 当前玩家（自己）
    const currentPlayer = filteredPlayers[myIndex]

    // 左侧玩家
    const leftPlayer = filteredPlayers.length >= 2
      ? filteredPlayers[(myIndex - 1 + filteredPlayers.length) % filteredPlayers.length]
      : null

    // 右侧玩家
    const rightPlayer = filteredPlayers.length >= 3
      ? filteredPlayers[(myIndex + 1) % filteredPlayers.length]
      : null

    return { leftPlayer, rightPlayer, currentPlayer }
  }

  const { leftPlayer, rightPlayer, currentPlayer } = getPlayerPositions()

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

  const isLandlordPlayer = (player: any | null): boolean => {
    if (!player || !landlordId) return false
    const ids = [player.id, (player as any)?.userId, player.name].filter(Boolean)
    return ids.includes(landlordId)
  }

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

  // 记录已经为哪些玩家拉取过金币，避免重复请求
  const fetchedScorePlayerIdsRef = useRef<Set<string>>(new Set())

  const refreshWalletScore = async (): Promise<number | null> => {
    if (!user) {
      setWalletScore(null)
      return null
    }

    try {
      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : window.location.origin

      const res = await fetch(
        `${baseUrl}/api/score/${encodeURIComponent(user.id)}`,
      )

      let json: any = null
      try {
        json = await res.json()
      } catch {
      }

      if (!res.ok || !json?.success || !json.data) {
        console.warn('GameRoom 刷新钱包积分失败:', res.status, json?.message)
        setWalletScore(0)
        return 0
      }

      const data = json.data
      const scoreValue = typeof data.totalScore === 'number' ? data.totalScore : 0
      setWalletScore(scoreValue)
      return scoreValue
    } catch (err: any) {
      console.error('GameRoom 刷新钱包积分异常:', err)
      setWalletScore(0)
      return 0
    }
  }

  // 当上方左右玩家的 score 为空 / 非正数时，临时从 /api/score/<playerId> 拉一次钱包积分
  useEffect(() => {
    const candidates = [leftPlayer, rightPlayer].filter(
      (p: any | null) =>
        p &&
        p.id &&
        (!p.score || typeof p.score !== 'number' || p.score <= 0) &&
        !fetchedScorePlayerIdsRef.current.has(p.id),
    ) as any[]

    if (!candidates.length) return

    const controller = new AbortController()

    const fetchScores = async () => {
      try {
        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        const updatedPlayers = [...players]

        for (const p of candidates) {
          try {
            fetchedScorePlayerIdsRef.current.add(p.id)
            const res = await fetch(`${baseUrl}/api/score/${encodeURIComponent(p.id)}`, {
              signal: controller.signal,
            })
            let json: any = null
            try {
              json = await res.json()
            } catch {
              // ignore body parse error
            }

            const record = res.ok && json?.success && json.data ? json.data : null
            const totalScore =
              record && typeof record.totalScore === 'number' ? record.totalScore : null

            if (totalScore != null) {
              const idx = updatedPlayers.findIndex((x: any) => x.id === p.id)
              if (idx >= 0) {
                updatedPlayers[idx] = {
                  ...updatedPlayers[idx],
                  score: totalScore,
                }
              }
            }
          } catch {
            // 网络错误时忽略，保持原来的 0 分显示
          }
        }

        dispatch(updatePlayers(updatedPlayers as any))
      } catch {
        // ignore
      }
    }

    fetchScores()

    return () => {
      controller.abort()
    }
  }, [leftPlayer, rightPlayer, players, dispatch])

  const getRemainingCardsForPlayer = (player: any | null): string[] | null => {
    if (!player || !remainingHandsMap) return null
    const idsToMatch = [player.id, (player as any)?.userId, player.name].filter(Boolean)
    for (const id of idsToMatch) {
      const info = (remainingHandsMap as any)[id]
      if (info && Array.isArray(info.cards) && info.cards.length > 0) {
        return info.cards as string[]
      }
    }
    return null
  }

  const leftRemainingCards = getRemainingCardsForPlayer(leftPlayer)
  const rightRemainingCards = getRemainingCardsForPlayer(rightPlayer)
  const isBottomLandlord = isLandlordPlayer(currentPlayer)

  const renderPlayerAvatar = (avatar: string | undefined) => {
    const raw = (avatar || '').trim()
    const match = raw.match(/^avatar-(\d+)$/)
    if (match) {
      const id = Number(match[1])
      if (!Number.isNaN(id) && id > 0) {
        return <div className={`avatar-sprite avatar-${id} avatar-sprite-small`} />
      }
    }
    return <span>{raw || '👤'}</span>
  }

  const parseCard = (card: string) => {
    if (card === '大王' || card === '🃏大王' || card.includes('大王')) {
      return { rank: 'JOKER', suit: '', isJoker: 'big' as const }
    }
    if (card === '小王' || card === '🃏小王' || card.includes('小王')) {
      return { rank: 'JOKER', suit: '', isJoker: 'small' as const }
    }
    if (card.includes('JOKER')) {
      return { rank: 'JOKER', suit: '', isJoker: 'big' as const }
    }
    if (card.includes('joker')) {
      return { rank: 'JOKER', suit: '', isJoker: 'small' as const }
    }
    const suits = ['♠', '♥', '♦', '♣']
    let suit = ''
    let rank = card
    for (const s of suits) {
      if (card.includes(s)) {
        suit = s
        rank = card.replace(s, '')
        break
      }
    }
    return { rank, suit, isJoker: null as 'big' | 'small' | null }
  }

  const RANK_SPOKEN_MAP: Record<string, string> = {
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
    '10': '十',
    J: 'J',
    Q: 'Q',
    K: 'K',
    A: 'A',
    '2': '二',
    JOKER: '王',
  }

  const getSpokenRankFromRank = (rank: string | null | undefined): string => {
    if (!rank) return ''
    return RANK_SPOKEN_MAP[rank] || rank
  }

  const getSpokenRankFromCard = (card: string): string => {
    const parsed = parseCard(card)
    if (parsed.isJoker) {
      if (parsed.isJoker === 'big') return '大王'
      if (parsed.isJoker === 'small') return '小王'
      return '王'
    }
    return getSpokenRankFromRank(parsed.rank)
  }

  const getPlayVoiceText = (pattern: any, cards: string[]): string | null => {
    const typeRaw = (pattern?.type || pattern?.TYPE || '').toString().toLowerCase()
    const cardList: string[] =
      Array.isArray(pattern?.cards) && pattern.cards.length > 0
        ? pattern.cards
        : Array.isArray(cards)
        ? cards
        : []

    if (!cardList.length) {
      return null
    }

    switch (typeRaw) {
      case 'single': {
        // 单牌：直接读点数
        return getSpokenRankFromCard(cardList[0])
      }
      case 'pair': {
        // 对子：读“对X”
        const text = getSpokenRankFromCard(cardList[0])
        return text ? `对${text}` : null
      }
      default: {
        // 其他牌型暂时不播报
        return null
      }
    }
  }

  // 初始化：进入房间时绑定 Socket，并记录最近房间
  useEffect(() => {
    if (!user) {
      console.warn('[GameRoom] 未找到用户信息，跳转登录页')
      navigate('/login', { replace: true })
      return
    }
    
    if (!roomId) return

    console.log('[GameRoom] 进入房间:', roomId)
    appendDebugMessage('FLOW', `进入房间，roomId=${roomId}`)
    
    // 将最近进入的房间信息写入 sessionStorage，方便断线重连
    sessionStorage.setItem('lastRoomId', roomId)
    sessionStorage.setItem('lastRoomTime', Date.now().toString())

    const socket = globalSocket.getSocket()
    if (!socket) {
      console.error('[GameRoom] Socket 未连接，跳转登录页')
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
      console.log('[Socket] 已连接，准备加入房间')
      
      // 首次连接 / 重连时，主动发送加入房间请求
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    const handleDisconnect = () => {
      console.log('[Socket] 断开连接')
    }

    // 处理服务器返回的出牌提示结果
    const handleHintResult = (data: any) => {
      console.log('[AI Hint] 收到提示结果:', data)

      const { success, cards, reason, analysis, winRate, error } = data || {}

      // 优先使用服务端提示
      if (success && Array.isArray(cards)) {
        if (cards.length > 0) {
          dispatch(clearSelection())
          ;(cards as string[]).forEach((card) => {
            dispatch(toggleCardSelection(card))
          })
        }

        aiHintCounterRef.current += 1
        const newRecord: AiHintRecord = {
          id: aiHintCounterRef.current,
          timestamp: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          cards: cards as string[],
          reason,
          analysis,
          winRate,
          isPass: cards.length === 0,
        }
        setAiHintHistory((prev) => [...prev, newRecord])
        setShowAiPanel(true)

        appendSystemMessage(
          cards.length > 0
            ? 'AI 提供了一手推荐出牌'
            : 'AI 提示：当前可以选择不出牌',
        )
        return
      }

      // 服务端失败时，退回到本地 CardHintHelper 计算
      const ctx = hintContextRef.current
      const myCardsSnapshot = ctx?.myCards
      const lastCardsSnapshot = ctx?.lastCards ?? null

      console.warn('[AI Hint] 服务器提示失败，尝试本地计算', error)
      if (error) {
        appendSystemMessage(`AI 提示失败：${String(error)}`)
      }

      if (!myCardsSnapshot || myCardsSnapshot.length === 0) {
        console.log('[AI Hint Fallback] 当前没有手牌快照，无法本地提示')
        return
      }

      const fallbackHint = CardHintHelper.getHint(myCardsSnapshot, lastCardsSnapshot)
      if (!fallbackHint || fallbackHint.length === 0) {
        console.log('[AI Hint Fallback] 本地也没有可出的牌')
        return
      }

      dispatch(clearSelection())
      fallbackHint.forEach((card) => {
        dispatch(toggleCardSelection(card))
      })

      console.log('[AI Hint Fallback] 使用本地提示结果:', fallbackHint)
    }

    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('hint_result', handleHintResult)

    // 如果 Socket 已连接，直接发送 join_game 请求，避免遗漏房间加入
    if (socket.connected) {
      console.log('[Socket] 当前已连接，主动发送 join_game 请求')
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

    try {
      const clickRaw = sessionStorage.getItem('debug_quick_click')
      const roomsRaw = sessionStorage.getItem('debug_quick_rooms_resolved')
      const joinRaw = sessionStorage.getItem('debug_quick_join_emit')

      sessionStorage.removeItem('debug_quick_click')
      sessionStorage.removeItem('debug_quick_rooms_resolved')
      sessionStorage.removeItem('debug_quick_join_emit')

      const click = clickRaw ? Number(clickRaw) : NaN
      const rooms = roomsRaw ? Number(roomsRaw) : NaN
      const join = joinRaw ? Number(joinRaw) : NaN
      const now = Date.now()

      if (!Number.isNaN(click)) {
        const total = now - click
        appendDebugMessage('QUICK', `从点击匹配到进入房间总耗时 ${total}ms`)
      }

      if (!Number.isNaN(click) && !Number.isNaN(rooms)) {
        appendDebugMessage('QUICK', `点击房间列表到房间列表返回耗时 ${rooms - click}ms`)
      }

      if (!Number.isNaN(rooms) && !Number.isNaN(join)) {
        appendDebugMessage('QUICK', `房间列表返回到发送 join_game 耗时 ${join - rooms}ms`)
      }
    } catch {
    }
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
      const now = Date.now()
      quickFlowRef.current.roomJoinedAt = now
      appendDebugMessage('FLOW', '收到 room_joined 事件')
    }

    const handleJoinGameSuccess = (data: any) => {
      appendDebugMessage('ROOM', '收到 join_game_success 事件')

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
      const now = Date.now()
      const joinedAt = quickFlowRef.current.roomJoinedAt
      if (joinedAt) {
        appendDebugMessage('FLOW', `room_joined → game_started 耗时 ${now - joinedAt}ms`)
      }
      quickFlowRef.current.gameStartedAt = now
      closeSettlement()
      dispatch(prepareNextGame())
      setCurrentBombCount(0)
      setHideBottomCards(false)
      appendSystemMessage('游戏开始，准备抢地主')
    }

    const handleDealCardsAll = (data: any) => {
      const now = Date.now()
      const startedAt = quickFlowRef.current.gameStartedAt
      if (startedAt) {
        appendDebugMessage('FLOW', `game_started → deal_cards_all 耗时 ${now - startedAt}ms`)
      }
      quickFlowRef.current.dealCardsAt = now
      
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
      } else {
        console.error('[Game] 未找到当前玩家的发牌结果，currentPlayerId:', user?.id || user?.name)
        console.error('[Game] 服务端返回的玩家列表:', data.players)
      }
    }

    const handleBiddingStart = (data: any) => {
      const now = Date.now()
      const dealAt = quickFlowRef.current.dealCardsAt
      if (dealAt) {
        appendDebugMessage('FLOW', `deal_cards_all → bidding_start 耗时 ${now - dealAt}ms`)
      }
      quickFlowRef.current.biddingStartAt = now
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
      appendDebugMessage('BID', `bid_result: ${data.userName || '玩家'} 选择${bidText}`)
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
      appendDebugMessage('BID', '收到 landlord_determined 事件')
      
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
      console.warn('[PlayCards] 出牌失败:', data)
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

      appendDebugMessage(
        'FLOW',
        `收到 cards_played：player=${data.playerName || data.playerId || '未知'}，牌数=${
          Array.isArray(data.cards) ? data.cards.length : 0
        }`,
      )

      if (!data.playerId || !data.cards) {
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

      appendDebugMessage(
        'FLOW',
        `收到 game_over：winner=${data.winnerName || '未知'}，role=${data.winnerRole}, landlordWin=${
          data.landlordWin
        }`,
      )
      
      // 清理出牌倒计时
      stopTurnTimer()
      
      // 停止本地“轮到我”状态
      setTurnState(false, false)
      
      // 通知 Redux 结束本局游戏
      dispatch(endGame(data))

      // 记录我们已经请求显示结算
      openSettlement()
      appendDebugMessage('FLOW', '已调用 openSettlement()，等待结算 UI 渲染')

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
    //socket.on('cards_dealt', handleCardsDealt)
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
      //socket.off('cards_dealt', handleCardsDealt)
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
      console.log('[AutoReady] 立即发送 player_ready 事件', {
        roomId,
        userId: myId,
      })
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

    console.log('[AutoReady] 准备启动自动准备计时', {
      roomId,
      userId: myId,
      delayMs,
    })

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
      console.log('[AutoReady] 延时后仍在房间且未准备，发送 player_ready 事件', {
        roomId,
        userId: myId,
      })
      dispatch(updatePlayerStatus({ playerId, isReady: true }))
      latestSocket.emit('player_ready', {
        roomId,
        userId: myId,
        botDelayMs: 0,
      })
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

    autoFullHandPlayedRef.current = true
    console.log('[AutoPlay] 满足整手出牌条件，自动整手出牌 fullHandPattern:', fullHandPattern)

  setTimeout(() => {
    doPlayCards(fullHandPattern)
  }, 500)
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

  console.log('[AutoBidTimeout] 抢地主超时，自动选择不抢')
  closeBiddingUI()
  handleBid(false)
}, [biddingTimer, showBiddingUI])

// 自动出牌（出牌倒计时超时）
useEffect(() => {
  if (!isMyTurn) return
  if (turnTimer !== 0) return

  console.log('[AutoTurnTimeout] 自动出牌超时，当前状态：isMyTurn=true, canPass=', canPass)

  if (canPass) {
    console.log('可以选择不出...')
    handlePass()
  } else {
    // 尝试自动出牌
    console.log('尝试自动出牌...')
    if (myCards.length === 0) {
      console.warn('没有牌可以出...')
      return
    }

    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    const autoHint = CardHintHelper.getHint(myCards, lastCards)
    console.log('自动提示结果:', autoHint)
    
    if (autoHint && autoHint.length > 0) {
      console.log('自动出牌:', autoHint)
      doPlayCards(autoHint)
      addChatMessage('系统', '已为你自动出一手推荐牌')
    } else {
      // 推荐失败，兜底出最小的一张
      console.error('没有推荐出牌，兜底出最小的一张牌')
      const minCard = myCards[0]
      if (minCard) {
        console.log('兜底出牌:', minCard)
        doPlayCards([minCard])
        addChatMessage('系统', '已为你自动出一张最小的牌')
      } else {
        console.error('已经没有可以出的牌')
        addChatMessage('系统', '已为你自动判定为没有可出的牌')
      }
    }
  }
  }, [turnTimer, isMyTurn, canPass])

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
    
    // 如果完全没有可出的牌，则 1 秒后自动帮玩家点“不出”
    if (!allHints || allHints.length === 0) {
      console.log('没有找到任何可出的牌')
      // 1 秒后自动点击“不出”
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
    
    console.log('准备状态改变', { 
      currentState: currentPlayer?.isReady,
      newState: newReadyState,
      playerName: user.name
    })
    
    // 先在 Redux 中更新自己的准备状态
    const playerId = user.id || user.name
    dispatch(updatePlayerStatus({ playerId, isReady: newReadyState }))
    
    // 然后通过 socket 把准备状态同步给服务端
    socket.emit('player_ready', {
      roomId,
      userId: user.id || user.name,
    })
    
    console.log('发送准备状态改变', { 
      roomId,
      userId: user.id || user.name,
    })
  }

  // 实际发送出牌请求到服务器
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

    CardOps.playCards({
      roomId,
      userId: user.id || user.name,
      cards: cardsToPlay,
      socket: globalSocket.getSocket(),
      onSuccess: () => {
        playPendingRef.current = false
        setPlayPending(false)
      },
      onError: (msg) => {
        appendSystemMessage(msg)
        playPendingRef.current = false
        setPlayPending(false)
      }
    })

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

  // 点击“不出”按钮的前端处理
  const handlePass = () => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
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

    // 清空当前已选中的牌
    dispatch(clearSelection())

    console.log('发送不出消息')

    // 发送 pass_turn 事件给服务端
    socket.emit('pass_turn', {
      roomId,
      userId: user.id || user.name,
    })

    // 停止本轮倒计时
    stopTurnTimer()

    // 标记本地为非出牌方
    setTurnState(false, false)
  }

  // 处理抢/不抢按钮点击（bid = true 或 false）
  const handleBid = (bid: boolean) => {
    if (!roomId || !user) return

    stopBiddingTimer()
    closeBiddingUI()

    if (bid) soundManager.playBid()

    GameFlow.bidLandlord({
      roomId,
      userId: user.id || user.name,
      bid,
      socket: globalSocket.getSocket(),
      onSuccess: () => {
        appendSystemMessage(`你选择了：${bid ? '抢地主' : '不抢'}`)
      },
      onError: (msg) => appendSystemMessage(msg)
    })
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

  // 观察 gameStatus 变化（调试用）
  useEffect(() => {
    console.log('[Debug] gameStatus 变化:', gameStatus)
  }, [gameStatus])

  // 观察 isMyTurn 变化（调试用）
  useEffect(() => {
    console.log('[Debug] isMyTurn 变化:', isMyTurn)
  }, [isMyTurn])

  // 观察 players 列表变化（调试用）
  useEffect(() => {
    console.log('[Debug] players 变化:', players)
    players.forEach((p: any) => {
      console.log(`  - ${p.name}: cardCount=${p.cardCount}`)
    })
  }, [players])

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

  // 一局结束且有结算结果时，显示结算面板
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      openSettlement()
    }
  }, [gameStatus, gameState.gameResult])

  // 对整局结算后的“自动再来一局”逻辑做统一管理（含 30 秒倒计时）
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      // 切换到结算态时，清空本局的 AI 提示，并启动 30 秒自动再来一局倒计时
      setAiHintHistory([])
      aiHintCounterRef.current = 0
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

        {/* 中央结算结果 + 再来一局 / 返回大厅按钮（图2 布局） */}
        {gameStatus === 'finished' && gameState.gameResult && (
          <div className="center-area">
            <div
              className={`center-result-banner ${
                gameState.gameResult.landlordWin ? 'landlord' : 'farmer'
              }`}
            >
              {gameState.gameResult.landlordWin ? '地主胜利' : '农民获胜'}
            </div>
            <div className="settlement-inline-actions">
              <button
                type="button"
                className="btn-replay"
                onClick={() => {
                  dispatch(prepareNextGame())
                  handleStartGame()
                }}
              >
                再来一局
              </button>
              <button
                type="button"
                className="btn-back-lobby"
                onClick={() => {
                  dispatch(prepareNextGame())
                  doLeaveRoom()
                }}
              >
                {autoReplayCountdown != null
                  ? `返回大厅（${autoReplayCountdown}秒）`
                  : '返回大厅'}
              </button>
            </div>
          </div>
        )}

        {/* 上方左右两家玩家区域 */}
        <div className="top-players">
          {leftPlayer && (
            <PlayerDisplay
              position="left"
              player={leftPlayer}
              gameStatus={gameStatus}
              isLandlord={landlordId === leftPlayer.id}
              isTurn={isLeftTurn}
              turnTimer={turnTimer}
              lastPlayed={lastPlayedCards}
              isPassed={!!passedPlayers[leftPlayer.id]}
              finalScore={leftPlayerScore?.finalScore}
              remainingCards={leftRemainingCards || undefined}
              parseCard={parseCard}
              renderPlayerAvatar={renderPlayerAvatar}
            />
          )}

        {rightPlayer && (
            <PlayerDisplay
              position="right"
              player={rightPlayer}
              gameStatus={gameStatus}
              isLandlord={landlordId === rightPlayer.id}
              isTurn={isRightTurn}
              turnTimer={turnTimer}
              lastPlayed={lastPlayedCards}
              isPassed={!!passedPlayers[rightPlayer.id]}
              finalScore={rightPlayerScore?.finalScore}
              remainingCards={rightRemainingCards || undefined}
              parseCard={parseCard}
              renderPlayerAvatar={renderPlayerAvatar}
            />
          )}

        {currentPlayer &&
          lastPlayedCards &&
          lastPlayedCards.playerId === currentPlayer.id &&
          lastPlayedCards.cards &&
          lastPlayedCards.cards.length > 0 && (
            <div className="played-cards-container bottom-player-played">
              {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                const { rank, suit, isJoker } = parseCard(cardStr)
                const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                return (
                  <motion.div
                    key={`${cardStr}-${index}`}
                    className={`card ${isRed ? 'red' : 'black'}`}
                    initial={{ opacity: 0, y: -160, scale: 0.6, rotate: -6 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, y: 40, scale: 0.9, rotate: 6 }}
                  >
                    <div
                      className={`card-value ${isJoker ? 'joker-text' : ''}`}
                      style={
                        isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined
                      }
                    >
                      {rank}
                    </div>
                    {!isJoker && <div className="card-suit">{suit}</div>}
                    {landlordId && (
                      <div
                        className={`card-landlord-mark ${
                          isBottomLandlord ? 'landlord' : 'farmer'
                        }`}
                      >
                        {isBottomLandlord ? '地主' : '农民'}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {currentPlayer && (
          <div className={`current-player-info ${isBottomTurn ? 'turn-active' : ''}`}>
            {/* 当前轮到的底部玩家信息 */}
            <div className="player-avatar-container">
              {landlordId === currentPlayer.id && (
                <div className="landlord-badge" title="地主">👑</div>
              )}
              <div className="player-avatar">{renderPlayerAvatar(currentPlayer.avatar)}</div>
            </div>
            <div className="player-info-below">
              <div className="player-coins">
                <span className="player-coins-icon" aria-hidden="true" />
                <span className="player-coins-text">
                  {bottomCoinValue >= 10000
                    ? `${(bottomCoinValue / 10000).toFixed(1)}万`
                    : bottomCoinValue.toLocaleString()}
                </span>
              </div>
            </div>
            {gameStatus === 'finished' && bottomPlayerScore && (
              <div
                className={`result-score-bottom ${
                  bottomPlayerScore.finalScore >= 0 ? 'win' : 'lose'
                }`}
              >
                {bottomPlayerScore.finalScore > 0
                  ? `+${bottomPlayerScore.finalScore}`
                  : bottomPlayerScore.finalScore}
              </div>
            )}
          </div>
        )}

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

      {/* 聊天面板 */}
      <ChatPanel
        visible={chatVisible}
        messages={chatMessages}
        currentMessage={chatMessage}
        onClose={toggleChat}
        onMessageChange={updateChatInput}
        onSend={handleSendChat}
      />

      {/* AI 出牌记录侧边面板 */}
      <AiHintPanel
        visible={showAiPanel}
        history={aiHintHistory}
        onClose={() => setShowAiPanel(false)}
        onClear={() => {
          setAiHintHistory([])
          aiHintCounterRef.current = 0
        }}
      />

      {/* 右下角：AI 面板 + 聊天按钮 */}
      {!chatVisible && !showAiPanel && (
        <div className="bottom-right-ui">
          {/* AI 面板入口按钮 */}
          {aiHintHistory.length > 0 && (
            <button 
              className="ai-toggle-btn"
              onClick={() => setShowAiPanel(true)}
              title="查看 AI 出牌记录"
            >
              AI
              {aiHintHistory.length > 0 && (
                <span className="ai-badge">{aiHintHistory.length}</span>
              )}
            </button>
          )}
          {/* 打开聊天侧边栏 */}
          <button 
            className="chat-toggle-btn"
            onClick={toggleChat}
            title="打开聊天"
          >
            💬
          </button>
        </div>
      )}

      {/* 结算面板 */}
      <SettlementPanel
        visible={false && showSettlement && !!gameState.gameResult}
        landlordWin={gameState.gameResult?.landlordWin || false}
        playerScores={settlementPlayerScores}
        currentUserId={user?.id || user?.name}
        onPlayAgain={() => {
          dispatch(prepareNextGame())
          closeSettlement()
          handleStartGame()
        }}
        onLeaveRoom={() => {
          dispatch(prepareNextGame())
          closeSettlement()
          doLeaveRoom()
        }}
      />
    </div>
  )
}
