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
import { parseCard } from './utils'
import { soundManager } from '@/utils/sound'
import { getLlmSettings } from '@/utils/llmSettings'
import { getGameSettings } from '@/utils/gameSettings'
import { motion } from 'framer-motion'

// 瀵煎叆鏂扮殑 Hooks
import { useGameUI, useGameTimer } from './hooks'

// 瀵煎叆鍏变韩缁勪欢
import { ChatPanel } from '@/shared/components'

// 瀵煎叆娓告垙鐗瑰畾缁勪欢
import { BiddingControls } from '@/games/doudizhu/components'

// 瀵煎叆 GameRoom 瀛愮粍浠?
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

  // 鐩戝惉 Socket 杩炴帴鐘舵€侊紝鐢ㄤ簬鎺у埗 UI 鍜岃皟璇曟祦绋?
  const { connected } = useSocketStatus()

  // ==================== 浣跨敤鏂扮殑 useGameUI Hook ====================
  const gameUI = useGameUI()
  const {
    // 鑱婂ぉ鐩稿叧
    chatVisible,
    chatMessage,
    chatMessages,
    toggleChat,
    updateChatInput,
    clearChatInput,
    addChatMessage,
    
    // 缁撶畻鍜屾姠鍦颁富
    showSettlement,
    openSettlement,
    closeSettlement,
    showBiddingUI,
    openBiddingUI,
    closeBiddingUI,
    
    // 鍔ㄧ敾鍜屼氦浜?
    isDealingAnimation,
    startDealingAnimation,
    stopDealingAnimation,
    playPending,
    setPlayPending,
    isDragSelecting,
    dragSelectMode,
    startDragSelect,
    stopDragSelect,
    
    // 涓嶅嚭鏍囪
    passedPlayers,
    markPlayerPassed,
    clearPlayerPassed,
    clearAllPassedPlayers,
    
    // 鍥炲悎鐘舵€?
    isMyTurn,
    canPass,
    setTurnState,
  } = gameUI

  // ==================== 浣跨敤鏂扮殑 useGameTimer Hook ====================
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
  // AI 鎻愮ず涓婁笅鏂囩紦瀛橈紙鐢ㄤ簬鏈嶅姟绔け璐ユ椂鏈湴鍏滃簳锛?
  const hintContextRef = useRef<{ myCards: string[]; lastCards: string[] | null } | null>(null)
  const autoFullHandPlayedRef = useRef(false)
  // 鏄惁宸茬粡鑷姩搴旂敤杩団€滄暣鎵嬪嚭鐗屸€濇垨鈥滆窡鐗屾彁绀衡€?
  const autoFollowHintAppliedRef = useRef(false)
  // 褰撳墠灞€涓殑鐐稿脊 / 鐏鏁伴噺缁熻
  const [currentBombCount, setCurrentBombCount] = useState(0)
  const [currentRocketCount, setCurrentRocketCount] = useState(0)
  // 鏄惁闅愯棌搴曠墝灞曠ず锛堜緥濡傚嚭瀹岀墝鍚庢敹璧峰簳鐗岋級
  const [hideBottomCards, setHideBottomCards] = useState(false)
  
  // AI 鍑虹墝鎻愮ず璁板綍缁撴瀯
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
    addChatMessage('绯荤粺', text)
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

  // 鏍规嵁褰撳墠鐢ㄦ埛锛岃绠楀乏鍙充袱渚у拰鑷繁鐨勭帺瀹朵綅缃?
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

    // 鎵惧埌褰撳墠鐢ㄦ埛鍦?players 鍒楄〃涓殑绱㈠紩
    const myIndex = filteredPlayers.findIndex(
      (p: any) => p.id === user.id || p.name === user.name
    )

    if (myIndex === -1) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    // 褰撳墠鐜╁锛堣嚜宸憋級
    const currentPlayer = filteredPlayers[myIndex]

    // 宸︿晶鐜╁
    const leftPlayer = filteredPlayers.length >= 2
      ? filteredPlayers[(myIndex - 1 + filteredPlayers.length) % filteredPlayers.length]
      : null

    // 鍙充晶鐜╁
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

  // 搴曢儴褰撳墠鐜╁閲戝竵鏄剧ず锛氫紭鍏堜娇鐢ㄦ埧闂撮噷鐨?player.score锛岀己澶辨椂鍥為€€鍒伴挶鍖呬綑棰?
  const bottomCoinValue =
    (currentPlayer as any)?.score ?? walletScore ?? 0

  // 璁板綍宸茬粡涓哄摢浜涚帺瀹舵媺鍙栬繃閲戝竵锛岄伩鍏嶉噸澶嶈姹?
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
        console.warn('GameRoom 鍒锋柊閽卞寘绉垎澶辫触:', res.status, json?.message)
        setWalletScore(0)
        return 0
      }

      const data = json.data
      const scoreValue = typeof data.totalScore === 'number' ? data.totalScore : 0
      setWalletScore(scoreValue)
      return scoreValue
    } catch (err: any) {
      console.error('GameRoom 鍒锋柊閽卞寘绉垎寮傚父:', err)
      setWalletScore(0)
      return 0
    }
  }

  // 褰撲笂鏂瑰乏鍙崇帺瀹剁殑 score 涓虹┖ / 闈炴鏁版椂锛屼复鏃朵粠 /api/score/<playerId> 鎷変竴娆￠挶鍖呯Н鍒?
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
            // 缃戠粶閿欒鏃跺拷鐣ワ紝淇濇寔鍘熸潵鐨?0 鍒嗘樉绀?
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

  const isLeftLandlord = isLandlordPlayer(leftPlayer)
  const isRightLandlord = isLandlordPlayer(rightPlayer)
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
    // 鍏煎鏃х殑 emoji / 瀛楃澶村儚
    return <span>{raw || '馃懁'}</span>
  }

  // parseCard 宸叉彁鍙栧埌 utils

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
      if (parsed.isJoker === 'big') return '澶х帇'
      if (parsed.isJoker === 'small') return '灏忕帇'
      return '鐜?
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
        // 鍗曠墝锛氱洿鎺ヨ鐐规暟
        return getSpokenRankFromCard(cardList[0])
      }
      case 'pair': {
        // 瀵瑰瓙锛氳鈥滃X鈥?
        const text = getSpokenRankFromCard(cardList[0])
        return text ? `瀵?{text}` : null
      }
      default: {
        // 鍏朵粬鐗屽瀷鏆傛椂涓嶆挱鎶?
        return null
      }
    }
  }

  // 鍒濆鍖栵細杩涘叆鎴块棿鏃剁粦瀹?Socket锛屽苟璁板綍鏈€杩戞埧闂?
  useEffect(() => {
    if (!user) {
      console.warn('[GameRoom] 鏈壘鍒扮敤鎴蜂俊鎭紝璺宠浆鐧诲綍椤?)
      navigate('/login', { replace: true })
      return
    }
    
    if (!roomId) return


    appendDebugMessage('FLOW', `杩涘叆鎴块棿锛宺oomId=${roomId}`)
    
    // 灏嗘渶杩戣繘鍏ョ殑鎴块棿淇℃伅鍐欏叆 sessionStorage锛屾柟渚挎柇绾块噸杩?
    sessionStorage.setItem('lastRoomId', roomId)
    sessionStorage.setItem('lastRoomTime', Date.now().toString())

    const socket = globalSocket.getSocket()
    if (!socket) {
      console.error('[GameRoom] Socket 鏈繛鎺ワ紝璺宠浆鐧诲綍椤?)
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

      
      // 棣栨杩炴帴 / 閲嶈繛鏃讹紝涓诲姩鍙戦€佸姞鍏ユ埧闂磋姹?
      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    const handleDisconnect = () => {

    }

    // 澶勭悊鏈嶅姟鍣ㄨ繑鍥炵殑鍑虹墝鎻愮ず缁撴灉
    const handleHintResult = (data: any) => {


      const { success, cards, reason, analysis, winRate, error } = data || {}

      // 浼樺厛浣跨敤鏈嶅姟绔彁绀?
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
            ? 'AI 鎻愪緵浜嗕竴鎵嬫帹鑽愬嚭鐗?
            : 'AI 鎻愮ず锛氬綋鍓嶅彲浠ラ€夋嫨涓嶅嚭鐗?,
        )
        return
      }

      // 鏈嶅姟绔け璐ユ椂锛岄€€鍥炲埌鏈湴 CardHintHelper 璁＄畻
      const ctx = hintContextRef.current
      const myCardsSnapshot = ctx?.myCards
      const lastCardsSnapshot = ctx?.lastCards ?? null

      console.warn('[AI Hint] 鏈嶅姟鍣ㄦ彁绀哄け璐ワ紝灏濊瘯鏈湴璁＄畻', error)
      if (error) {
        appendSystemMessage(`AI 鎻愮ず澶辫触锛?{String(error)}`)
      }

      if (!myCardsSnapshot || myCardsSnapshot.length === 0) {

        return
      }

      const fallbackHint = CardHintHelper.getHint(myCardsSnapshot, lastCardsSnapshot)
      if (!fallbackHint || fallbackHint.length === 0) {

        return
      }

      dispatch(clearSelection())
      fallbackHint.forEach((card) => {
        dispatch(toggleCardSelection(card))
      })


    }

    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('hint_result', handleHintResult)

    // 濡傛灉 Socket 宸茶繛鎺ワ紝鐩存帴鍙戦€?join_game 璇锋眰锛岄伩鍏嶉仐婕忔埧闂村姞鍏?
    if (socket.connected) {

      globalSocket.joinGame({
        roomId,
        userId: user.id,
        playerName: user.name,
        playerAvatar: user.avatar,
      })
    }

    // 鍒濆鍖栧墠绔?Redux 涓殑娓告垙鐘舵€侊紝閬垮厤娈嬬暀涓婁竴灞€鏁版嵁
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
        appendDebugMessage('QUICK', `浠庣偣鍑诲尮閰嶅埌杩涘叆鎴块棿鎬昏€楁椂 ${total}ms`)
      }

      if (!Number.isNaN(click) && !Number.isNaN(rooms)) {
        appendDebugMessage('QUICK', `鐐瑰嚮鎴块棿鍒楄〃鍒版埧闂村垪琛ㄨ繑鍥炶€楁椂 ${rooms - click}ms`)
      }

      if (!Number.isNaN(rooms) && !Number.isNaN(join)) {
        appendDebugMessage('QUICK', `鎴块棿鍒楄〃杩斿洖鍒板彂閫?join_game 鑰楁椂 ${join - rooms}ms`)
      }
    } catch {
    }
  }, [user, roomId])

  // 鐩戝惉娓告垙鐩稿叧鐨?Socket 浜嬩欢
  useEffect(() => {
    if (!connected) return

    const socket = globalSocket.getSocket()
    if (!socket) return
    


    // 鎴块棿鍔犲叆浜嬩欢
    const handleRoomJoined = (data: any) => {

      appendSystemMessage('宸茶繘鍏ユ埧闂达紝绛夊緟鍏朵粬鐜╁...')
      const now = Date.now()
      quickFlowRef.current.roomJoinedAt = now
      appendDebugMessage('FLOW', '鏀跺埌 room_joined 浜嬩欢')
    }

    // 鍔犲叆娓告垙鎴愬姛
    const handleJoinGameSuccess = (data: any) => {

      appendDebugMessage('ROOM', '鏀跺埌 join_game_success 浜嬩欢')

      // 閲嶇疆涓婁竴灞€鐨勫墠绔姸鎬侊紝涓烘柊涓€灞€鍋氬噯澶?
      dispatch(prepareNextGame())
      
      // 瀵归綈鏃х増 frontend 鐨?onJoinGameSuccess 琛屼负
      if (data.room && data.room.players) {

        // 鍏煎 ready 瀛楁鍒?isReady锛屽苟琛ュ厖 cardCount / score
        const players = data.room.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0,
          score: p.score ?? p.totalScore ?? null, // 鍏煎涓嶅悓瀛楁锛岀粺涓€浣跨敤 score
        }))
        console.log('[JoinGame] 褰掍竴鍖栧悗鐨勭帺瀹跺垪琛?room.players):', players)
        dispatch(initGame({
          roomId: data.room.id,
          players: players,
        }))
      } else if (data.players) {

        // 鍏煎鏃х増鍓嶇浠呰繑鍥?players 鏁扮粍鐨勬儏鍐?
        const players = data.players.map((p: any) => ({
          ...p,
          id: p.id || p.userId || p.name,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
          cardCount: p.cardCount || p.cards?.length || 0,
          score: p.score ?? p.totalScore ?? null, // 鍏煎涓嶅悓瀛楁锛岀粺涓€浣跨敤 score
        }))
        console.log('[JoinGame] 褰掍竴鍖栧悗鐨勭帺瀹跺垪琛?data.players):', players)
        dispatch(updatePlayers(players))
      }
    }

    // 鎭㈠鐗屽眬鐘舵€侊紙鏂嚎閲嶈繛 / 鍒锋柊锛?
    const handleGameStateRestored = (data: any) => {

      appendSystemMessage('宸叉仮澶嶇墝灞€鐘舵€侊紝缁х画涓婁竴灞€')

      if (!data) return

      const phase = (data as any).phase as string | undefined
      const biddingState = (data as any).biddingState

      // 鎭㈠鐜╁鍒楄〃鍜屾墜鐗屾暟閲?
      if (data.players && Array.isArray(data.players)) {

        const players = data.players.map((p: any) => {
          const cardCount = p.cardCount || p.cards?.length || 0
          console.log(
            `[GameStateRestored] 鐜╁ ${p.name}: cardCount=${p.cardCount}, cards.length=${p.cards?.length}, 浣跨敤鍊?${cardCount}`
          )
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

      // 鎭㈠褰撳墠鐜╁鎵嬬墝锛堟棤璁烘槸鎶㈠湴涓婚樁娈佃繕鏄嚭鐗岄樁娈碉級
      const currentPlayerState = data.players?.find(
        (p: any) => p.id === user?.id || p.name === user?.name
      )
      if (currentPlayerState && Array.isArray(currentPlayerState.cards)) {
        dispatch(startGame({ myCards: currentPlayerState.cards }))
        console.log(
          `[GameStateRestored] 鎭㈠鎴戠殑鎵嬬墝锛屽叡 ${currentPlayerState.cards.length} 寮燻
        )
      }

      // 鎭㈠鍦颁富涓庡簳鐗?
      if (data.landlordId) {
        dispatch(
          setLandlord({
            landlordId: data.landlordId,
            landlordCards: data.bottomCards || [],
          })
        )

      }

      // 鎭㈠涓婁竴鎵嬪嚭鐗?
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
      } else {

      }

      // 濡傛灉褰撳墠浠嶅浜庢姠鍦颁富闃舵锛屼緷鎹?biddingState 鎭㈠鈥滆疆鍒拌皝鎶⑩€濈殑鏈湴 UI
      if (phase === 'bidding' && biddingState && biddingState.currentBidderId) {
        const currentUserId = user?.id || user?.name
        const isMyBidTurn =
          !!currentUserId && biddingState.currentBidderId === currentUserId

        if (isMyBidTurn) {

          openBiddingUI()
          // 鍚姩 15 绉掓姠鍦颁富鍊掕鏃?
          startBiddingTimer(15)
        } else {

          closeBiddingUI()
          stopBiddingTimer()
        }

        // 鎶㈠湴涓婚樁娈典笉搴旀仮澶嶅嚭鐗屽洖鍚堬紝鐩存帴杩斿洖
        return
      }

      // 浠呭湪澶勪簬鍑虹墝闃舵锛堟垨鏃х増鏈湭甯?phase 瀛楁锛夋椂锛屾仮澶嶅綋鍓嶅嚭鐗屾潈
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

      // 鏈€鍚庡悓姝ヤ竴娆?ready 鐘舵€?
      if (data.players && Array.isArray(data.players)) {
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
        }))
        dispatch(updatePlayers(players))
      }
    }

    // 鐜╁鍔犲叆
    const handlePlayerJoined = (data: any) => {


      // 绯荤粺鎻愮ず锛氭湁鏂扮帺瀹惰繘鍏ユ埧闂?
      if (data.playerName && data.playerName !== user?.name) {
        addChatMessage('绯荤粺', `${data.playerName} 鍔犲叆浜嗘埧闂碻)
      }

      // 濡傛灉鏈嶅姟绔笅鍙戜簡瀹屾暣鐜╁鍒楄〃锛屽垯浠ヨ鍒楄〃涓哄噯鍒锋柊鏈湴鐘舵€?
      if (data.players && Array.isArray(data.players)) {

        // 鍚屾 ready 瀛楁鍒?isReady
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready,
        }))
        dispatch(updatePlayers(players))
      }
    }

    // 鐜╁绂诲紑
    const handlePlayerLeft = (data: any) => {

      // 绯荤粺鎻愮ず锛氭湁鐜╁绂诲紑
      addChatMessage('绯荤粺', `${data.playerName || '鐜╁'} 绂诲紑浜嗘埧闂碻)

      // 瀵归綈鏃х増 frontend 鐨?onPlayerLeft 琛屼负
      // 濡傛灉杩斿洖浜嗗畬鏁?players 鍒楄〃锛屽垯鐩存帴瑕嗙洊
      if (data.players && Array.isArray(data.players)) {

        // 鍚屾 ready 瀛楁鍒?isReady
        const players = data.players.map((p: any) => ({
          ...p,
          isReady: p.isReady !== undefined ? p.isReady : p.ready
        }))
        dispatch(updatePlayers(players))
      } else if (data.playerId) {
        // 浠呰繑鍥?playerId 鏃讹紝浠庢湰鍦?players 鍒楄〃涓繃婊ゆ帀璇ョ帺瀹?

        const filtered = (players || []).filter((p: any) => p.id !== data.playerId && p.userId !== data.playerId)
        dispatch(updatePlayers(filtered))
      }
    }

    // 鐜╁鍑嗗
    const handlePlayerReady = (data: any) => {

      
      // 绯荤粺鎻愮ず锛氭煇浣嶇帺瀹跺凡鍑嗗
      if (data.playerName) {
        addChatMessage('绯荤粺', `${data.playerName} 宸插噯澶嘸)
      }
      
      // 瀵归綈鏃х増 frontend 鐨?onPlayerReady 琛屼负
      // 濡傛灉杩斿洖浜嗗畬鏁?players 鍒楄〃锛屽垯浠ヨ鍒楄〃涓哄噯鍒锋柊
      if (data.players && Array.isArray(data.players)) {

        // 鍚屾 ready 瀛楁鍒?isReady
        const players = data.players.map((p: any) => {
          const isReady = p.isReady !== undefined ? p.isReady : p.ready

          return {
            ...p,
            isReady: isReady
          }
        })
        dispatch(updatePlayers(players))
      } else if (data.playerId) {
        // 浠呰繑鍥?playerId 鏃讹紝鏈湴鏍囪璇ョ帺瀹朵负宸插噯澶?

        dispatch(updatePlayerStatus({ playerId: data.playerId, isReady: true }))
      }
    }

    // 娓告垙寮€濮?
    const handleGameStarted = (data: any) => {

      const now = Date.now()
      const joinedAt = quickFlowRef.current.roomJoinedAt
      if (joinedAt) {
        appendDebugMessage('FLOW', `room_joined 鈫?game_started 鑰楁椂 ${now - joinedAt}ms`)
      }
      quickFlowRef.current.gameStartedAt = now
      closeSettlement()
      dispatch(prepareNextGame())
      // 閲嶇疆鐐稿脊 / 鐏缁熻绛夊眬鍐呯姸鎬?
      setCurrentBombCount(0)
      setHideBottomCards(false)
      appendSystemMessage('娓告垙寮€濮嬶紝鍑嗗鎶㈠湴涓?)
    }

    // 鍙戠墝瀹屾垚锛堟墍鏈夌帺瀹讹級
    const handleDealCardsAll = (data: any) => {

      const now = Date.now()
      const startedAt = quickFlowRef.current.gameStartedAt
      if (startedAt) {
        appendDebugMessage('FLOW', `game_started 鈫?deal_cards_all 鑰楁椂 ${now - startedAt}ms`)
      }
      quickFlowRef.current.dealCardsAt = now
      
      // 鎵惧埌褰撳墠鐜╁鐨勬墜鐗?
      const myCards = data.players?.find((p: any) => 
        p.playerId === user?.id || p.playerId === user?.name
      )
      
      if (myCards && myCards.cards && myCards.cards.length > 0) {


        // 鎾斁鍙戠墝闊虫晥
        soundManager.playSound('deal')
        
        // 鍒濆鍖栨垜鐨勬墜鐗?
        dispatch(startGame({ myCards: myCards.cards }))

        if (dealAnimationTimeoutRef.current) {
          clearTimeout(dealAnimationTimeoutRef.current)
        }
        startDealingAnimation()
        dealAnimationTimeoutRef.current = window.setTimeout(() => {
          stopDealingAnimation()
        }, Math.min(1500, myCards.cards.length * 120 + 500))
        
        // 鍚屾鎵€鏈夌帺瀹剁殑鍩虹淇℃伅涓庢墜鐗屾暟閲?
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

        appendSystemMessage('鍙戠墝瀹屾垚锛岃繘鍏ユ姠鍦颁富闃舵')
      } else {
        console.error('[Game] 鏈壘鍒板綋鍓嶇帺瀹剁殑鍙戠墝缁撴灉锛宑urrentPlayerId:', user?.id || user?.name)
        console.error('[Game] 鏈嶅姟绔繑鍥炵殑鐜╁鍒楄〃:', data.players)
      }
    }

    // 鎶㈠湴涓诲紑濮?
    const handleBiddingStart = (data: any) => {

      const now = Date.now()
      const dealAt = quickFlowRef.current.dealCardsAt
      if (dealAt) {
        appendDebugMessage('FLOW', `deal_cards_all 鈫?bidding_start 鑰楁椂 ${now - dealAt}ms`)
      }
      quickFlowRef.current.biddingStartAt = now
      addChatMessage('绯荤粺', `寮€濮嬫姠鍦颁富锛屽厛鎵嬬帺瀹讹細${data.firstBidderName || '鐜╁'}`)
      
      // 鍒ゆ柇褰撳墠鐢ㄦ埛鏄惁鏄浣嶆姠鍦颁富鐨勭帺瀹?
      const currentUserId = user?.id || user?.name
      const currentUserName = user?.name || user?.id
      const isMyTurn =
        (!!data.firstBidderId && data.firstBidderId === currentUserId) ||
        (!!data.firstBidderName && data.firstBidderName === currentUserName)

      if (isMyTurn) {

        openBiddingUI()
        // 鍚姩 15 绉掓姠鍦颁富鍊掕鏃?
        startBiddingTimer(15)
      }
    }

    // 鎶㈠湴涓荤粨鏋滐紙bid_result锛? 瀵归綈鏃х増 frontend 琛屼负
    const handleBidResult = (data: any) => {

      
      // 鏂囨湰鍖栨姠/涓嶆姠缁撴灉
      const bidText = data.bid ? '鎶㈠湴涓? : '涓嶆姠'
      appendDebugMessage('BID', `bid_result: ${data.userName || '鐜╁'} 閫夋嫨${bidText}`)
      addChatMessage('绯荤粺', `${data.userName || '鐜╁'} ${bidText}`)
      
      // 鍏抽棴鏈湴鎶㈠湴涓?UI
      closeBiddingUI()
      stopBiddingTimer()
      
      // 濡傛灉杩樻湁涓嬩竴浣嶆姠鍦颁富鐜╁锛屽欢杩熶竴绉掑悗鍒囨崲 UI
      if (data.nextBidderId) {
        setTimeout(() => {
          const currentUserId = user?.id || user?.name
          if (data.nextBidderId === currentUserId) {

            openBiddingUI()
            // 鍚姩 15 绉掓姠鍦颁富鍊掕鏃?
            startBiddingTimer(15)
          } else {

          }
        }, 1000) // 1 绉掑悗灞曠ず涓嬩竴浣嶆姠鍦颁富 UI
      }
    }

    // 鍦颁富纭畾
    const handleLandlordDetermined = (data: any) => {






      appendDebugMessage('BID', '鏀跺埌 landlord_determined 浜嬩欢')
      
      if (data.landlordId) {
        // 鍏抽棴鎶㈠湴涓?UI
        closeBiddingUI()
        stopBiddingTimer()
        
        // 鍒ゆ柇褰撳墠鐜╁鏄惁涓哄湴涓?
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
        

        
        addChatMessage('绯荤粺', `${data.landlordName || '鐜╁'} 鎴愪负鍦颁富`)
        
        // 濡傛灉鑷繁鏄湴涓伙紝琛ュ厖涓€鏉″簳鐗岃幏寰楁彁绀?
        if (isLandlord) {

          addChatMessage('绯荤粺', `鍦颁富鑾峰緱搴曠墝锛屽叡 ${data.bottomCards?.length || 3} 寮燻)
        }


      }
    }

    // 娓告垙鐘舵€佸閲忔洿鏂帮紙鐩墠浠呯敤浜庤皟璇曪級
    const handleGameStateUpdated = (data: any) => {

    }

    // 杞埌鏌愪綅鐜╁鍑虹墝 - 瀵归綈鏃х増 frontend 琛屼负锛屽苟椹卞姩鏈湴鍑虹墝 UI
    const handleTurnToPlay = (data: any) => {




      
      if (data.playerId) {
        dispatch(setCurrentPlayer(data.playerId))

        const isMe = data.playerId === (user?.id || user?.name)

        if (isMe) {
          // 杞埌鑷繁鍑虹墝
          playPendingRef.current = false
          setPlayPending(false)

          // 閲嶇疆鏈眬鍑虹墝鎻愮ず鐩稿叧鐨勮嚜鍔ㄦ爣璁?
          CardHintHelper.resetHintIndex()
          autoFullHandPlayedRef.current = false
          autoFollowHintAppliedRef.current = false
          
          // 璁＄畻鏈疆鏄惁鍏佽涓嶅嚭锛氶潪棣栨墜涓斿瓨鍦ㄤ笂瀹剁墝鍨嬫椂鎵嶅彲浠ヤ笉鍑?
          const isFirst = data.isFirst
          const hasLastPattern = Boolean(data.lastPattern)
          const canPassNow = !isFirst && hasLastPattern
          
          setTurnState(true, canPassNow)
          
          console.log('[Turn] 鏈疆鏄惁鍙互涓嶅嚭(canPass):', canPassNow)
          console.log('[Turn] 鏄惁棣栨墜鍑虹墝(isFirst):', isFirst)
          console.log('[Turn] 涓婂鍑虹墝璁板綍(lastPlayedCards):', lastPlayedCards)


          // 绯荤粺鎻愮ず锛氳疆鍒拌嚜宸卞嚭鐗?
          addChatMessage('绯荤粺', '杞埌浣犲嚭鐗屼簡')
        } else {
          // 杞埌鍏朵粬鐜╁
          setTurnState(false, false)

          const otherName = data.playerName || '鐜╁'
          addChatMessage('绯荤粺', `杞埌 ${otherName} 鍑虹墝...`)
        }

        // 鍑虹墝鍊掕鏃跺垵濮嬪寲
        const initialTime =
          typeof data.remainingTime === 'number' && data.remainingTime > 0
            ? data.remainingTime
            : 30
        startTurnTimer(initialTime)
      }
    }

    const handlePlayCardsFailed = (data: { error?: string }) => {

      console.warn('[PlayCards] 鍑虹墝澶辫触:', data)
      playPendingRef.current = false
      setPlayPending(false)

      const message = data?.error || '鍑虹墝澶辫触锛岃绋嶅悗閲嶈瘯'
      const lower = message.toLowerCase()
      const notYourTurn =
        message.includes('涓嶆槸浣犵殑鍥炲悎') ||
        lower.includes('not your turn')

      if (notYourTurn) {
        setTurnState(false, false)
      } else {
        setTurnState(true, canPass)
        setPlayPending(false)
      }


      appendSystemMessage(`鍑虹墝澶辫触锛?{message}`)
    }

    // 褰撳墠鍑虹墝鏉冪帺瀹跺彂鐢熷彉鏇?
    const handleTurnChanged = (data: any) => {

      if (data.currentPlayerId) {
        dispatch(setCurrentPlayer(data.currentPlayerId))
      }
    }

    // 鏈夌帺瀹跺嚭鐗?- 瀵归綈鏃х増 frontend 琛屼负
    const handleCardsPlayed = (data: any) => {

      console.log('[Play] 鍑虹墝鐜╁:', data.playerName, '(', data.playerId, ')')



      appendDebugMessage(
        'FLOW',
        `鏀跺埌 cards_played锛歱layer=${data.playerName || data.playerId || '鏈煡'}锛岀墝鏁?${
          Array.isArray(data.cards) ? data.cards.length : 0
        }`,
      )

      if (!data.playerId || !data.cards) {
        return
      }

      // 鎾斁瀵瑰簲鐗屽瀷鐨勫嚭鐗岄煶鏁?
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

      // 濡傛灉褰撳墠鐗屽瀷娌℃湁涓撻棬鐨?mp3锛屽垯閫€鍥炲埌鏂囨椹卞姩鐨?TTS 鎾姤
      if (!hasDedicatedSound) {
        const voiceText = getPlayVoiceText(data.cardType, data.cards)
        if (voiceText) {
          soundManager.playVoice(voiceText)
        }
      }

      // 鍚屾 Redux 涓殑鍑虹墝鐘舵€?
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

      // 娓呯悊鏈疆鍑虹墝鍊掕鏃?
      stopTurnTimer()

      // 鍑虹墝鍚庢竻绌烘湰鍦伴€変腑鐘舵€?
      dispatch(clearSelection())

      // 鍑虹墝鍚庢竻绌烘墍鏈夌帺瀹剁殑鈥滀笉鍑衡€濇爣璁?
      clearAllPassedPlayers()

      // 鏈夌帺瀹跺嚭鐗屽悗锛屽鏋滃簳鐗屽尯鍩熶粛灞曠ず锛屽垯鑷姩鏀惰捣
      if (!hideBottomCards) {
        setHideBottomCards(true)
      }

      // 缁熻鐐稿脊 / 鐏鏁伴噺锛岀敤浜庣粨绠楀€嶆暟
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
          addChatMessage('绯荤粺', `${data.playerName} 鎵撳嚭 ${cardTypeDesc}`)
        }
      }
    }

    // 鏈夌帺瀹堕€夋嫨鈥滀笉鍑衡€?
    const handlePlayerPassed = (data: any) => {

      if (!data.playerId) return

      // 鎾斁鈥滀笉鍑衡€濋煶鏁?
      soundManager.playPass()

      dispatch(passAction(data.playerId))
      // 鏍囪璇ョ帺瀹舵湰杞凡缁忛€夋嫨鈥滀笉鍑衡€?
      markPlayerPassed(data.playerId)
      // 绯荤粺鎻愮ず锛氭煇浣嶇帺瀹堕€夋嫨涓嶅嚭
      addChatMessage('绯荤粺', `${data.playerName || '鐜╁'} 閫夋嫨涓嶅嚭`)
    }

    // 娓告垙缁撴潫锛坓ame_over / game_ended锛? 瀵归綈鏃х増 frontend 琛屼负
    const handleGameEnded = (data: any) => {


      appendDebugMessage(
        'FLOW',
        `鏀跺埌 game_over锛歸inner=${data.winnerName || '鏈煡'}锛宺ole=${data.winnerRole}, landlordWin=${
          data.landlordWin
        }`,
      )
      
      // 娓呯悊鍑虹墝鍊掕鏃?
      stopTurnTimer()
      
      // 鍋滄鏈湴鈥滆疆鍒版垜鈥濈姸鎬?
      setTurnState(false, false)
      
      // 閫氱煡 Redux 缁撴潫鏈眬娓告垙
      dispatch(endGame(data))

      // 璁板綍鎴戜滑宸茬粡璇锋眰鏄剧ず缁撶畻
      openSettlement()
      appendDebugMessage('FLOW', '宸茶皟鐢?openSettlement()锛岀瓑寰呯粨绠?UI 娓叉煋')

      // 鎾斁鑳滆礋闊虫晥
      const myId = user?.id || user?.name
      const isWinner =
        !!myId && (data.winnerId === myId || data.winnerName === user?.name)
      if (isWinner) {
        // 鑷繁鑾疯儨锛氭挱鏀捐儨鍒╅煶鏁?+ 缁撶畻 BGM
        soundManager.playWin()
        soundManager.stopBackgroundMusic()
        soundManager.playVictoryMusic()
      } else {
        soundManager.playLose()
      }
      
      // 绯荤粺鎻愮ず锛氭湰灞€缁撴潫 + 鑾疯儨鏂硅鑹?
      const winnerName = data.winnerName || '鐜╁'
      const role = data.winnerRole === 'landlord' ? '鍦颁富' : '鍐滄皯'
      addChatMessage('绯荤粺', `鏈眬缁撴潫锛?{winnerName}锛?{role}锛夎幏鑳渀)
      ;(async () => {
        const newScore = await refreshWalletScore()
        if (typeof newScore === 'number' && newScore <= 0) {
          addChatMessage('绯荤粺', '鏈眬缁撴潫鍚庝綘鐨勭Н鍒嗗凡鐢ㄥ敖锛屽皢鑷姩杩斿洖澶у巺杩涜鍏呭€?)
          dispatch(prepareNextGame())
          doLeaveRoom()
        }
      })()
    }

    // 鑱婂ぉ娑堟伅
    const handleChatMessage = (data: any) => {

      if (data.playerName && data.message) {
        addChatMessage(data.playerName, data.message)
      }
    }

    // 缁戝畾鎴块棿 / 娓告垙鐩稿叧鐨?Socket 浜嬩欢
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
    socket.on('game_over', handleGameEnded)  // 鍏煎鏃х増锛氭湁鐨勫湴鏂瑰彂 game_over
    socket.on('game_ended', handleGameEnded)  // 鏂扮増浜嬩欢鍚嶏細game_ended
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

  // 鑷姩鍑嗗锛氬湪绛夊緟鐘舵€佷笖鑷繁鏈噯澶囨椂锛屾牴鎹埧闂撮厤缃嚜鍔ㄥ彂閫佷竴娆?player_ready
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
      console.log('[AutoReady] 绔嬪嵆鍙戦€?player_ready 浜嬩欢', {
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

    console.log('[AutoReady] 鍑嗗鍚姩鑷姩鍑嗗璁℃椂', {
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
      console.log('[AutoReady] 寤舵椂鍚庝粛鍦ㄦ埧闂翠笖鏈噯澶囷紝鍙戦€?player_ready 浜嬩欢', {
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

  // 褰撳洖鍒?waiting 鐘舵€佹椂锛岄噸缃嚜鍔ㄥ噯澶囩浉鍏崇殑鏍囪涓庤鏃跺櫒
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

  // 缁撶畻椤甸潰鑷姩绂诲紑/鍐嶆潵涓€灞€鐩稿叧鐨勮鏃跺櫒娓呯悊
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

  // 鑷姩鏁存墜鍑虹墝锛氬綋鏁存墜鐗屾瀯鎴愬崟涓€鐗屽瀷涓斿彲浠ュ帇杩囦笂瀹舵椂锛岃嚜鍔ㄥ府鐜╁鍑鸿繖涓€鎵?
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


  setTimeout(() => {
    doPlayCards(fullHandPattern)
  }, 500)
}, [isMyTurn, myCards, lastPlayedCards, canPass])

// 鑷姩搴旂敤璺熺墝鎻愮ず
useEffect(() => {
  if (!isMyTurn) return
  // 濡傛灉涓嶈兘璺熺墝锛屽垯涓嶉渶瑕佽嚜鍔ㄥ簲鐢ㄨ窡鐗屾彁绀?
  if (!canPass) return
  if (autoFollowHintAppliedRef.current) return
  if (!myCards || myCards.length === 0) return

  const hasLastCards =
    !!lastPlayedCards &&
    !!lastPlayedCards.cards &&
    lastPlayedCards.cards.length > 0
  if (!hasLastCards) return // 娌℃湁涓婂鍑虹墝锛岀洿鎺ヨ繑鍥?

  const lastCards = lastPlayedCards!.cards as string[]
  const hint = CardHintHelper.getHint(myCards, lastCards)
  if (!hint || hint.length === 0) return

  autoFollowHintAppliedRef.current = true

  // 鑷姩搴旂敤鈥滆窡鐗屾彁绀衡€濈粨鏋滐細鍏堟竻绌哄凡鏈夐€夋嫨锛屽啀鍕鹃€夋彁绀轰腑鐨勭墝
  dispatch(clearSelection())
  hint.forEach((card) => {
    dispatch(toggleCardSelection(card))
  })
}, [isMyTurn, canPass, myCards, lastPlayedCards, dispatch])

// 鎶㈠湴涓诲€掕鏃惰秴鏃跺鐞?
useEffect(() => {
  if (biddingTimer !== 0) return
  if (!showBiddingUI) return


  closeBiddingUI()
  handleBid(false)
}, [biddingTimer, showBiddingUI])

// 鑷姩鍑虹墝锛堝嚭鐗屽€掕鏃惰秴鏃讹級
useEffect(() => {
  if (!isMyTurn) return
  if (turnTimer !== 0) return



  if (canPass) {

    handlePass()
  } else {
    // 灏濊瘯鑷姩鍑虹墝

    if (myCards.length === 0) {
      console.warn('娌℃湁鐗屽彲浠ュ嚭...')
      return
    }

    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    const autoHint = CardHintHelper.getHint(myCards, lastCards)

    
    if (autoHint && autoHint.length > 0) {

      doPlayCards(autoHint)
      addChatMessage('绯荤粺', '宸蹭负浣犺嚜鍔ㄥ嚭涓€鎵嬫帹鑽愮墝')
    } else {
      // 鎺ㄨ崘澶辫触锛屽厹搴曞嚭鏈€灏忕殑涓€寮?
      console.error('娌℃湁鎺ㄨ崘鍑虹墝锛屽厹搴曞嚭鏈€灏忕殑涓€寮犵墝')
      const minCard = myCards[0]
      if (minCard) {

        doPlayCards([minCard])
        addChatMessage('绯荤粺', '宸蹭负浣犺嚜鍔ㄥ嚭涓€寮犳渶灏忕殑鐗?)
      } else {
        console.error('宸茬粡娌℃湁鍙互鍑虹殑鐗?)
        addChatMessage('绯荤粺', '宸蹭负浣犺嚜鍔ㄥ垽瀹氫负娌℃湁鍙嚭鐨勭墝')
      }
    }
  }
  }, [turnTimer, isMyTurn, canPass])

  // 鑷姩鈥滄病鏈夊彲鍑虹墝鏃跺府鐐逛笉鍑衡€濓細濡傛灉鎵€鏈夋彁绀洪兘澶辫触锛屽欢杩?1 绉掕嚜鍔ㄦ墽琛屼笉鍑?
  useEffect(() => {
    if (!isMyTurn || !canPass) return
    if (!myCards || myCards.length === 0) return
    
    // 鍙栧嚭涓婁竴浣嶇帺瀹舵墦鍑虹殑鐗屼綔涓哄弬鐓?
    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null
    
    if (!lastCards) return // 娌℃湁涓婂鍑虹墝锛岀洿鎺ヨ繑鍥?
    
    // 璋冪敤 getAllHints 鑾峰彇鎵€鏈夊彲琛岀殑璺熺墝鏂规锛岀敤浜庡垽鏂槸鍚﹀交搴曟病鏈夌墝鍙嚭
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)
    
    // 濡傛灉瀹屽叏娌℃湁鍙嚭鐨勭墝锛屽垯 1 绉掑悗鑷姩甯帺瀹剁偣鈥滀笉鍑衡€?
    if (!allHints || allHints.length === 0) {

      // 1 绉掑悗鑷姩鐐瑰嚮鈥滀笉鍑衡€?
      setTimeout(() => {
        if (isMyTurn && canPass) {
          handlePass()
          addChatMessage('绯荤粺', '娌℃湁鍙嚭鐨勭墝锛屽凡鑷姩閫夋嫨涓嶅嚭')
        }
      }, 1000)
    }
  }, [isMyTurn, canPass, myCards, lastPlayedCards])

  // 绂诲紑鎴块棿锛氭柇寮€鎴块棿骞惰繑鍥炲ぇ鍘?
  const doLeaveRoom = () => {
    if (roomId) {
      globalSocket.leaveGame(roomId)
    }
    // 鍋滄鑳滃埄闊充箰骞舵竻鐞嗘渶杩戞埧闂磋褰?
    soundManager.stopVictoryMusic()
    sessionStorage.removeItem('lastRoomId')
    sessionStorage.removeItem('lastRoomTime')
    dispatch(resetGame())
    navigate('/', { replace: true })
  }

  // 澶勭悊鈥滃紑濮?鍑嗗鈥濇寜閽偣鍑?
  const handleStartGame = () => {
    if (!roomId || !user) return
    
    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('鏃犳硶杩炴帴鏈嶅姟鍣紝鏃犳硶寮€濮嬫父鎴?)
      return
    }
    
    // 閽卞寘绉垎涓嶈冻鏃讹紝绂佹寮€濮嬫父鎴?
    if (walletScore !== null && walletScore <= 0) {
      appendSystemMessage('浣犵殑绉垎涓嶈冻锛屾棤娉曞紑濮嬫父鎴?)
      return
    }

    // 寮€濮嬫柊涓€灞€鍓嶅厛鍋滄涓婁竴灞€鐨勮儨鍒╅煶涔?
    soundManager.stopVictoryMusic()
    const gameSettings = getGameSettings()
    soundManager.setMusicEnabled(gameSettings.bgmEnabled)
    if (gameSettings.bgmEnabled) {
      soundManager.playBackgroundMusic()
    }

    // 鏌ユ壘褰撳墠鐜╁鍦?players 鍒楄〃涓殑淇℃伅
    const currentPlayer = players.find((p: any) => 
      p.id === user.id || p.name === user.name
    )
    
    // 鍙傝€冩棫鐗堥€昏緫锛氭湰鍦板垏鎹?ready 鐘舵€侊紝鐒跺悗鍐嶉€氱煡鏈嶅姟绔?
    const newReadyState = !currentPlayer?.isReady
    
    console.log('鍑嗗鐘舵€佹敼鍙?, { 
      currentState: currentPlayer?.isReady,
      newState: newReadyState,
      playerName: user.name
    })
    
    // 鍏堝湪 Redux 涓洿鏂拌嚜宸辩殑鍑嗗鐘舵€?
    const playerId = user.id || user.name
    dispatch(updatePlayerStatus({ playerId, isReady: newReadyState }))
    
    // 鐒跺悗閫氳繃 socket 鎶婂噯澶囩姸鎬佸悓姝ョ粰鏈嶅姟绔?
    socket.emit('player_ready', {
      roomId,
      userId: user.id || user.name,
    })
    
    console.log('鍙戦€佸噯澶囩姸鎬佹敼鍙?, { 
      roomId,
      userId: user.id || user.name,
    })
  }

  // 瀹為檯鍙戦€佸嚭鐗岃姹傚埌鏈嶅姟鍣?
  const doPlayCards = (cardsToPlay: string[]) => {
    if (!roomId || !user || !isMyTurn) {
      appendSystemMessage(isMyTurn ? '鏃犳硶杩炴帴鏈嶅姟鍣? : '杩樻病杞埌浣犲嚭鐗?)
      return
    }

    if (playPendingRef.current) {
      appendSystemMessage('姝ｅ湪澶勭悊涓婁竴鎵嬪嚭鐗岋紝璇风◢鍊?..')
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

  // 鐐瑰嚮鈥滃嚭鐗屸€濇寜閽椂鐨勫墠绔鐞?
  const handlePlayCards = () => {
    // 濡傛灉褰撳墠鏈€夋嫨鐗岋紝灏濊瘯鏁存墜鑷姩鍑虹墝锛堜緥濡傚崟涓€鐗屽瀷鐨勪竴鏁存墜锛?
    let cardsToPlay = selectedCards
    if (cardsToPlay.length === 0) {
      const autoFullHand = CardHintHelper.getFullHandIfSinglePattern(myCards)
      if (autoFullHand && autoFullHand.length === myCards.length) {
        cardsToPlay = autoFullHand
      }
    }

    doPlayCards(cardsToPlay)
  }

  // 鐐瑰嚮鈥滀笉鍑衡€濇寜閽殑鍓嶇澶勭悊
  const handlePass = () => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
      appendSystemMessage('鏃犳硶杩炴帴鏈嶅姟鍣紝鏃犳硶鎵ц涓嶅嚭')
      return
    }

    if (!isMyTurn) {
      appendSystemMessage('杩樻病杞埌浣犲嚭鐗岋紝涓嶈兘鐐逛笉鍑?)
      return
    }

    if (!canPass) {
      appendSystemMessage('褰撳墠杞涓嶈兘閫夋嫨涓嶅嚭')
      return
    }

    // 娓呯┖褰撳墠宸查€変腑鐨勭墝
    dispatch(clearSelection())



    // 鍙戦€?pass_turn 浜嬩欢缁欐湇鍔＄
    socket.emit('pass_turn', {
      roomId,
      userId: user.id || user.name,
    })

    // 鍋滄鏈疆鍊掕鏃?
    stopTurnTimer()

    // 鏍囪鏈湴涓洪潪鍑虹墝鏂?
    setTurnState(false, false)
  }

  // 澶勭悊鎶?涓嶆姠鎸夐挳鐐瑰嚮锛坆id = true 鎴?false锛?
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
        appendSystemMessage(`浣犻€夋嫨浜嗭細${bid ? '鎶㈠湴涓? : '涓嶆姠'}`)
      },
      onError: (msg) => appendSystemMessage(msg)
    })
  }

  // 鍑虹墝鎻愮ず鍏ュ彛锛氫紭鍏堢敤鏈湴绠楁硶锛屽鏋滃紑鍚簡 LLM 鍐嶈蛋鏈嶅姟绔彁绀?
  const handleHint = () => {
    // 鎾斁鎻愮ず闊虫晥
    soundManager.playHint()

    if (!isMyTurn) {

      return
    }

    if (!roomId || !user) {
      appendSystemMessage('鏃犳硶杩炴帴鏈嶅姟鍣紝鏃犳硶鑾峰彇鍑虹墝鎻愮ず')
      return
    }

    if (myCards.length === 0) {

      return
    }

    const socket = globalSocket.getSocket()
    if (!socket) {
      appendSystemMessage('Socket 鏈繛鎺ワ紝鏃犳硶璇锋眰鎻愮ず')
      return
    }

    // canPass === false 鏃惰〃绀哄綋鍓嶄负棣栨墜鍑虹墝锛涘惁鍒欎负璺熺墝
    const isFollowPlay =
      !!lastPlayedCards && !!lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && canPass
    const lastCards: string[] | null = isFollowPlay ? (lastPlayedCards!.cards as string[]) : null

    // 鑾峰彇鎵€鏈夊彲琛岀殑鎻愮ず鏂规
    const allHints = CardHintHelper.getAllHints(myCards, lastCards)


    // 鎯呭喌 1锛氳窡鐗岃疆娆′笖鍙互涓嶅嚭锛屼絾娌℃湁浠讳綍鍙嚭鐨勭墝 鈫?鑷姩涓嶅嚭
    if (isFollowPlay && canPass && (!allHints || allHints.length === 0)) {

      handlePass()
      appendSystemMessage('褰撳墠娌℃湁鍙嚭鐨勭墝锛岀郴缁熷凡鑷姩涓轰綘閫夋嫨涓嶅嚭')
      return
    }

    // 鎯呭喌 2锛氬彧鏈変竴绉嶅彲琛屾柟妗堟椂锛岀洿鎺ュ簲鐢ㄨ繖涓€绉?
    if (allHints && allHints.length === 1) {
      const onlyHint = allHints[0]


      dispatch(clearSelection())
      onlyHint.forEach((card) => dispatch(toggleCardSelection(card)))

      appendSystemMessage('宸叉牴鎹敮涓€鎻愮ず鑷姩涓轰綘閫夋嫨浜嗕竴鎵嬬墝')
      return
    }

    // 鎯呭喌 3锛氬€欓€夋柟妗堟暟閲?>= 2
    const llmSettings = getLlmSettings()

    // 3.a 鏈湴鎻愮ず妯″紡锛氫笉寮€鍚?LLM 鏃讹紝鐢ㄥ墠绔畻娉曠粰鍑烘彁绀?
    if (!llmSettings.enabled) {

      const localHint = CardHintHelper.getHint(myCards, lastCards)
      if (!localHint || localHint.length === 0) {

        return
      }

      dispatch(clearSelection())
      localHint.forEach((card) => dispatch(toggleCardSelection(card)))
      appendSystemMessage('宸叉牴鎹湰鍦版彁绀鸿嚜鍔ㄤ负浣犻€夋嫨浜嗕竴鎵嬬墝')
      return
    }

    // 3.b 褰撳€欓€夋柟妗堟暟閲?>= 2 涓斿惎鐢ㄤ簡 LLM 鏃讹紝浜ょ粰鏈嶅姟绔喅绛?

    // 鍏堟妸褰撳墠鎵嬬墝鍜屼笂瀹剁墝淇濆瓨涓嬫潵锛屼究浜庢湇鍔＄澶辫触鏃舵湰鍦板厹搴?
    hintContextRef.current = {
      myCards: [...myCards],
      lastCards: lastCards ? [...lastCards] : null,
    }

    console.log('[Hint] 鍊欓€夋柟妗?>= 2锛岃浆鐢辨湇鍔＄ LLM 鎻愮ず:', {
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

  // 宸ュ叿鏂规硶锛氭牴鎹?shouldSelect 鍐冲畾鏄惁閫変腑鏌愬紶鐗?
  const updateCardSelection = (cardStr: string, shouldSelect: boolean) => {
    const isSelected = selectedCards.includes(cardStr)
    if (shouldSelect && !isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }

    } else if (!shouldSelect && isSelected) {
      dispatch(toggleCardSelection(cardStr))
      const now = Date.now()
      if (now - lastSoundTimeRef.current > 50) {
        soundManager.playSound('card_select')
        lastSoundTimeRef.current = now
      }

    }
  }

  // 璁板綍鏈€杩戝鐞嗙殑鐗屼互鍙婃渶杩戜竴娆℃挱鏀鹃€夌墝闊虫晥鐨勬椂闂?
  const lastProcessedCardRef = useRef<string | null>(null)
  const lastSoundTimeRef = useRef<number>(0)

  // 鎵嬬墝鍖哄煙鐨?PointerDown 浜嬩欢锛氭敮鎸佹嫋鎷介€夋嫨澶氬紶鐗?
  const handleCardPointerDown = (cardStr: string, ev: any) => {
    ev.preventDefault()
    ev.stopPropagation()
    
    // 閲婃斁 pointer capture锛岄伩鍏嶆嫋鎷芥椂浜嬩欢琚攣瀹氬湪鏌愪釜鍏冪礌涓?
    if (ev.target && ev.target.setPointerCapture) {
      try {
        ev.target.releasePointerCapture(ev.pointerId)
      } catch (e) {
        // 蹇界暐閲婃斁澶辫触鐨勫紓甯?
      }
    }
    


    // 鏍规嵁褰撳墠鏄惁宸查€変腑锛屽喅瀹氭湰娆℃嫋鎷芥槸閫変腑妯″紡杩樻槸鍙栨秷妯″紡
    const isSelected = selectedCards.includes(cardStr)
    const mode: 'select' | 'deselect' = isSelected ? 'deselect' : 'select'

    startDragSelect(mode)
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, mode === 'select')
  }

  // Pointer 缁忚繃鍏朵粬鐗屾椂锛屾牴鎹嫋鎷芥ā寮忔洿鏂伴€変腑鐘舵€?
  const handleCardPointerEnter = (cardStr: string, ev: any) => {
    if (!isDragSelecting || !dragSelectMode) return
    if (lastProcessedCardRef.current === cardStr) return // 宸插鐞嗚繃璇ョ墝鍒欎笉閲嶅澶勭悊
    
    ev.preventDefault()
    lastProcessedCardRef.current = cardStr
    updateCardSelection(cardStr, dragSelectMode === 'select')
  }

  // 鎷栨嫿杩囩▼涓紝鏍规嵁鎸囬拡浣嶇疆鍛戒腑瀵瑰簲鐨勭墝
  const handleHandPointerMove = (ev: React.PointerEvent) => {
    if (!isDragSelecting || !dragSelectMode) return
    
    // 浣跨敤 elementFromPoint 鍛戒腑褰撳墠鎸囬拡涓嬫柟鐨?DOM 鍏冪礌
    const element = document.elementFromPoint(ev.clientX, ev.clientY)
    if (!element) return
    
    // 鎵惧埌鏈€杩戠殑 .card 鍏冪礌
    const cardElement = element.closest('.card') as HTMLElement
    if (!cardElement) return
    
    // 浠?data-card 灞炴€т腑璇诲彇鐗岄潰瀛楃涓?
    const cardKey = cardElement.getAttribute('data-card')
    if (!cardKey || lastProcessedCardRef.current === cardKey) return
    
    lastProcessedCardRef.current = cardKey
    updateCardSelection(cardKey, dragSelectMode === 'select')
  }

  // 鎷栨嫿缁撴潫鏃讹紝娓呯悊鎷栨嫿閫夋嫨鐘舵€?
  const handleHandPointerUp = () => {
    if (!isDragSelecting) return
    stopDragSelect()
    lastProcessedCardRef.current = null
  }

  // handleSendChat 已由ChatPanel组件内部处理

  // 鏍规嵁鎵嬬墝鏁伴噺鍜屽鍣ㄥ搴︼紝鍔ㄦ€佽绠楁墜鐗屼箣闂寸殑閲嶅彔
  useEffect(() => {
    const calculateCardOverlap = () => {
      const handSection = document.querySelector('.player-hand-section') as HTMLElement | null
      const cards = document.querySelectorAll('.player-hand .card')
      
      if (!handSection || cards.length === 0) return
      
      // 鎵嬬墝瀹瑰櫒瀹藉害銆佹墜鐗屾暟閲忓拰鍗曞紶鐗屽搴?
      const containerWidth = handSection.clientWidth // 鎵嬬墝鍖哄煙鎬诲搴?
      const n = myCards.length || cards.length       // 鎵嬬墝鏁伴噺
      const cardWidth = (cards[0] as HTMLElement).offsetWidth         // 鍗曞紶鐗岀殑鍙瀹藉害

      if (n <= 1 || cardWidth <= 0 || containerWidth <= cardWidth) {
        return
      }

      // 甯屾湜鍦ㄥ鍣ㄥ搴﹀唴骞冲潎閾哄紑鎵€鏈夌墝锛屽苟闄愬埗閲嶅彔鑼冨洿
      // 浠?visibleWidth 涓虹浉閭讳袱寮犵墝鐨勭悊璁洪棿璺濓紝鍒?overlap = visibleWidth - cardWidth
      const availableWidth = containerWidth - cardWidth
      const visibleWidth = availableWidth / (n - 1)

      // overlap 涓鸿礋鏁拌〃绀虹墝鏈夐噸鍙狅紱鏍规嵁 visibleWidth 鍔ㄦ€佽皟鏁?
      let overlap = visibleWidth - cardWidth

      // 灏嗛噸鍙犵殑缁濆鍊奸檺鍒跺湪 [minOverlapAbs, maxOverlapAbs] 鍖洪棿鍐?
      const maxOverlapAbs = cardWidth * 0.85   // 鏈€澶у厑璁搁噸鍙?85%
      const minOverlapAbs = cardWidth * 0.2    // 鏈€灏忛噸鍙?20%

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
      console.log('[CardLayout] 璁＄畻閲嶅彔瀹藉害:', {
        containerWidth,
        cardCount: n,
        domCardCount: cards.length,
        cardWidth,
        visibleWidth,
        overlap,
        actualTotalWidth,
      })
    }
    
    // 寤惰繜涓€灏忔鏃堕棿鍐嶈绠楋紝纭繚 DOM 宸茬粡瀹屾垚甯冨眬
    const timer = setTimeout(calculateCardOverlap, 100)
    
    // 鐩戝惉绐楀彛灏哄鍙樺寲锛屽疄鏃舵洿鏂伴噸鍙犳晥鏋?
    window.addEventListener('resize', calculateCardOverlap)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', calculateCardOverlap)
    }
  }, [myCards]) // 鎵嬬墝鍙樺寲鏃堕噸鏂拌绠楅噸鍙?

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

  // 灏嗗綋鍓嶉挶鍖呯Н鍒嗗啓鍏?sessionStorage锛屼緵涓嬫杩涘叆鎴块棿鏃跺厹搴曚娇鐢?
  useEffect(() => {
    if (walletScore == null) return
    try {
      sessionStorage.setItem('lastWalletScore', String(walletScore))
    } catch {
      // ignore storage error
    }
  }, [walletScore])

  // 涓€灞€缁撴潫涓旀湁缁撶畻缁撴灉鏃讹紝鏄剧ず缁撶畻闈㈡澘
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      openSettlement()
    }
  }, [gameStatus, gameState.gameResult])

  // 瀵规暣灞€缁撶畻鍚庣殑鈥滆嚜鍔ㄥ啀鏉ヤ竴灞€鈥濋€昏緫鍋氱粺涓€绠＄悊锛堝惈 30 绉掑€掕鏃讹級
  useEffect(() => {
    if (gameStatus === 'finished' && gameState.gameResult) {
      // 鍒囨崲鍒扮粨绠楁€佹椂锛屾竻绌烘湰灞€鐨?AI 鎻愮ず锛屽苟鍚姩 30 绉掕嚜鍔ㄥ啀鏉ヤ竴灞€鍊掕鏃?
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
            // 鍊掕鏃剁粨鏉燂紝娓呯悊瀹氭椂鍣ㄥ苟鑷姩绂诲紑鎴块棿
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
      // 闈炵粨绠楅樁娈碉紝娓呯悊鑷姩鍐嶆潵涓€灞€鐩稿叧鐘舵€?
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
      {/* 鏁翠釜娓告垙妗岄潰鍖哄煙 */}
      <div className="game-table">
        {/* 搴曠墝灞曠ず鍖?*/}
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

        {/* 涓ぎ缁撶畻缁撴灉 + 鍐嶆潵涓€灞€ / 杩斿洖澶у巺鎸夐挳锛堝浘2 甯冨眬锛?*/}
        {gameStatus === 'finished' && gameState.gameResult && (
          <div className="center-area">
            <div
              className={`center-result-banner ${
                gameState.gameResult.landlordWin ? 'landlord' : 'farmer'
              }`}
            >
              {gameState.gameResult.landlordWin ? '鍦颁富鑳滃埄' : '鍐滄皯鑾疯儨'}
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
                鍐嶆潵涓€灞€
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
                  ? `杩斿洖澶у巺锛?{autoReplayCountdown}绉掞級`
                  : '杩斿洖澶у巺'}
              </button>
            </div>
          </div>
        )}

        {/* 涓婃柟宸﹀彸涓ゅ鐜╁鍖哄煙 */}
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
                const isRed = suit === '鈾? || suit === '鈾? || isJoker === 'big'
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
                        {isBottomLandlord ? '鍦颁富' : '鍐滄皯'}
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
            {/* 褰撳墠杞埌鐨勫簳閮ㄧ帺瀹朵俊鎭?*/}
            <div className="player-avatar-container">
              {landlordId === currentPlayer.id && (
                <div className="landlord-badge" title="鍦颁富">馃憫</div>
              )}
              <div className="player-avatar">{renderPlayerAvatar(currentPlayer.avatar)}</div>
            </div>
            <div className="player-info-below">
              <div className="player-coins">
                <span className="player-coins-icon" aria-hidden="true" />
                <span className="player-coins-text">
                  {bottomCoinValue >= 10000
                    ? `${(bottomCoinValue / 10000).toFixed(1)}涓嘸
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

        {/* 褰撳墠鐜╁閫夋嫨涓嶅嚭鏃讹紝搴曢儴鏄剧ず鈥滀笉鍑衡€?*/}
        {gameStatus === 'playing' && user && passedPlayers[user.id || user.name || ''] && (
          <div className="bottom-played-area">
            <div className="pass-text">涓嶅嚭</div>
          </div>
        )}

        {/* 鐜╁搴曢儴鎵嬬墝鍖哄煙锛堟柊鐗堝墠绔疄鐜帮級 */}
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

        {/* 搴曢儴鎺у埗鍖?*/}
        <div className="game-controls">
          {/* 绛夊緟鍏朵粬鐜╁ */}
          {gameStatus === 'waiting' && (
            <div className="waiting-controls">
              <span className="waiting-text">绛夊緟鍏朵粬鐜╁鍔犲叆...</span>
            </div>
          )}

          {/* 鎶㈠湴涓?UI */}
          <BiddingControls
            visible={gameStatus === 'bidding' && showBiddingUI}
            timer={biddingTimer}
            onBid={handleBid}
          />

          {/* 鍑虹墝鎿嶄綔鍖?*/}
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

      {/* 鑱婂ぉ闈㈡澘 */}
      <ChatPanel
        visible={chatVisible}
        messages={chatMessages}
        currentMessage={chatMessage}
        onClose={toggleChat}
        onMessageChange={updateChatInput}
        onSend={handleSendChat}
      />

      {/* AI 鍑虹墝璁板綍渚ц竟闈㈡澘 */}
      <AiHintPanel
        visible={showAiPanel}
        history={aiHintHistory}
        onClose={() => setShowAiPanel(false)}
        onClear={() => {
          setAiHintHistory([])
          aiHintCounterRef.current = 0
        }}
      />

      {/* 鍙充笅瑙掞細AI 闈㈡澘 + 鑱婂ぉ鎸夐挳 */}
      {!chatVisible && !showAiPanel && (
        <div className="bottom-right-ui">
          {/* AI 闈㈡澘鍏ュ彛鎸夐挳 */}
          {aiHintHistory.length > 0 && (
            <button 
              className="ai-toggle-btn"
              onClick={() => setShowAiPanel(true)}
              title="鏌ョ湅 AI 鍑虹墝璁板綍"
            >
              AI
              {aiHintHistory.length > 0 && (
                <span className="ai-badge">{aiHintHistory.length}</span>
              )}
            </button>
          )}
          {/* 鎵撳紑鑱婂ぉ渚ц竟鏍?*/}
          <button 
            className="chat-toggle-btn"
            onClick={toggleChat}
            title="鎵撳紑鑱婂ぉ"
          >
            馃挰
          </button>
        </div>
      )}
      </div>

      {/* 缁撶畻闈㈡澘 */}
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
