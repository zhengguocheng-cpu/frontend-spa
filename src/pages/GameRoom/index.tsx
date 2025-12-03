import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from 'antd-mobile'
import { useAuth } from '@/context/AuthContext'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { useSocketStatus } from '@/hooks/useSocketStatus'
import { globalSocket } from '@/services/socket'
import type { RootState } from '@/store'
import { getLevelByScore } from '@/utils/playerLevel'
import { formatScore } from '@/utils/scoreFormatter'
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
import { motion, AnimatePresence } from 'framer-motion'
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

  // 全局 Socket 连接状态（用于本房间 UI 显示 & 事件监听控制）
  const { connected } = useSocketStatus()

  // Local state
  const [chatVisible, setChatVisible] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; message: string }>>([])
  const [showSettlement, setShowSettlement] = useState(false)
  // const [showDealingAnimation, setShowDealingAnimation] = useState(false)
  const [biddingTimer, setBiddingTimer] = useState(0)
  const [showBiddingUI, setShowBiddingUI] = useState(false)
  const biddingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 出牌相关状态
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [canPass, setCanPass] = useState(false)
  const [turnTimer, setTurnTimer] = useState(0)
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isDealingAnimation, setIsDealingAnimation] = useState(false)
  const dealAnimationTimeoutRef = useRef<number | null>(null)
  const playPendingRef = useRef(false)
  const [playPending, setPlayPending] = useState(false)
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  // 跟踪哪些玩家不出了（用于显示“不出”文字）
  const [passedPlayers, setPassedPlayers] = useState<{[playerId: string]: boolean}>({})
  const [dragSelectMode, setDragSelectMode] = useState<'select' | 'deselect' | null>(null)
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
  // 提示请求上下文（用于后端失败时回退到本地提示）
  const hintContextRef = useRef<{ myCards: string[]; lastCards: string[] | null } | null>(null)
  const autoFullHandPlayedRef = useRef(false)
  // 跟牌轮到自己时是否已经自动选中过一手提示牌
  const autoFollowHintAppliedRef = useRef(false)
  // 当前游戏中的炸弹 / 王炸数量（用于实时显示倍数）
  const [currentBombCount, setCurrentBombCount] = useState(0)
  const [currentRocketCount, setCurrentRocketCount] = useState(0)
  // 是否隐藏底牌（出牌后隐藏，但分数倍数继续显示）
  const [hideBottomCards, setHideBottomCards] = useState(false)
  
  // AI 提示历史记录
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
    setChatMessages((prev) => [...prev, { sender: '系统', message: text }])
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

  // 计算玩家位置（逆时针排列）
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

    // 找到当前玩家的索引
    const myIndex = filteredPlayers.findIndex(
      (p: any) => p.id === user.id || p.name === user.name
    )

    if (myIndex === -1) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    // 当前玩家（底部）
    const currentPlayer = filteredPlayers[myIndex]

    // 左侧玩家（上家，逆时针上一位）
    const leftPlayer = filteredPlayers.length >= 2
      ? filteredPlayers[(myIndex - 1 + filteredPlayers.length) % filteredPlayers.length]
      : null

    // 右侧玩家（下家，逆时针下一位）
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

  const isLeftLandlord = isLandlordPlayer(leftPlayer)
  const isRightLandlord = isLandlordPlayer(rightPlayer)
  const isBottomLandlord = isLandlordPlayer(currentPlayer)

  const landlordWinFlag = settlementScore?.landlordWin
  const centerResultText =
    gameStatus === 'finished' && typeof landlordWinFlag === 'boolean'
      ? landlordWinFlag
        ? '地主获胜'
        : '农民获胜'
      : ''

  const renderPlayerAvatar = (avatar: string | undefined) => {
    const raw = (avatar || '').trim()
    const match = raw.match(/^avatar-(\d+)$/)
    if (match) {
      const id = Number(match[1])
      if (!Number.isNaN(id) && id > 0) {
        return <div className={`avatar-sprite avatar-${id} avatar-sprite-small`} />
      }
    }
    // 兼容旧的 emoji / 字符头像
    return <span>{raw || '👤'}</span>
  }

  // 解析卡牌 - 照抄 frontend/public/room/js/room-simple.js 第 2065-2093 行
  const parseCard = (card: string) => {
    // 处理大小王 - 统一显示为大写 JOKER
    if (card === '大王' || card === '🃏大王' || card.includes('大王') || card.includes('JOKER')) {
      return { rank: 'JOKER', suit: '', isJoker: 'big' }
    }
    if (card === '小王' || card === '🃏小王' || card.includes('小王') || card.includes('joker')) {
      return { rank: 'JOKER', suit: '', isJoker: 'small' }
    }
    
    // 分离花色和数字
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
    
    const result = { rank, suit, isJoker: null as any }

    // 调试日志：如果点数不在预期集合内，输出完整原始字符串，排查“问/向”等异常牌面
    const validRanks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','JOKER']
    if (!validRanks.includes(result.rank)) {
      // 使用 warn 而不是 error，避免影响正常流程
      console.warn('⚠️ [parseCard] 异常牌面', {
        card,
        rank: result.rank,
        suit: result.suit,
      })
    }

    return result
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
    J: '勾',
    Q: '圈',
    K: '开',
    A: '尖',
    '2': '二',
    JOKER: '王',
  }

  const getSpokenRankFromRank = (rank: string | null | undefined): string => {
    if (!rank) return ''
    return RANK_SPOKEN_MAP[rank] || rank
  }

  const getSpokenRankFromCard = (card: string): string => {
    const parsed = parseCard(card)
    if (parsed.rank === 'JOKER') {
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
        // 单张：只读点数
        return getSpokenRankFromCard(cardList[0])
      }
      case 'pair': {
        // 对子：读“对”+点数
        const text = getSpokenRankFromCard(cardList[0])
        return text ? `对${text}` : null
      }
      default: {
        // 其余牌型不做语音播报
        return null
      }
    }
  }

  // 初始化房间
  useEffect(() => {
    // 如果没有用户信息，跳转到登录页
    if (!user) {
      console.warn('⚠️ 未登录，跳转到登录页')
      navigate('/login', { replace: true })
      return
    }
    
    if (!roomId) return

    console.log('🎮 进入游戏房间:', roomId)
    appendDebugMessage('FLOW', `进入游戏房间页面，roomId=${roomId}`)
    
    // 保存房间信息到 sessionStorage，用于重连（标签页隔离）
    sessionStorage.setItem('lastRoomId', roomId)
    sessionStorage.setItem('lastRoomTime', Date.now().toString())

    // 使用已有的 Socket 连接（登录时已建立）
    const socket = globalSocket.getSocket()
    if (!socket) {
      console.error('❌ Socket 未连接，请重新登录')
      navigate('/login', { replace: true })
      return
    }

    const gameSettings = getGameSettings()
    soundManager.setSoundEnabled(gameSettings.sfxEnabled)
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    }

    // 监听连接状态
    const handleConnect = () => {
      console.log('✅ Socket 已连接，准备加入房间')
      
      // 连接成功后立即加入房间
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    const handleDisconnect = () => {
      console.log('❌ Socket 已断开')
    }

    // 出牌提示结果（来自后端大模型）
    const handleHintResult = (data: any) => {
      console.log('💡 [提示结果] 收到后端提示结果:', data)

      const { success, cards, reason, analysis, winRate, error } = data || {}

      // 如果后端成功返回了推荐牌
      if (success && Array.isArray(cards)) {
        // 清空之前的选牌，只选中推荐牌
        if (cards.length > 0) {
          dispatch(clearSelection())
          ;(cards as string[]).forEach((card) => {
            dispatch(toggleCardSelection(card))
          })
        }

        // 追加到 AI 提示历史
        aiHintCounterRef.current += 1
        const newRecord: AiHintRecord = {
          id: aiHintCounterRef.current,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cards: cards as string[],
          reason,
          analysis,
          winRate,
          isPass: cards.length === 0,
        }
        setAiHintHistory(prev => [...prev, newRecord])
        setShowAiPanel(true)

        // 简短提示写入消息框
        appendSystemMessage(cards.length > 0 ? 'AI 提示：已为你选中推荐出牌' : 'AI 提示：建议不出')
        return
      }

      // 后端没有给出可用推荐或报错，回退到本地提示逻辑
      const ctx = hintContextRef.current
      const myCardsSnapshot = ctx?.myCards
      const lastCardsSnapshot = ctx?.lastCards ?? null

      console.warn('💡 [提示结果] 后端提示不可用，使用本地提示兜底。错误信息:', error)
      if (error) {
        appendSystemMessage(`AI 提示失败：${String(error)}`)
      }

      if (!myCardsSnapshot || myCardsSnapshot.length === 0) {
        console.log('💡 [提示兜底] 当前没有手牌或没有可用上下文')
        return
      }

      const fallbackHint = CardHintHelper.getHint(myCardsSnapshot, lastCardsSnapshot)
      if (!fallbackHint || fallbackHint.length === 0) {
        console.log('💡 [提示兜底] 没有可供提示的出牌方案')
        return
      }

      dispatch(clearSelection())
      fallbackHint.forEach((card) => {
        dispatch(toggleCardSelection(card))
      })

      console.log('💡 [提示兜底] 已为你选择一手本地推荐出牌:', fallbackHint)
    }

    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('hint_result', handleHintResult)

    // 如果已经连接，立即标记为已连接并加入房间
    if (socket.connected) {
      console.log('✅ Socket 已处于连接状态，直接加入房间')
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    // 初始化游戏状态
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
        appendDebugMessage('QUICK', `从点击“快速游戏”到进入房间页面总耗时 ${total}ms`)
      }

      if (!Number.isNaN(click) && !Number.isNaN(rooms)) {
        appendDebugMessage('QUICK', `从点击“快速游戏”到拿到房间列表耗时 ${rooms - click}ms`)
      }

      if (!Number.isNaN(rooms) && !Number.isNaN(join)) {
        appendDebugMessage('QUICK', `从拿到房间列表到发起 join_game 耗时 ${join - rooms}ms`)
      }
    } catch {
    }
  }, [user, roomId])

  // 监听游戏事件
  useEffect(() => {
    if (!connected) return

    const socket = globalSocket.getSocket()
    if (!socket) return
    
    console.log('🔍 [前端调试] 注册 Socket 事件监听器, Socket ID:', socket.id)

    // 房间加入成功
    const handleRoomJoined = (data: any) => {
      console.log('✅ 加入房间成功:', data)
      appendSystemMessage('已加入房间')
      const now = Date.now()
      quickFlowRef.current.roomJoinedAt = now
      appendDebugMessage('FLOW', 'room_joined 事件已收到')
    }

    // 加入游戏成功
    const handleJoinGameSuccess = (data: any) => {
      console.log('🎉 [加入游戏成功] 收到数据:', data)
      appendDebugMessage('ROOM', 'join_game_success 事件已收到')

      // 清空上一局状态，避免残留手牌
      dispatch(prepareNextGame())
      
      // 参考 frontend: onJoinGameSuccess
      if (data.room && data.room.players) {
        console.log('📋 [加入游戏成功] 房间玩家列表:', data.room.players)
        // 转换 ready 字段为 isReady，并确保包含 cardCount
        const players = data.room.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0
        }))
        console.log('✅ [加入游戏成功] 处理后的玩家列表:', players)
        dispatch(initGame({
          roomId: data.room.id,
          players: players,
        }))
      } else if (data.players) {
        console.log('📋 [加入游戏成功] 玩家列表（兼容模式）:', data.players)
        // 兼容旧版本
        const players = data.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0
        }))
        console.log('✅ [加入游戏成功] 处理后的玩家列表:', players)
        dispatch(updatePlayers(players))
      }
    }

    // 恢复游戏状态（重连）
    const handleGameStateRestored = (data: any) => {
      console.log('🔄 [恢复游戏状态] 收到数据:', data)
      appendSystemMessage('游戏状态已恢复，继续游戏')
      
      if (!data) return
      
      // 恢复玩家列表
      if (data.players && Array.isArray(data.players)) {
        console.log('📋 [恢复游戏状态] 玩家列表:', data.players)
        const players = data.players.map((p: any) => {
          const cardCount = p.cardCount || p.cards?.length || 0
          console.log(`  - 玩家 ${p.name}: cardCount=${p.cardCount}, cards.length=${p.cards?.length}, 最终=${cardCount}`)
          return {
            ...p,
            id: p.id || p.userId || p.name,
            isReady: true, // 游戏中都是准备状态
            cardCount: cardCount
          }
        })
        console.log('✅ [恢复游戏状态] 处理后的玩家列表:', players)
        dispatch(updatePlayers(players))
      }
      
      // 恢复当前玩家手牌
      const currentPlayerState = data.players?.find((p: any) => 
        p.id === user?.id || p.name === user?.name
      )
      
      if (currentPlayerState && currentPlayerState.cards) {
        dispatch(startGame({ myCards: currentPlayerState.cards }))
        console.log(`✅ 恢复手牌: ${currentPlayerState.cards.length}张`)
      }
      
      // 恢复地主信息
      if (data.landlordId) {
        dispatch(setLandlord({
          landlordId: data.landlordId,
          landlordCards: data.bottomCards || []
        }))
        console.log('✅ 恢复地主信息')
      }

      // 恢复最近一手出牌（用于桌面显示）
      if (data.lastPlay && data.lastPlay.playerId && Array.isArray(data.lastPlay.cards)) {
        const lastPlay = {
          playerId: data.lastPlay.playerId,
          playerName: data.lastPlay.playerName || data.lastPlay.playerId,
          cards: data.lastPlay.cards,
          type: data.lastPlay.type,
        }
        console.log('✅ [恢复游戏状态] 最近一手出牌:', lastPlay)
        dispatch(setLastPlayedFromState(lastPlay))
      } else {
        console.log('ℹ️ [恢复游戏状态] 没有可恢复的最近一手出牌')
      }
      
      // 恢复当前回合（复用 handleTurnToPlay 逻辑来设置倒计时等）
      if (data.currentPlayerId) {
        console.log('✅ [恢复游戏状态] 当前应出牌玩家:', data.currentPlayerId)
        const currentPlayerInfo = data.players?.find((p: any) =>
          p.id === data.currentPlayerId || p.name === data.currentPlayerId
        )
        handleTurnToPlay({
          playerId: data.currentPlayerId,
          playerName: currentPlayerInfo?.name || data.currentPlayerId,
          isFirst: data.isNewRound,
          lastPattern: data.lastPlayedCards,
        })
      }
      
      // 如果服务器发送了完整的玩家列表，使用它来更新
      if (data.players && Array.isArray(data.players)) {
        console.log('📋 收到完整玩家列表，更新房间玩家:', data.players)
        // 转换 ready 字段为 isReady
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready
        }))
        dispatch(updatePlayers(players))
      }
    }

    // 玩家加入
    const handlePlayerJoined = (data: any) => {
      console.log('👤 玩家加入:', data)

      // 将提示写入聊天消息框，仅在其他玩家加入时提示
      if (data.playerName && data.playerName !== user?.name) {
        setChatMessages((prev) => [
          ...prev,
          { sender: '系统', message: `${data.playerName} 加入房间` },
        ])
      }

      // 如果服务器发送了完整的玩家列表，使用它来更新
      if (data.players && Array.isArray(data.players)) {
        console.log('📋 收到完整玩家列表，更新房间玩家:', data.players)
        // 转换 ready 字段为 isReady
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
        }))
        dispatch(updatePlayers(players))
      }
    }

    // 玩家离开
    const handlePlayerLeft = (data: any) => {
      console.log('👋 玩家离开:', data)
      // 将提示写入聊天消息框，而不是使用大 Toast 遮挡牌面
      setChatMessages((prev) => [
        ...prev,
        { sender: '系统', message: `${data.playerName || '玩家'} 离开房间` },
      ])

      // 参考 frontend: onPlayerLeft
      // 如果服务器发送了完整的玩家列表，使用它来更新
      if (data.players && Array.isArray(data.players)) {
        console.log('📋 收到完整玩家列表（玩家离开）:', data.players)
        // 转换 ready 字段为 isReady
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready
        }))
        dispatch(updatePlayers(players))
      } else if (data.playerId) {
        // 兼容模式：有 playerId 但没有完整 players 列表时，从当前状态中移除该玩家
        console.log('📋 未收到完整玩家列表，仅根据 playerId 从本地状态移除玩家:', data.playerId)
        const filtered = (players || []).filter((p: any) => p.id !== data.playerId && p.userId !== data.playerId)
        dispatch(updatePlayers(filtered))
      }
    }

    // 玩家准备
    const handlePlayerReady = (data: any) => {
      console.log('✅ 玩家准备事件:', data)
      
      // 只在其他玩家准备时显示 Toast，避免自己准备时重复提示
      if (data.playerName) {
        setChatMessages((prev) => [
          ...prev,
          { sender: '系统', message: `${data.playerName} 已准备` },
        ])
      }
      
      // 参考 frontend: onPlayerReady
      // 如果服务器发送了完整的玩家列表，使用它来更新
      if (data.players && Array.isArray(data.players)) {
        console.log('📋 收到完整玩家列表（玩家准备）:')
        // 转换后端的 ready 字段为前端的 isReady 字段
        const players = data.players.map((p: any) => {
          const isReady = p.isReady !== undefined ? p.isReady : p.ready
          console.log(`  - ${p.name}: ready=${p.ready}, isReady=${isReady}`)
          return {
            ...p,
            isReady: isReady
          }
        })
        dispatch(updatePlayers(players))
      } else if (data.playerId) {
        // 兼容旧版本：只更新单个玩家状态
        console.log('📋 更新单个玩家状态:', data.playerId, 'isReady=true')
        dispatch(updatePlayerStatus({ playerId: data.playerId, isReady: true }))
      }
    }

    // 游戏开始
    const handleGameStarted = (data: any) => {
      console.log('🎮 游戏开始:', data)
      const now = Date.now()
      const joinedAt = quickFlowRef.current.roomJoinedAt
      if (joinedAt) {
        appendDebugMessage('FLOW', `从 room_joined 到 game_started 耗时 ${now - joinedAt}ms`)
      }
      quickFlowRef.current.gameStartedAt = now
      setShowSettlement(false)
      dispatch(prepareNextGame())
      // 重置炸弹计数和底牌显示状态
      setCurrentBombCount(0)
      setHideBottomCards(false)
      appendSystemMessage('🎮 游戏开始！所有玩家已准备完毕')
    }

    // 发牌事件（房间广播版本）
    const handleDealCardsAll = (data: any) => {
      console.log('🎯 [发牌事件-广播] 收到数据:', data)
      const now = Date.now()
      const startedAt = quickFlowRef.current.gameStartedAt
      if (startedAt) {
        appendDebugMessage('FLOW', `从 game_started 到 deal_cards_all 耗时 ${now - startedAt}ms`)
      }
      quickFlowRef.current.dealCardsAt = now
      
      // 找到当前玩家的牌
      const myCards = data.players?.find((p: any) => 
        p.playerId === user?.id || p.playerId === user?.name
      )
      
      if (myCards && myCards.cards && myCards.cards.length > 0) {
        console.log('🎴 找到我的牌，开始发牌，牌数:', myCards.cards.length)

        // 播放发牌音效
        soundManager.playSound('deal')
        
        // 更新手牌
        dispatch(startGame({ myCards: myCards.cards }))

        if (dealAnimationTimeoutRef.current) {
          clearTimeout(dealAnimationTimeoutRef.current)
        }
        setIsDealingAnimation(true)
        dealAnimationTimeoutRef.current = window.setTimeout(() => {
          setIsDealingAnimation(false)
        }, Math.min(1500, myCards.cards.length * 120 + 500))
        
        // 更新所有玩家的牌数
        if (data.players) {
          const playersWithInfo = data.players.map((p: any) => ({
            id: p.playerId || p.id,
            name: p.playerName || p.name,
            avatar: p.playerAvatar ?? p.avatar,
            isReady: p.playerReady ?? p.isReady ?? p.ready ?? true,
            position: p.position,
            cardCount: p.cardCount ?? p.cards?.length ?? 0,
            cards: p.cards ?? [],
          }))
          dispatch(updatePlayers(playersWithInfo))
          console.log('✅ 更新所有玩家牌数:', playersWithInfo)
        }
        
        appendSystemMessage('🎴 发牌完成，开始叫地主')
      } else {
        console.error('❌ 未找到我的牌数据，currentPlayerId:', user?.id || user?.name)
        console.error('❌ 所有玩家数据:', data.players)
      }
    }

    // 叫地主开始
    const handleBiddingStart = (data: any) => {
      console.log('🎲 开始叫地主:', data)
      const now = Date.now()
      const dealAt = quickFlowRef.current.dealCardsAt
      if (dealAt) {
        appendDebugMessage('FLOW', `从 deal_cards_all 到 bidding_start 耗时 ${now - dealAt}ms`)
      }
      quickFlowRef.current.biddingStartAt = now
      setChatMessages(prev => [
        ...prev,
        { sender: '系统', message: `🎲 开始叫地主！第一个玩家：${data.firstBidderName || '未知'}` }
      ])
      
      // 如果是当前玩家的回合，显示叫地主按钮和倒计时
      const currentUserId = user?.id || user?.name
      const currentUserName = user?.name || user?.id
      const isMyTurn =
        (!!data.firstBidderId && data.firstBidderId === currentUserId) ||
        (!!data.firstBidderName && data.firstBidderName === currentUserName)

      if (isMyTurn) {
        console.log('✅ 轮到我叫地主')
        setShowBiddingUI(true)
        
        // 启动倒计时（15秒）
        let timeLeft = 15
        setBiddingTimer(timeLeft)
        
        if (biddingTimerRef.current) {
          clearInterval(biddingTimerRef.current)
        }

        biddingTimerRef.current = setInterval(() => {
          timeLeft--
          setBiddingTimer(timeLeft)
          
          if (timeLeft <= 0) {
            if (biddingTimerRef.current) {
              clearInterval(biddingTimerRef.current)
              biddingTimerRef.current = null
            }
            setShowBiddingUI(false)
            // 自动不叫
            handleBid(false)
          }
        }, 1000)
      }
    }

    // 叫地主结果 - 照抄 frontend 逻辑
    const handleBidResult = (data: any) => {
      console.log('📢 叫地主结果:', data)
      
      // 显示叫地主结果
      const bidText = data.bid ? '抢' : '不抢'
      appendDebugMessage('BID', `bid_result 事件：${data.userName || '玩家'} ${bidText}`)
      setChatMessages(prev => [
        ...prev,
        { sender: '系统', message: `${data.userName || '玩家'} 选择：${bidText}` }
      ])
      
      // 隐藏当前玩家的叫地主按钮
      setShowBiddingUI(false)
      if (biddingTimerRef.current) {
        clearInterval(biddingTimerRef.current)
        biddingTimerRef.current = null
      }
      
      // 如果有下一个玩家，延迟后显示叫地主按钮
      if (data.nextBidderId) {
        setTimeout(() => {
          const currentUserId = user?.id || user?.name
          if (data.nextBidderId === currentUserId) {
            console.log('✅ 轮到我叫地主了！')
            setShowBiddingUI(true)
            setBiddingTimer(15)
            
            // 开始倒计时
            if (biddingTimerRef.current) {
              clearInterval(biddingTimerRef.current)
            }
            biddingTimerRef.current = setInterval(() => {
              setBiddingTimer(prev => {
                if (prev <= 1) {
                  clearInterval(biddingTimerRef.current!)
                  biddingTimerRef.current = null
                  // 自动选择不抢
                  handleBid(false)
                  return 0
                }
                return prev - 1
              })
            }, 1000)
          } else {
            console.log('⏳ 等待其他玩家叫地主...')
          }
        }, 1000) // 1秒延迟
      }
    }

    // 地主确定
    const handleLandlordDetermined = (data: any) => {
      console.log('👑 [地主确定] 收到事件:', data)
      console.log('👑 [地主确定] 地主ID:', data.landlordId)
      console.log('👑 [地主确定] 地主名称:', data.landlordName)
      console.log('👑 [地主确定] 底牌:', data.bottomCards)
      console.log('👑 [地主确定] 当前用户ID:', user?.id)
      console.log('👑 [地主确定] 当前用户名:', user?.name)
      appendDebugMessage('BID', 'landlord_determined 事件已收到')
      
      if (data.landlordId) {
        // 隐藏叫地主 UI
        setShowBiddingUI(false)
        if (biddingTimerRef.current) {
          clearInterval(biddingTimerRef.current)
          biddingTimerRef.current = null
        }
        
        // 判断自己是否是地主
        const isLandlord = data.landlordId === user?.id || 
                          data.landlordId === user?.name ||
                          data.landlordName === user?.name
        
        console.log('👑 [地主确定] 我是地主?', isLandlord)
        
        dispatch(setLandlord({
          landlordId: data.landlordId,
          landlordCards: data.bottomCards || [],
          landlordName: data.landlordName,
          landlordHand: data.landlordCards,
          landlordCardCount: data.landlordCardCount,
          isMe: isLandlord,
        }))
        
        console.log('✅ [地主确定] Redux action 已派发，gameStatus 应该已设置为 playing')
        
        setChatMessages(prev => [
          ...prev,
          { sender: '系统', message: `👑 ${data.landlordName || '玩家'} 成为地主！` }
        ])
        
        // 如果自己是地主，显示底牌并手动添加到手牌
        if (isLandlord) {
          console.log('✅ [地主确定] 我是地主，底牌:', data.bottomCards)
          setChatMessages(prev => [
            ...prev,
            { sender: '系统', message: `🎴 您是地主！获得 ${data.bottomCards?.length || 3} 张底牌` }
          ])
        }

        console.log('✅ [地主确定] 等待 turn_to_play 事件...')
      }
    }

    // 游戏状态更新
    const handleGameStateUpdated = (data: any) => {
      console.log('🔄 游戏状态更新:', data)
    }

    // 轮到出牌 - 照抄 frontend 逻辑，并增加“任意玩家头像倒计时”
    const handleTurnToPlay = (data: any) => {
      console.log('🎯 [轮到出牌] 收到事件:', data)
      console.log('🎯 [轮到出牌] 当前玩家ID:', user?.id)
      console.log('🎯 [轮到出牌] 事件中的玩家ID:', data.playerId)
      console.log('🎯 [轮到出牌] 当前 gameStatus:', gameStatus)
      
      if (data.playerId) {
        dispatch(setCurrentPlayer(data.playerId))

        const isMe = data.playerId === (user?.id || user?.name)

        if (isMe) {
          // 轮到我出牌
          setIsMyTurn(true)
          playPendingRef.current = false
          setPlayPending(false)

          // 每次轮到自己出牌时，重置提示索引和自动出牌/自动提示标记
          CardHintHelper.resetHintIndex()
          autoFullHandPlayedRef.current = false
          autoFollowHintAppliedRef.current = false
          
          // 判断是否可以不出
          // 如果是首次出牌或新一轮开始，不能不出
          const isFirst = data.isFirst
          const hasLastPattern = Boolean(data.lastPattern)
          const canPassNow = !isFirst && hasLastPattern
          setCanPass(canPassNow)
          
          console.log('🎯 [轮到出牌] 是否可以不出:', canPassNow)
          console.log('🎯 [轮到出牌] 首次出牌:', isFirst)
          console.log('🎯 [轮到出牌] 上家出牌:', lastPlayedCards)
          console.log('🎯 [轮到出牌] isMyTurn 已设置为 true')

          // 将提示写入聊天消息，而不是使用 Toast 或额外音效
          setChatMessages((prev) => [
            ...prev,
            { sender: '系统', message: '轮到你出牌了！' },
          ])
        } else {
          // 不是我的回合
          setIsMyTurn(false)
          setCanPass(false)

          const otherName = data.playerName || '玩家'
          setChatMessages((prev) => [
            ...prev,
            { sender: '系统', message: `等待 ${otherName} 出牌...` },
          ])
        }

        // 无论轮到谁，都启动头像上的倒计时
        const initialTime =
          typeof data.remainingTime === 'number' && data.remainingTime > 0
            ? data.remainingTime
            : 30
        setTurnTimer(initialTime)
        if (turnTimerRef.current) {
          clearInterval(turnTimerRef.current)
        }
        turnTimerRef.current = setInterval(() => {
          setTurnTimer((prev) => {
            if (prev <= 1) {
              clearInterval(turnTimerRef.current!)
              turnTimerRef.current = null
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }

    const handlePlayCardsFailed = (data: { error?: string }) => {
      console.log('🔍 [前端调试] 收到 play_cards_failed 事件')
      console.warn('❌ 出牌失败:', data)
      playPendingRef.current = false
      setPlayPending(false)

      const message = data?.error || '出牌失败，请重新选择'
      const notYourTurn = message.includes('还没轮到你出牌')

      if (notYourTurn) {
        setIsMyTurn(false)
        setCanPass(false)
      } else {
        setIsMyTurn(true)
        setPlayPending(false)
      }

      console.log('🔍 [前端调试] 显示错误提示:', message)
      appendSystemMessage(`出牌失败：${message}`)
    }

    // 回合变化
    const handleTurnChanged = (data: any) => {
      console.log('⏰ 回合变化:', data)
      if (data.currentPlayerId) {
        dispatch(setCurrentPlayer(data.currentPlayerId))
      }
    }

    // 出牌 - 照抄 frontend 逻辑
    const handleCardsPlayed = (data: any) => {
      console.log('🃏 玩家出牌:', data)
      console.log('🃏 出牌玩家:', data.playerName, '(', data.playerId, ')')
      console.log('🃏 出的牌:', data.cards)
      console.log('🃏 牌型:', data.cardType)
      
      if (data.playerId && data.cards) {
        // 播放出牌音效
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

        // 如果该牌型已经有独立 mp3 音效（如炸弹/王炸/飞机），则只播音效，不再播 TTS
        if (!hasDedicatedSound) {
          const voiceText = getPlayVoiceText(data.cardType, data.cards)
          if (voiceText) {
            soundManager.playVoice(voiceText)
          }
        }
        
        // 更新 Redux 状态
        dispatch(playCardsAction({
          playerId: data.playerId,
          playerName: data.playerName || data.playerId,
          cards: data.cards,
          type: data.cardType,
        }))

        const currentUserId = user?.id || user?.name
        const isCurrentUser = data.playerId === currentUserId || data.playerName === user?.name

        if (isCurrentUser) {
          setIsMyTurn(false)
          setCanPass(false)
          playPendingRef.current = false
          setPlayPending(false)
        }

        // 停止倒计时
        if (turnTimerRef.current) {
          clearInterval(turnTimerRef.current)
          turnTimerRef.current = null
        }
        setTurnTimer(0)

        // 清除已选牌
        dispatch(clearSelection())
        
        // 清除所有玩家的不出状态（因为有人出牌了）
        setPassedPlayers({})
        
        // 第一次出牌时隐藏底牌（但分数倍数继续显示）
        if (!hideBottomCards) {
          setHideBottomCards(true)
        }
        
        // 检测炸弹/王炸，更新计数（用于顶部倍数近似显示）
        const typeRawForBomb = (data.cardType?.type || data.cardType?.TYPE || '')
          .toString()
          .toLowerCase()
        if (typeRawForBomb === 'bomb') {
          setCurrentBombCount((prev) => prev + 1)
          console.log('💣 检测到炸弹，当前炸弹数:', currentBombCount + 1)
        } else if (typeRawForBomb === 'rocket') {
          setCurrentRocketCount((prev) => prev + 1)
          console.log('🃏 检测到王炸，当前王炸数:', currentRocketCount + 1)
        }
        
        if (data.playerId !== (user?.id || user?.name)) {
          const cardTypeDesc = data.cardType ? data.cardType.description : ''
          setChatMessages(prev => [
            ...prev,
            { sender: '系统', message: `${data.playerName} 出了 ${cardTypeDesc}` }
          ])
        }
      }
    }

    // 玩家不出
    const handlePlayerPassed = (data: any) => {
      console.log('⏭️ 玩家不出:', data)
      if (data.playerId) {
        // 播放不出/要不起音效（仅使用预置 mp3，不再额外播 TTS）
        soundManager.playPass()
        
        dispatch(passAction(data.playerId))
        // 记录该玩家不出，用于显示“不出”文字
        setPassedPlayers(prev => ({...prev, [data.playerId]: true}))
        // 添加到聊天消息
        setChatMessages(prev => [
          ...prev,
          { sender: '系统', message: `${data.playerName || '玩家'} 不出` },
        ])
      }
    }

    // 游戏结束 - 照抄 frontend 逻辑
    const handleGameEnded = (data: any) => {
      console.log('🎊 [游戏结束] 收到game_over事件:', data)
      
      // 停止倒计时
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current)
        turnTimerRef.current = null
      }
      
      // 隐藏出牌按钮
      setIsMyTurn(false)
      
      // 更新 Redux 状态
      dispatch(endGame(data))

      // 播放赢/输牌音效
      const myId = user?.id || user?.name
      const isWinner =
        !!myId && (data.winnerId === myId || data.winnerName === user?.name)
      if (isWinner) {
        // 胜利方：先播一次赢牌音效，然后切换到循环胜利音乐
        soundManager.playWin()
        soundManager.stopBackgroundMusic()
        soundManager.playVictoryMusic()
      } else {
        soundManager.playLose()
      }
      
      // 将游戏结束结果写入聊天消息框（不再使用 Toast 遮挡牌面）
      const winnerName = data.winnerName || '未知玩家'
      const role = data.winnerRole === 'landlord' ? '地主' : '农民'
      setChatMessages((prev) => [
        ...prev,
        {
          sender: '系统',
          message: `🎊 游戏结束！${winnerName}（${role}）获胜！`,
        },
      ])

      // 暂时不自动弹出结算弹窗，只在桌面展示结算结果
    }

    // 聊天消息
    const handleChatMessage = (data: any) => {
      console.log('💬 收到聊天消息:', data)
      if (data.playerName && data.message) {
        setChatMessages(prev => [...prev, {
          sender: data.playerName,
          message: data.message
        }])
      }
    }

    // 注册事件监听
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
    socket.on('game_over', handleGameEnded)  // 后端发送的是 game_over
    socket.on('game_ended', handleGameEnded)  // 兼容旧事件名
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

  // 进入房间后自动为当前玩家发送一次“准备”，等价于以前点击准备按钮
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
      console.log('🎮 [自动准备] 立即为当前玩家发送 player_ready', {
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

    console.log('🎮 [自动准备] 延迟自动准备以等待真人加入', {
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
      console.log('🎮 [自动准备] 到达延迟时间，为当前玩家发送 player_ready', {
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

  // 每次回到等待状态时，允许自动准备逻辑在新的一局重新生效
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

  // 结算阶段的自动离开逻辑由“再来一局/返回大厅”按钮接管，这里仅负责清理旧定时器
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

  // 自动出“整手牌就是完整牌型”的情况（只要这手牌在当前局面下是合法出牌）
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
    console.log('🎯 [自动出牌] 整手牌是完整牌型且当前可以合法出牌，自动出牌:', fullHandPattern)

    setTimeout(() => {
      doPlayCards(fullHandPattern)
    }, 500)
  }, [isMyTurn, myCards, lastPlayedCards, canPass])

  // 跟牌轮到自己时，自动选中一手本地提示牌（不直接出牌）
  useEffect(() => {
    if (!isMyTurn) return
    // 仅在可以“不出”的跟牌场景下自动选提示牌，首家出牌交给玩家自己决定
    if (!canPass) return
    if (autoFollowHintAppliedRef.current) return
    if (!myCards || myCards.length === 0) return

    const hasLastCards =
      !!lastPlayedCards &&
      !!lastPlayedCards.cards &&
      lastPlayedCards.cards.length > 0
    if (!hasLastCards) return

    const lastCards = lastPlayedCards!.cards as string[]
    const hint = CardHintHelper.getHint(myCards, lastCards)
    if (!hint || hint.length === 0) return

    autoFollowHintAppliedRef.current = true

    // 清空之前的选牌，只选中当前这手提示牌
    dispatch(clearSelection())
    hint.forEach((card) => {
      dispatch(toggleCardSelection(card))
    })
  }, [isMyTurn, canPass, myCards, lastPlayedCards, dispatch])

  useEffect(() => {
    if (!isMyTurn) return
    if (turnTimer !== 0) return

    console.log('⏰ [超时处理] 倒计时归零，isMyTurn=true, canPass=', canPass)

    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }

    if (canPass) {
      console.log('⏰ [超时处理] 可以不出，自动执行不出')
      handlePass()
    } else {
      // 必须出牌且超时：尝试自动按提示出一手牌（参考上家牌型）
      console.log('⏰ [超时处理] 必须出牌，尝试自动提示出牌')
      if (myCards.length === 0) {
        console.warn('⏰ [超时处理] 手牌为空，无法出牌')
        return
      }
      if (playPendingRef.current) {
        console.warn('⏰ [超时处理] 出牌操作进行中，跳过')
        return
      }

      const lastCards: string[] | null =
        lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
          ? lastPlayedCards.cards
          : null

      const autoHint = CardHintHelper.getHint(myCards, lastCards)
      console.log('⏰ [超时处理] 提示结果:', autoHint)
      
      if (autoHint && autoHint.length > 0) {
        console.log('⏰ [超时处理] 自动出牌:', autoHint)
        doPlayCards(autoHint)
        appendSystemMessage('⏰ 时间到，已为你自动出牌')
      } else {
        // 首轮出牌且没有可出的牌：强制出最小的一张牌
        console.error('⏰ [超时处理] 无可出牌型，强制出最小的一张牌避免卡死')
        const minCard = myCards[0] // 手牌已排序，第一张是最小的
        if (minCard) {
          console.log('⏰ [超时处理] 强制出最小牌:', minCard)
          doPlayCards([minCard])
          setChatMessages(prev => [
            ...prev,
            { sender: '系统', message: '⏰ 时间到，无可出牌型，已强制出最小的牌' }
          ])
        } else {
          console.error('⏰ [超时处理] 手牌为空或无法获取最小牌，游戏可能卡住')
          appendSystemMessage('⏰ 时间到，但没有可出的牌')
        }
      }
    }
  }, [turnTimer, isMyTurn, canPass])

  // 智能自动不出：当轮到自己出牌、可以不出、且没有任何牌能打过上家时，自动不出
  useEffect(() => {
    if (!isMyTurn || !canPass) return
    if (!myCards || myCards.length === 0) return
    
    // 检查是否有上家出的牌
    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null
    
    if (!lastCards) return // 没有上家牌，不自动不出
    
    // 使用 getAllHints 只检测“是否有能压过的牌”，避免消耗提示索引
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)
    
    // 如果没有任何提示（即没有牌能打过上家），自动不出
    if (!allHints || allHints.length === 0) {
      console.log('🤖 [智能不出] 没有牌能打过上家，自动不出')
      // 延迟1秒自动不出，给玩家一点思考时间
      setTimeout(() => {
        if (isMyTurn && canPass) {
          handlePass()
          setChatMessages(prev => [
            ...prev,
            { sender: '系统', message: '智能判断：没有牌能打过上家，已自动不出' }
          ])
        }
      }, 1000)
    }
  }, [isMyTurn, canPass, myCards, lastPlayedCards])

  // 离开房间 - 实际执行逻辑
  const doLeaveRoom = () => {
    if (roomId) {
      globalSocket.leaveGame(roomId)
    }
    // 返回大厅前停止胜利音乐
    soundManager.stopVictoryMusic()
    sessionStorage.removeItem('lastRoomId')
    sessionStorage.removeItem('lastRoomTime')
    dispatch(resetGame())
    navigate('/', { replace: true })
  }

  // 准备/开始游戏
  const handleStartGame = () => {
    if (!roomId || !user) return
    
    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('错误：Socket 未连接')
      return
    }
    
    // 如果积分不足，禁止再准备/再来一局
    if (walletScore !== null && walletScore <= 0) {
      appendSystemMessage('积分不足，请前往积分中心充值')
      return
    }

    // 再来一局前，停止胜利音乐并恢复背景音乐
    soundManager.stopVictoryMusic()
    const gameSettings = getGameSettings()
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    }

    // 找到当前玩家
    const currentPlayer = players.find((p: any) => 
      p.id === user.id || p.name === user.name
    )
    
    // 🔧 修复Bug：切换准备状态
    // 后端的togglePlayerReady会自动切换状态，所以前端也使用切换逻辑
    // 参考 frontend/public/room/js/room-simple.js 第 289-303 行
    const newReadyState = !currentPlayer?.isReady
    
    console.log('🎮 [准备] 切换状态', { 
      currentState: currentPlayer?.isReady,
      newState: newReadyState,
      playerName: user.name
    })
    
    // 立即更新本地状态（乐观更新）
    const playerId = user.id || user.name
    dispatch(updatePlayerStatus({ playerId, isReady: newReadyState }))
    
    // 发送准备事件（参数与 frontend 一致）
    socket.emit('player_ready', {
      roomId,
      userId: user.id || user.name,
    })
    
    console.log('🎮 [准备] 发送准备事件', { 
      roomId,
      userId: user.id || user.name,
    })
  }

  // 实际出牌请求发送逻辑
  const doPlayCards = (cardsToPlay: string[]) => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
      appendSystemMessage('错误：Socket 未连接，无法出牌')
      return
    }

    if (cardsToPlay.length === 0) {
      appendSystemMessage('请选择要出的牌')
      return
    }

    if (!isMyTurn) {
      appendSystemMessage('还没轮到你出牌')
      return
    }

    if (playPendingRef.current) {
      appendSystemMessage('正在等待服务器确认...')
      return
    }

    console.log('🎴 发送出牌请求:', cardsToPlay)

    playPendingRef.current = true
    setPlayPending(true)

    // 发送出牌请求
    socket.emit('play_cards', {
      roomId,
      userId: user.id || user.name,
      cards: cardsToPlay,
    })

    // 添加超时机制：如果3秒内没有收到响应，重置状态
    setTimeout(() => {
      if (playPendingRef.current) {
        console.warn('⚠️ 出牌请求超时，重置状态')
        playPendingRef.current = false
        setPlayPending(false)
        // 保持 isMyTurn 为 true，让玩家可以重新出牌
      }
    }, 3000)
  }

  // 出牌 - 照抄 frontend 逻辑，结合本地选牌/整手牌自动全出
  const handlePlayCards = () => {
    // 如果玩家没有主动选牌且整手牌本身就是一个完整牌型，自动全出
    let cardsToPlay = selectedCards
    if (cardsToPlay.length === 0) {
      const autoFullHand = CardHintHelper.getFullHandIfSinglePattern(myCards)
      if (autoFullHand && autoFullHand.length === myCards.length) {
        cardsToPlay = autoFullHand
      }
    }

    doPlayCards(cardsToPlay)
  }

  // 不出 - 照抄 frontend 逻辑
  const handlePass = () => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
      appendSystemMessage('错误：Socket 未连接，无法执行不出')
      return
    }

    if (!isMyTurn) {
      appendSystemMessage('还没轮到你出牌，不能不出')
      return
    }

    if (!canPass) {
      appendSystemMessage('当前轮次不能不出')
      return
    }

    // 执行不出前，清空所有已选中的牌
    dispatch(clearSelection())

    console.log(' 发送不出请求')

    // 发送不出请求
    socket.emit('pass_turn', {
      roomId,
      userId: user.id || user.name,
    })

    // 停止倒计时
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }

    // 隐藏出牌按钮
    setIsMyTurn(false)
  }

  // 叫地主 - 照抄 frontend，使用 boolean
  const handleBid = (bid: boolean) => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
      appendSystemMessage('错误：Socket 未连接，无法抢地主')
      return
    }

    // 停止倒计时并隐藏抢地主按钮
    if (biddingTimerRef.current) {
      clearInterval(biddingTimerRef.current)
      biddingTimerRef.current = null
    }
    setShowBiddingUI(false)
    setBiddingTimer(0)

    // 只有抢地主时才播放音效
    if (bid) {
      soundManager.playBid()
    }

    // 发送抢地主请求
    socket.emit('bid', {
      roomId,
      userId: user.id || user.name,
      bid: bid, // true = 抢，false = 不抢
    })

    // 显示消息到聊天框
    const bidText = bid ? '抢地主' : '不抢'
    appendSystemMessage(`您选择：${bidText}`)
  }

  // 提示 - 先用本地 CardHintHelper 计算候选
  // 规则：
  // 1) 跟牌且 canPass，为 0 个候选时，自动不出，不调用大模型
  // 2) 只有 1 个候选时，直接选中该组合，不调用大模型
  // 3) 候选 >= 2 时，再调用后端大模型做进一步分析
  const handleHint = () => {
    // 播放提示音效
    soundManager.playHint()

    if (!isMyTurn) {
      console.log('💡 [提示] 还没轮到你出牌，忽略提示操作')
      return
    }

    if (!roomId || !user) {
      appendSystemMessage('房间信息或用户信息缺失，无法请求提示')
      return
    }

    if (myCards.length === 0) {
      console.log('💡 [提示] 当前没有手牌')
      return
    }

    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('错误：Socket 未连接，无法请求出牌提示')
      return
    }

    // 根据当前是否允许“不要”，决定是否参考上家牌型
    // canPass === false 视为新一轮首家出牌，不参考 lastPlayedCards
    const isFollowPlay =
      !!lastPlayedCards && !!lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && canPass
    const lastCards: string[] | null = isFollowPlay ? (lastPlayedCards!.cards as string[]) : null

    // 先用本地提示系统计算所有候选
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)
    console.log('💡 [提示] 本地候选出牌列表:', allHints)

    // 情况 1：跟牌且可不出，但本地没有任何能压过上家的牌 → 直接不出
    if (isFollowPlay && canPass && (!allHints || allHints.length === 0)) {
      console.log('🤖 [提示] 本地判断没有牌能压过上家，直接执行不出，不调用大模型')
      handlePass()
      appendSystemMessage('智能判断：没有牌能压过上家，已自动不出')
      return
    }

    // 情况 2：只有一个本地候选 → 直接选中，不调用大模型
    if (allHints && allHints.length === 1) {
      const onlyHint = allHints[0]
      console.log('🤖 [提示] 仅有一个本地候选，直接选中:', onlyHint)

      dispatch(clearSelection())
      onlyHint.forEach((card) => dispatch(toggleCardSelection(card)))

      appendSystemMessage('已根据本地算法选出唯一推荐出牌')
      return
    }

    // 情况 3：候选 >= 2
    const llmSettings = getLlmSettings()

    // 3.a 如果玩家在设置里关闭了大模型提示，则完全使用本地循环提示
    if (!llmSettings.enabled) {
      console.log('💡 [提示] 大模型提示已关闭，使用本地循环提示逻辑')
      const localHint = CardHintHelper.getHint(myCards, lastCards)
      if (!localHint || localHint.length === 0) {
        console.log('💡 [提示] 本地循环提示也没有找到合适出牌方案')
        return
      }

      dispatch(clearSelection())
      localHint.forEach((card) => dispatch(toggleCardSelection(card)))
      appendSystemMessage('已根据本地算法选出推荐出牌')
      return
    }

    // 3.b 候选 >= 2，且启用了大模型提示 → 调用后端做深入分析

    // 记录本次提示请求的上下文，便于后端失败时兜底
    hintContextRef.current = {
      myCards: [...myCards],
      lastCards: lastCards ? [...lastCards] : null,
    }

    console.log('💡 [提示] 候选 >= 2，向后端请求出牌提示:', {
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

  // 根据目标状态更新某张牌是否选中（避免重复 toggle）
  const updateCardSelection = (cardStr: string, shouldSelect: boolean) => {
    const isSelected = selectedCards.includes(cardStr)
    if (shouldSelect && !isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }
      console.log('✅ 选中:', cardStr)
    } else if (!shouldSelect && isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }
      console.log('❌ 取消选中:', cardStr)
    }
  }

  // 记录上次处理的卡牌，避免重复处理
  const lastProcessedCardRef = useRef<string | null>(null)
  const lastSoundTimeRef = useRef<number>(0)

  // 指针按下：开始拖选或单选
  // 简化逻辑：移除跟牌阶段的智能选牌，让用户可以自由拖选
  const handleCardPointerDown = (cardStr: string, ev: any) => {
    ev.preventDefault()
    ev.stopPropagation()
    
    // 捕获指针，确保后续事件都发送到这个元素
    if (ev.target && ev.target.setPointerCapture) {
      try {
        ev.target.releasePointerCapture(ev.pointerId)
      } catch (e) {
        // 忽略释放失败
      }
    }
    
    console.log('🎴 PointerDown 手牌:', cardStr)

    // 默认：按单张牌进行选中/取消，并可继续拖选
    const isSelected = selectedCards.includes(cardStr)
    const mode: 'select' | 'deselect' = isSelected ? 'deselect' : 'select'

    setIsDragSelecting(true)
    setDragSelectMode(mode)
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, mode === 'select')
  }

  // 指针滑过其它牌：根据当前模式批量选中/取消
  const handleCardPointerEnter = (cardStr: string, ev: any) => {
    if (!isDragSelecting || !dragSelectMode) return
    if (lastProcessedCardRef.current === cardStr) return // 避免重复处理
    
    ev.preventDefault()
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, dragSelectMode === 'select')
  }

  // 指针移动：用于触摸设备上的滑动选牌
  const handleHandPointerMove = (ev: React.PointerEvent) => {
    if (!isDragSelecting || !dragSelectMode) return
    
    // 获取当前触摸/鼠标位置下的元素
    const element = document.elementFromPoint(ev.clientX, ev.clientY)
    if (!element) return
    
    // 向上查找卡牌元素
    const cardElement = element.closest('.card') as HTMLElement
    if (!cardElement) return
    
    // 从 data 属性或 key 获取卡牌标识
    const cardKey = cardElement.getAttribute('data-card')
    if (!cardKey || lastProcessedCardRef.current === cardKey) return
    
    lastProcessedCardRef.current = cardKey
    updateCardSelection(cardKey, dragSelectMode === 'select')
  }

  // 指针抬起或离开手牌区域：结束拖选
  const handleHandPointerUp = () => {
    if (!isDragSelecting) return
    setIsDragSelecting(false)
    setDragSelectMode(null)
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
      setChatMessage('')
    }
  }

  // 监控 gameStatus 变化
  useEffect(() => {
    console.log('🎮 [状态监控] gameStatus 变化:', gameStatus)
  }, [gameStatus])

  // 监控 isMyTurn 变化
  useEffect(() => {
    console.log('🎮 [状态监控] isMyTurn 变化:', isMyTurn)
  }, [isMyTurn])

  // 监控 players 变化
  useEffect(() => {
    console.log('🎮 [状态监控] players 变化:', players)
    players.forEach((p: any) => {
      console.log(`  - ${p.name}: cardCount=${p.cardCount}`)
    })
  }, [players])

  // 动态计算手牌遮挡宽度（根据手牌区宽度自动计算）
  useEffect(() => {
    const calculateCardOverlap = () => {
      const handSection = document.querySelector('.player-hand-section') as HTMLElement | null
      const cards = document.querySelectorAll('.player-hand .card')
      
      if (!handSection || cards.length === 0) return
      
      // 使用外层 .player-hand-section 的宽度作为手牌区域宽度 W，保证始终以完整可见区域为基准
      const containerWidth = handSection.clientWidth // 手牌区宽度 W
      const n = myCards.length || cards.length       // 牌数 n（优先使用状态中的手牌数）
      const cardWidth = (cards[0] as HTMLElement).offsetWidth         // 单张牌真实宽度（含边框） w

      if (n <= 1 || cardWidth <= 0 || containerWidth <= cardWidth) {
        return
      }

      // 你的思路：总宽度固定为 W，先算出一套重叠规则，之后出牌就把释放出来的空间均匀摊给剩余牌
      // 这里直接用数学形式实现：
      //  M = W - w（第一张牌完全显示，剩余 M 给后面 n-1 张牌）
      //  每张后续牌可见空间 visibleWidth = M / (n-1)
      //  overlap = visibleWidth - w（负值表示重叠）
      const availableWidth = containerWidth - cardWidth
      const visibleWidth = availableWidth / (n - 1)

      // overlap = 每张牌可见空间 - 实际牌宽度
      // 当 n 减少时，visibleWidth 变大，overlap 变得没那么负 ⇒ 重叠自然减小、看起来更舒展
      let overlap = visibleWidth - cardWidth

      // 限制遮挡范围：
      // 1）最多遮挡 85%，防止牌很多时挤成一条线
      // 2）最少遮挡 20%，防止牌全部铺开（overlap 接近 0 或为正数）
      const maxOverlapAbs = cardWidth * 0.85   // 上限：85%
      const minOverlapAbs = cardWidth * 0.2    // 下限：20%

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
      console.log('🎴 手牌遮挡计算:', {
        容器宽度: containerWidth,
        牌数: n,
        DOM牌数: cards.length,
        牌宽: cardWidth,
        每张可见空间: visibleWidth,
        遮挡宽度: overlap,
        实际总宽度: actualTotalWidth,
      })
    }
    
    // 延迟执行，确保 DOM 已渲染
    const timer = setTimeout(calculateCardOverlap, 100)
    
    // 监听窗口大小变化
    window.addEventListener('resize', calculateCardOverlap)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', calculateCardOverlap)
    }
  }, [myCards]) // 手牌变化时重新计算

  // 加载当前用户的钱包积分（金币总数），用于段位与金币展示
  useEffect(() => {
    if (!user) {
      setWalletScore(null)
      return
    }

    const controller = new AbortController()

    const loadWallet = async () => {
      try {
        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        const res = await fetch(
          `${baseUrl}/api/score/${encodeURIComponent(user.id)}`,
          {
            signal: controller.signal,
          },
        )

        let json: any = null
        try {
          json = await res.json()
        } catch {
          // ignore body parse error
        }

        if (!res.ok || !json?.success || !json.data) {
          console.warn('GameRoom 加载钱包失败或返回结构异常:', res.status, json?.message)
          setWalletScore(0)
          return
        }

        const data = json.data
        const scoreValue = typeof data.totalScore === 'number' ? data.totalScore : 0
        setWalletScore(scoreValue)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('GameRoom 加载钱包失败:', err)
        setWalletScore(0)
      }
    }

    loadWallet()

    return () => {
      controller.abort()
    }
  }, [user])

  // 将当前房间内加载到的积分同步到 sessionStorage，便于其他页面做积分校验
  useEffect(() => {
    if (walletScore == null) return
    try {
      sessionStorage.setItem('lastWalletScore', String(walletScore))
    } catch {
      // ignore storage error
    }
  }, [walletScore])

  const formatAmount = (value: number | null) => {
    const safe = typeof value === 'number' && value >= 0 ? value : 0
    return formatScore(safe)
  }

  const { name: currentLevelName, icon: currentLevelIcon } = getLevelByScore(walletScore)
  const currentCoinsText = formatAmount(walletScore)

  // 游戏结束后在桌面上显示“再来一局(倒计时)”和“返回大厅”
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      // 进入结算状态：清空 AI 提示历史，启动 30 秒倒计时
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
            // 倒计时结束，自动再来一局
            window.clearInterval(autoReplayTimerRef.current as number)
            autoReplayTimerRef.current = null

            // 直接触发再来一局，相当于点击按钮
            dispatch(prepareNextGame())
            handleStartGame()

            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // 离开结算状态：清理倒计时
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

  return (
    <div className="game-room-container">
      {/* 游戏桌面 */}
      <div className="game-table">
        {/* 底牌和分数倍数显示区域 - 桌面顶端中间 */}
        {/* 分数倍数在确定地主后一直显示，底牌在出牌后隐藏 */}
        {landlordId && (
          <div className="bottom-cards-display">
            <div className="bottom-info-bar">
              {/* 底牌：出牌前显示，出牌后隐藏 */}
              {!hideBottomCards && landlordCards.length > 0 && (
                <div className="bottom-cards-container">
                  {landlordCards.map((cardStr: string, index: number) => {
                    const { rank, suit, isJoker } = parseCard(cardStr)
                    const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'

                    return (
                      <div key={index} className={`bottom-card ${isRed ? 'red' : 'black'}`}>
                        <div
                          className={`card-value ${isJoker ? 'joker-text' : ''}`}
                          style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                        >
                          {rank}
                        </div>
                        {!isJoker && <div className="card-suit">{suit}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
              {/* 分数倍数：确定地主后一直显示，字体稍小，与积分系统对齐 */}
              <div className="bottom-meta compact">
                <span>基数: {settlementScore?.baseScore ?? 5000}</span>
                <span>
                  倍数: ×
                  {bottomPlayerScore?.multipliers?.total ??
                    Math.max(1, Math.pow(3, currentBombCount) * Math.pow(8, currentRocketCount))}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 上方玩家区域 */}
        <div className="top-players">
          {leftPlayer && (
            <div className={`player-slot left ${isLeftTurn ? 'turn-active' : ''}`}>
              {isLeftTurn && turnTimer > 0 && (
                <div className="turn-indicator">{turnTimer}</div>
              )}
              <div className={`player-info ${landlordId === leftPlayer.id ? 'landlord' : ''}`}>
                {landlordId === leftPlayer.id && (
                  <div className="landlord-badge" title="地主">👑</div>
                )}
                <div className="player-avatar">{renderPlayerAvatar(leftPlayer.avatar)}</div>
                <div>
                  <div className="player-name">{leftPlayer.name}</div>
                  <div className="player-status">
                    {gameStatus === 'waiting'
                      ? (leftPlayer.isReady ? '✅ 已准备' : '⏳ 未准备')
                      : `${leftPlayer.cardCount || 0} 张`}
                  </div>
                  {passedPlayers[leftPlayer.id] && (
                    <div className="player-passed">不出</div>
                  )}
                </div>
              </div>
              {gameStatus === 'finished' && leftPlayerScore && (
                <div
                  className={`result-score ${
                    leftPlayerScore.finalScore >= 0 ? 'win' : 'lose'
                  }`}
                >
                  {leftPlayerScore.finalScore > 0
                    ? `+${leftPlayerScore.finalScore}`
                    : leftPlayerScore.finalScore}
                </div>
              )}
              <div className="played-cards-area">
                {gameStatus === 'finished' && leftRemainingCards && leftRemainingCards.length > 0 ? (
                  <div className="played-cards-container remaining-cards">
                    {leftRemainingCards.map((cardStr: string, index: number) => {
                      const { rank, suit, isJoker } = parseCard(cardStr)
                      const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
                          <div
                            className={`card-value ${isJoker ? 'joker-text' : ''}`}
                            style={
                              isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined
                            }
                          >
                            {isJoker ? 'JOKER' : rank}
                          </div>
                          {!isJoker && <div className="card-suit">{suit}</div>}
                          {landlordId && (
                            <div
                              className={`card-landlord-mark ${
                                isLeftLandlord ? 'landlord' : 'farmer'
                              }`}
                            >
                              {isLeftLandlord ? '地主' : '农民'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : passedPlayers[leftPlayer.id] ? (
                  <div className="pass-text">不出</div>
                ) : (
                  lastPlayedCards &&
                  lastPlayedCards.playerId === leftPlayer.id && (
                    <div className="played-cards-container last-played">
                      {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                        const { rank, suit, isJoker } = parseCard(cardStr)
                        const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                        return (
                          <motion.div
                            key={index}
                            className={`card ${isRed ? 'red' : 'black'}`}
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 0.85 }}
                            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
                            transition={{
                              delay: index * 0.03,
                              type: 'spring',
                              stiffness: 280,
                              damping: 20,
                            }}
                          >
                            <div
                              className={`card-value ${isJoker ? 'joker-text' : ''}`}
                              style={
                                isJoker
                                  ? { color: isJoker === 'big' ? '#d32f2f' : '#000' }
                                  : undefined
                              }
                            >
                              {isJoker ? 'JOKER' : rank}
                            </div>
                            {!isJoker && <div className="card-suit">{suit}</div>}
                            {landlordId && (
                              <div
                                className={`card-landlord-mark ${
                                  isLeftLandlord ? 'landlord' : 'farmer'
                                }`}
                              >
                                {isLeftLandlord ? '地主' : '农民'}
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {rightPlayer && (
            <div className={`player-slot right ${isRightTurn ? 'turn-active' : ''}`}>
              {isRightTurn && turnTimer > 0 && (
                <div className="turn-indicator">{turnTimer}</div>
              )}
              <div className={`player-info ${landlordId === rightPlayer.id ? 'landlord' : ''}`}>
                {landlordId === rightPlayer.id && (
                  <div className="landlord-badge" title="地主">👑</div>
                )}
                <div className="player-avatar">{renderPlayerAvatar(rightPlayer.avatar)}</div>
                <div>
                  <div className="player-name">{rightPlayer.name}</div>
                  <div className="player-status">
                    {gameStatus === 'waiting'
                      ? (rightPlayer.isReady ? '✅ 已准备' : '⏳ 未准备')
                      : `${rightPlayer.cardCount || 0} 张`}
                  </div>
                  {passedPlayers[rightPlayer.id] && (
                    <div className="player-passed">不出</div>
                  )}
                </div>
              </div>
              {gameStatus === 'finished' && rightPlayerScore && (
                <div
                  className={`result-score ${
                    rightPlayerScore.finalScore >= 0 ? 'win' : 'lose'
                  }`}
                >
                  {rightPlayerScore.finalScore > 0
                    ? `+${rightPlayerScore.finalScore}`
                    : rightPlayerScore.finalScore}
                </div>
              )}
              <div className="played-cards-area">
                {gameStatus === 'finished' && rightRemainingCards && rightRemainingCards.length > 0 ? (
                  <div className="played-cards-container remaining-cards">
                    {rightRemainingCards.map((cardStr: string, index: number) => {
                      const { rank, suit, isJoker } = parseCard(cardStr)
                      const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
                          <div
                            className={`card-value ${isJoker ? 'joker-text' : ''}`}
                            style={
                              isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined
                            }
                          >
                            {isJoker ? 'JOKER' : rank}
                          </div>
                          {!isJoker && <div className="card-suit">{suit}</div>}
                          {landlordId && (
                            <div
                              className={`card-landlord-mark ${
                                isRightLandlord ? 'landlord' : 'farmer'
                              }`}
                            >
                              {isRightLandlord ? '地主' : '农民'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : passedPlayers[rightPlayer.id] ? (
                  <div className="pass-text">不出</div>
                ) : (
                  lastPlayedCards &&
                  lastPlayedCards.playerId === rightPlayer.id && (
                    <div className="played-cards-container last-played">
                      {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                        const { rank, suit, isJoker } = parseCard(cardStr)
                        const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                        return (
                          <motion.div
                            key={index}
                            className={`card ${isRed ? 'red' : 'black'}`}
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 0.85 }}
                            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
                            transition={{
                              delay: index * 0.03,
                              type: 'spring',
                              stiffness: 280,
                              damping: 20,
                            }}
                          >
                            <div
                              className={`card-value ${isJoker ? 'joker-text' : ''}`}
                              style={
                                isJoker
                                  ? { color: isJoker === 'big' ? '#d32f2f' : '#000' }
                                  : undefined
                              }
                            >
                              {isJoker ? 'JOKER' : rank}
                            </div>
                            {!isJoker && <div className="card-suit">{suit}</div>}
                            {landlordId && (
                              <div
                                className={`card-landlord-mark ${
                                  isRightLandlord ? 'landlord' : 'farmer'
                                }`}
                              >
                                {isRightLandlord ? '地主' : '农民'}
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部（当前玩家）出牌区 - 在手牌上方 */}
        <div className="center-area">
          {gameStatus === 'finished' && centerResultText && (
            <div
              className={`center-result-banner ${
                landlordWinFlag ? 'landlord' : 'farmer'
              }`}
            >
              {centerResultText}
            </div>
          )}

          {/* 结算阶段：在大字下方显示再来一局 / 返回大厅按钮 */}
          {gameStatus === 'finished' && gameState.gameResult && (
            <div className="settlement-inline-actions">
              <button
                type="button"
                className="btn-replay"
                onClick={() => {
                  if (autoReplayTimerRef.current != null) {
                    window.clearInterval(autoReplayTimerRef.current)
                    autoReplayTimerRef.current = null
                  }
                  setAutoReplayCountdown(null)
                  dispatch(prepareNextGame())
                  handleStartGame()
                }}
              >
                再来一局{typeof autoReplayCountdown === 'number' && autoReplayCountdown > 0
                  ? `（${autoReplayCountdown}秒）`
                  : ''}
              </button>
              <button
                type="button"
                className="btn-back-lobby"
                onClick={() => {
                  if (autoReplayTimerRef.current != null) {
                    window.clearInterval(autoReplayTimerRef.current)
                    autoReplayTimerRef.current = null
                  }
                  setAutoReplayCountdown(null)
                  dispatch(prepareNextGame())
                  doLeaveRoom()
                }}
              >
                返回大厅
              </button>
            </div>
          )}

          {currentPlayer && (
            <div className="played-cards-area bottom-player-cards">
              {gameStatus !== 'finished' &&
                lastPlayedCards &&
                lastPlayedCards.playerId === currentPlayer.id &&
                lastPlayedCards.cards &&
                lastPlayedCards.cards.length > 0 && (
                  <div className="played-cards-container">
                    {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                      const { rank, suit, isJoker } = parseCard(cardStr)
                      const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                      return (
                        <motion.div
                          key={`${cardStr}-${index}`}
                          className={`card ${isRed ? 'red' : 'black'}`}
                          initial={{ opacity: 0, y: -160, scale: 0.6, rotate: -6 }}
                          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                          exit={{
                            opacity: 0,
                            y: 40,
                            scale: 0.9,
                            rotate: 6,
                            transition: { duration: 0.2 },
                          }}
                          transition={{
                            y: {
                              delay: isDealingAnimation ? index * 0.05 : 0,
                              type: 'spring',
                              stiffness: 280,
                              damping: 22,
                            },
                            opacity: {
                              delay: isDealingAnimation ? index * 0.05 : 0,
                              duration: 0.16,
                            },
                          }}
                        >
                          <div
                            className={`card-value ${isJoker ? 'joker-text' : ''}`}
                            style={
                              isJoker
                                ? { color: isJoker === 'big' ? '#d32f2f' : '#000' }
                                : undefined
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
          )}
        </div>

        {/* 当前玩家信息 - 左下角 */}
        {currentPlayer && (
          <div className={`current-player-info ${isBottomTurn ? 'turn-active' : ''}`}>
            <div className="player-avatar-container">
              {landlordId === currentPlayer.id && (
                <div className="landlord-badge" title="地主">👑</div>
              )}
              <div className="player-avatar">{renderPlayerAvatar(currentPlayer.avatar)}</div>
              {isBottomTurn && <div className="turn-indicator">{turnTimer}</div>}
            </div>
            <div className="player-info-below">
              <div className="player-level">
                <span className="player-level-icon">{currentLevelIcon}</span>
                <span className="player-level-text">{currentLevelName}</span>
              </div>
              <div className="player-coins">
                <span className="player-coins-icon">💰</span>
                <span className="player-coins-text">{currentCoinsText}</span>
              </div>
              {user && passedPlayers[user.id || user.name || ''] && (
                <div className="player-passed">不出</div>
              )}
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

        {/* 手牌区域 - 照抄 frontend 结构 */}
        {myCards.length > 0 && (
          <div
            className="player-hand-section"
            onPointerUp={handleHandPointerUp}
            onPointerLeave={handleHandPointerUp}
            onPointerMove={handleHandPointerMove}
          >
            <div className="player-hand">
              <AnimatePresence initial={false}>
                {myCards.map((cardStr: string, index: number) => {
                  const { rank, suit, isJoker } = parseCard(cardStr)
                  const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                  const isSelected = selectedCards.some((c: any) => c === cardStr)
                  const targetY = isSelected ? -26 : 0

                  return (
                    <motion.div
                      key={`${cardStr}-${index}`}
                      data-card={cardStr}
                      className={`card ${isRed ? 'red' : 'black'} ${
                        isSelected ? 'selected' : ''
                      }`}
                      style={{ zIndex: index + 1 }}
                      onPointerDown={(ev) => handleCardPointerDown(cardStr, ev)}
                      onPointerEnter={(ev) => handleCardPointerEnter(cardStr, ev)}
                      layout
                      initial={
                        isDealingAnimation
                          ? { opacity: 0, y: -160, scale: 0.6, rotate: -6 }
                          : false
                      }
                      animate={{ opacity: 1, y: targetY, scale: 1, rotate: 0 }}
                      exit={{
                        opacity: 0,
                        y: 40,
                        scale: 0.9,
                        rotate: 6,
                        transition: { duration: 0.2 },
                      }}
                      transition={{
                        y: {
                          delay: isDealingAnimation ? index * 0.05 : 0,
                          type: 'spring',
                          stiffness: 280,
                          damping: 22,
                        },
                        opacity: {
                          delay: isDealingAnimation ? index * 0.05 : 0,
                          duration: 0.16,
                        },
                      }}
                    >
                      <div
                        className={`card-value ${isJoker ? 'joker-text' : ''}`}
                        style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
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
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 控制按钮 */}
        <div className="game-controls">
          {/* 等待中提示 */}
          {gameStatus === 'waiting' && (
            <div className="waiting-controls">
              <span className="waiting-text">等待其他玩家准备...</span>
            </div>
          )}

          {/* 抢地主 UI - 只保留倒计时与两个按钮，不再显示提示文字 */}
          {gameStatus === 'bidding' && showBiddingUI && (
            <div className="bidding-actions" id="biddingActions">
              <div className="bidding-timer" id="biddingTimer">{biddingTimer}</div>
              <div className="bidding-buttons bidding-controls">
                <Button 
                  color="warning" 
                  size="large"
                  onClick={() => handleBid(true)}
                >
                  抢地主
                </Button>
                <Button 
                  color="default" 
                  size="large"
                  onClick={() => handleBid(false)}
                >
                  不抢
                </Button>
              </div>
            </div>
          )}

          {/* 出牌 UI - 使用原生 button，避免组件层面渲染异常 */}
          {(() => {
            console.log('🔍 [按钮渲染] gameStatus=', gameStatus, ', isMyTurn=', isMyTurn, ', 条件满足=', gameStatus === 'playing' && isMyTurn)
            return null
          })()}
          {gameStatus === 'playing' && isMyTurn && (
            <div className="game-actions" id="gameActions">
              <div className="game-buttons">
                {/* 按JJ斗地主顺序：不出 - 倒计时 - 提示 - 出牌 */}
                {canPass && (
                  <button
                    type="button"
                    className="btn-pass"
                    onClick={handlePass}
                  >
                    不出
                  </button>
                )}
                {turnTimer > 0 && (
                  <div className="turn-timer">{turnTimer}</div>
                )}
                <button
                  type="button"
                  className="btn-hint"
                  onClick={handleHint}
                >
                  提示
                </button>
                <button
                  type="button"
                  className="btn-play"
                  onClick={handlePlayCards}
                  disabled={playPending}
                >
                  出牌
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 聊天遮罩层 */}
      {chatVisible && (
        <div 
          className="chat-overlay"
          onClick={() => setChatVisible(false)}
        />
      )}

      {/* 聊天侧边栏 */}
      <aside className={`chat-sidebar ${chatVisible ? 'visible' : 'hidden'}`}>
        <div className="chat-header">
          <h3>房间聊天</h3>
          <Button 
            size="small" 
            fill="none"
            onClick={() => setChatVisible(false)}
            style={{ padding: '4px 8px' }}
          >
            ✕
          </Button>
        </div>
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
              暂无消息
            </div>
          ) : (
            chatMessages.map((msg, index) => (
              <div key={index} className="chat-message">
                <div className="chat-message-sender">{msg.sender}</div>
                <div>{msg.message}</div>
              </div>
            ))
          )}
        </div>
        <div className="chat-input-area">
          <div className="chat-input-container">
            <input
              type="text"
              placeholder="输入聊天消息..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
            />
            <Button color="primary" onClick={handleSendChat}>
              发送
            </Button>
          </div>
        </div>
      </aside>

      {/* AI 分析面板 */}
      {showAiPanel && (
        <>
          {/* 透明遮罩层，点击关闭面板 */}
          <div 
            className="ai-panel-overlay"
            onClick={() => setShowAiPanel(false)}
          />
          <aside className="ai-panel">
          <div className="ai-panel-header">
            <h3>🤖 AI 提示历史</h3>
            <div className="ai-panel-actions">
              {aiHintHistory.length > 0 && (
                <button 
                  className="ai-clear-btn"
                  onClick={() => {
                    setAiHintHistory([])
                    aiHintCounterRef.current = 0
                  }}
                  title="清空历史"
                >
                  🗑️
                </button>
              )}
              <button 
                className="ai-close-btn"
                onClick={() => setShowAiPanel(false)}
                title="关闭面板"
              >
                ✖️
              </button>
            </div>
          </div>
          <div className="ai-panel-content">
            {aiHintHistory.length === 0 ? (
              <div className="ai-empty-state">
                <div className="ai-empty-icon">💡</div>
                <p>还没有使用AI提示</p>
                <p className="ai-empty-hint">点击“提示”按钮获取AI分析</p>
              </div>
            ) : (
              <div className="ai-history-list">
                {aiHintHistory.map((record) => (
                  <div key={record.id} className="ai-hint-card">
                    <div className="ai-hint-header">
                      <span className="ai-hint-number">#{record.id}</span>
                      <span className="ai-hint-time">{record.timestamp}</span>
                    </div>
                    
                    {record.analysis && (
                      <div className="ai-hint-section">
                        <div className="ai-section-title">🧠 深度分析</div>
                        <div className="ai-section-content">{record.analysis}</div>
                      </div>
                    )}
                    
                    {typeof record.winRate === 'number' && (
                      <div className="ai-hint-section">
                        <div className="ai-section-title">🎯 胜率估计</div>
                        <div className="ai-winrate-bar">
                          <div 
                            className="ai-winrate-fill"
                            style={{ width: `${record.winRate}%` }}
                          />
                          <span className="ai-winrate-text">{record.winRate}%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="ai-hint-section">
                      <div className="ai-section-title">🎴 推荐出牌</div>
                      <div className="ai-section-content">
                        {record.isPass ? (
                          <span className="ai-pass-tag">不出 (PASS)</span>
                        ) : (
                          <div className="ai-cards-display">
                            {record.cards.map((card, idx) => (
                              <span key={idx} className="ai-mini-card">{card}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {record.reason && (
                      <div className="ai-hint-footer">
                        <span className="ai-reason-label">📝</span>
                        <span className="ai-reason-text">{record.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        </>
      )}

      {/* 右下角UI组：AI+聊天（移除倍数显示） */}
      {!chatVisible && !showAiPanel && (
        <div className="bottom-right-ui">
          {/* AI 分析切换按钮 */}
          {aiHintHistory.length > 0 && (
            <button 
              className="ai-toggle-btn"
              onClick={() => setShowAiPanel(true)}
              title="查看AI分析"
            >
              🤖
              {aiHintHistory.length > 0 && (
                <span className="ai-badge">{aiHintHistory.length}</span>
              )}
            </button>
          )}
          {/* 聊天切换按钮 */}
          <button 
            className="chat-toggle-btn"
            onClick={() => setChatVisible(true)}
            title="打开聊天"
          >
            💬
          </button>
        </div>
      )}

      {/* 结算界面 - 全屏覆盖层 */}
      {showSettlement && gameState.gameResult && (
        <div className="settlement-overlay">
          <div className="settlement-root">
            <div className="settlement-layout">
              <div className="settlement-panel">
                <div className="settlement-header">
                  <div
                    className={`settlement-result-badge ${
                      gameState.gameResult.landlordWin ? 'landlord-win' : 'farmer-win'
                    }`}
                  >
                    {gameState.gameResult.landlordWin ? '地主获胜' : '农民获胜'}
                  </div>
                </div>

                {gameState.gameResult.score && (
                  <div className="players-score">
                    <h3 className="section-title">本局结算</h3>
                    <div className="players-score-list">
                      {settlementPlayerScores.map((ps: SettlementPlayerScore) => {
                        const isWinner = ps.isWinner
                        const isMe = ps.playerId === (user?.id || user?.name)
                        const scoreValue = ps.finalScore > 0 ? `+${ps.finalScore}` : ps.finalScore
                        const roleLabel = ps.role === 'landlord' ? '地主' : '农民'
                        return (
                          <div
                            key={ps.playerId}
                            className={`player-score-row ${isWinner ? 'winner' : ''} ${isMe ? 'me' : ''}`}
                          >
                            <div className="player-info">
                              <span className="player-name">
                                {ps.playerName}（{roleLabel}）
                              </span>
                            </div>
                            <span className={`player-score-value ${ps.finalScore >= 0 ? 'positive' : 'negative'}`}>
                              {scoreValue}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="settlement-actions">
                  <Button
                    color="primary"
                    onClick={() => {
                      dispatch(prepareNextGame())
                      setShowSettlement(false)
                      handleStartGame() // 再来一局
                    }}
                  >
                    再来一局
                  </Button>
                  <Button
                    color="default"
                    onClick={() => {
                      dispatch(prepareNextGame())
                      setShowSettlement(false)
                      doLeaveRoom()
                    }}
                  >
                    返回大厅
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
