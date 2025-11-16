import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Toast } from 'antd-mobile'
import { useAuth } from '@/context/AuthContext'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
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
  type SettlementAchievements,
} from '@/store/slices/gameSlice'
import { CardHintHelper } from '@/utils/cardHintHelper'
import { soundManager } from '@/utils/sound'
import { motion, AnimatePresence } from 'framer-motion'
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

  // Local state
  const [connected, setConnected] = useState(false)
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
  const [dragSelectMode, setDragSelectMode] = useState<'select' | 'deselect' | null>(null)

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

    // 左侧玩家（逆时针下一位）
    const leftPlayer = filteredPlayers.length >= 2
      ? filteredPlayers[(myIndex + 1) % filteredPlayers.length]
      : null

    // 右侧玩家（逆时针再下一位）
    const rightPlayer = filteredPlayers.length >= 3
      ? filteredPlayers[(myIndex + 2) % filteredPlayers.length]
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
  const settlementAchievements = useMemo<SettlementAchievements>(
    () => gameState.gameResult?.achievements ?? {},
  [gameState.gameResult?.achievements])
  const settlementAchievementEntries = useMemo<Array<[string, string[]]>>(
    () => Object.entries(settlementAchievements).map(([playerId, list]) => [playerId, list || []]),
  [settlementAchievements])

  const multiplierDescriptions = useMemo(() => {
    if (!settlementScore) return []
    const multipliers = settlementScore.playerScores?.[0]?.multipliers
    if (!multipliers) return []
    const desc: string[] = []
    if (multipliers.bomb > 1) {
      desc.push(`炸弹×${Math.log2(multipliers.bomb)}`)
    }
    if (multipliers.rocket > 1) {
      desc.push(`王炸×${Math.log(multipliers.rocket) / Math.log(4)}`)
    }
    if (multipliers.spring > 1) {
      desc.push('春天')
    }
    if (multipliers.antiSpring > 1) {
      desc.push('反春')
    }
    if (desc.length === 0) {
      desc.push('基础倍数')
    }
    desc.push(`总倍数 ×${multipliers.total}`)
    return desc
  }, [settlementScore])

  const handleViewProfile = () => {
    navigate('/profile')
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
    
    return { rank, suit, isJoker: null }
  }

  const STRAIGHT_RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A']
  const ALL_RANKS_FOR_ORDER = [...STRAIGHT_RANKS, '2']

  const isStraightRanks = (ranks: string[]): boolean => {
    if (!ranks || ranks.length < 5) return false
    const indices = ranks
      .map((r) => STRAIGHT_RANKS.indexOf(r))
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b)
    if (indices.length !== ranks.length) return false
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) return false
    }
    return true
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

    soundManager.playBackgroundMusic()

    // 监听连接状态
    const handleConnect = () => {
      console.log('✅ Socket 已连接，准备加入房间')
      setConnected(true)
      
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
      setConnected(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // 如果已经连接，立即加入房间
    if (socket.connected) {
      setConnected(true)
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
      socket.off('disconnect', handleDisconnect)
      soundManager.stopBackgroundMusic()
    }
  }, [user, roomId, dispatch])

  // 监听游戏事件
  useEffect(() => {
    if (!connected) return

    const socket = globalSocket.getSocket()
    if (!socket) return
    
    console.log('🔍 [前端调试] 注册 Socket 事件监听器, Socket ID:', socket.id)

    // 房间加入成功
    const handleRoomJoined = (data: any) => {
      console.log('✅ 加入房间成功:', data)
      Toast.show({ content: '加入房间成功', icon: 'success' })
    }

    // 加入游戏成功
    const handleJoinGameSuccess = (data: any) => {
      console.log('🎉 [加入游戏成功] 收到数据:', data)

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
      Toast.show({ content: '游戏状态已恢复，继续游戏', icon: 'success' })
      
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
      
      console.log(`📋 当前阶段: ${data.phase || '未知'}`)
    }

    // 玩家加入
    const handlePlayerJoined = (data: any) => {
      console.log('👤 玩家加入:', data)
      // 参考 frontend: onPlayerJoined
      if (data.playerName !== user?.name) {
        Toast.show({ content: `${data.playerName || '玩家'} 加入房间`, icon: 'success' })
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

    // 玩家离开
    const handlePlayerLeft = (data: any) => {
      console.log('👋 玩家离开:', data)
      Toast.show({ content: `${data.playerName || '玩家'} 离开房间`, icon: 'fail' })
      
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
      }
    }

    // 玩家准备
    const handlePlayerReady = (data: any) => {
      console.log('✅ 玩家准备事件:', data)
      
      // 只在其他玩家准备时显示 Toast，避免自己准备时重复提示
      if (data.playerName && data.playerName !== user?.name) {
        Toast.show({ content: `${data.playerName} 已准备`, icon: 'success' })
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
      setShowSettlement(false)
      dispatch(prepareNextGame())
      Toast.show({ content: '🎮 游戏开始！所有玩家已准备完毕', icon: 'success' })
    }

    // 发牌事件（房间广播版本）
    const handleDealCardsAll = (data: any) => {
      console.log('🎯 [发牌事件-广播] 收到数据:', data)
      
      // 找到当前玩家的牌
      const myCards = data.players?.find((p: any) => 
        p.playerId === user?.id || p.playerId === user?.name
      )
      
      if (myCards && myCards.cards && myCards.cards.length > 0) {
        console.log('🎴 找到我的牌，开始发牌，牌数:', myCards.cards.length)
        
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
        
        Toast.show({ content: '🎴 发牌完成，开始叫地主', icon: 'success' })
      } else {
        console.error('❌ 未找到我的牌数据，currentPlayerId:', user?.id || user?.name)
        console.error('❌ 所有玩家数据:', data.players)
      }
    }

    // 叫地主开始
    const handleBiddingStart = (data: any) => {
      console.log('🎲 开始叫地主:', data)
      Toast.show({ 
        content: `🎲 开始叫地主！第一个玩家：${data.firstBidderName || '未知'}`, 
        icon: 'success' 
      })
      
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
      Toast.show({ 
        content: `${data.userName || '玩家'} 选择：${bidText}`, 
        icon: 'success' 
      })
      
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
        
        Toast.show({ 
          content: `👑 ${data.landlordName || '玩家'} 成为地主！`, 
          icon: 'success',
          duration: 2000
        })
        
        // 如果自己是地主，显示底牌并手动添加到手牌
        if (isLandlord) {
          console.log('✅ [地主确定] 我是地主，底牌:', data.bottomCards)
          Toast.show({ 
            content: `🎴 您是地主！获得 ${data.bottomCards?.length || 3} 张底牌`, 
            icon: 'success' 
          })
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

          // 每次轮到自己出牌时，重置提示索引，保证提示序列从头开始
          CardHintHelper.resetHintIndex()
          
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
          
          // 播放轮到出牌提示音
          soundManager.playTurnStart()

          Toast.show({ content: '🎯 轮到你出牌了！', icon: 'success' })
        } else {
          // 不是我的回合
          setIsMyTurn(false)
          setCanPass(false)
          Toast.show({ content: `等待 ${data.playerName || '玩家'} 出牌...`, icon: 'loading' })
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
      Toast.show({ content: message, icon: 'fail' })
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
        
        // 显示出牌消息
        if (data.playerId !== (user?.id || user?.name)) {
          const cardTypeDesc = data.cardType ? data.cardType.description : ''
          Toast.show({ 
            content: `${data.playerName} 出了 ${cardTypeDesc}`, 
            icon: 'success' 
          })
        }
      }
    }

    // 玩家不出
    const handlePlayerPassed = (data: any) => {
      console.log('⏭️ 玩家不出:', data)
      if (data.playerId) {
        // 播放不出音效
        soundManager.playPass()
        
        dispatch(passAction(data.playerId))
        Toast.show({ content: `${data.playerName || '玩家'} 不出`, icon: 'success' })
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
      
      // 显示结算消息
      const winnerName = data.winnerName || '未知玩家'
      const role = data.winnerRole === 'landlord' ? '地主' : '农民'
      Toast.show({ 
        content: `🎊 游戏结束！${winnerName}（${role}）获胜！`, 
        icon: 'success',
        duration: 2000
      })
      
      // 延迟显示结算界面
      setTimeout(() => {
        setShowSettlement(true)
      }, 1500)
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
  }, [connected, dispatch])

  useEffect(() => {
    return () => {
      if (dealAnimationTimeoutRef.current) {
        clearTimeout(dealAnimationTimeoutRef.current)
        dealAnimationTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isMyTurn) return
    if (turnTimer !== 0) return

    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }

    if (canPass) {
      handlePass()
    } else {
      // 必须出牌且超时：尝试自动按提示出一手牌（参考上家牌型）
      if (myCards.length === 0) return
      if (playPendingRef.current) return

      const lastCards: string[] | null =
        lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
          ? lastPlayedCards.cards
          : null

      const autoHint = CardHintHelper.getHint(myCards, lastCards)
      if (autoHint && autoHint.length > 0) {
        doPlayCards(autoHint)
        Toast.show({ content: '⏰ 时间到，已为你自动出牌', icon: 'success' })
      } else {
        Toast.show({ content: '⏰ 时间到，但没有可出的牌', icon: 'fail' })
      }
    }
  }, [turnTimer, isMyTurn, canPass])

  // 当轮到自己出牌且整手牌本身就是一个完整牌型，并且在同牌型前提下能压过上家时，自动立刻出牌
  useEffect(() => {
    if (!isMyTurn) return
    if (playPendingRef.current) return
    if (!myCards || myCards.length === 0) return

    const autoFullHand = CardHintHelper.getFullHandIfSinglePattern(myCards)
    if (!autoFullHand || autoFullHand.length !== myCards.length) return

    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    const canBeat = CardHintHelper.canFullHandBeatLast(autoFullHand, lastCards)
    if (!canBeat) return

    console.log('🤖 [自动出牌] 整手牌是完整牌型且可压过上家，自动全出:', autoFullHand)
    doPlayCards(autoFullHand)
  }, [isMyTurn, myCards, lastPlayedCards])

  // 离开房间 - 退出游戏回到首页
  const handleLeaveRoom = () => {
    Dialog.confirm({
      content: '确定要退出游戏吗？',
      onConfirm: () => {
        if (roomId) {
          globalSocket.leaveGame(roomId)
        }
        sessionStorage.removeItem('lastRoomId')
        sessionStorage.removeItem('lastRoomTime')
        dispatch(resetGame())
        navigate('/rooms', { replace: true })
      },
    })
  }

  // 准备/开始游戏
  const handleStartGame = () => {
    if (!roomId || !user) return
    
    const socket = globalSocket.getSocket()
    if (!socket) {
      Toast.show({ content: 'Socket 未连接', icon: 'fail' })
      return
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
      Toast.show({ content: 'Socket 未连接', icon: 'fail' })
      return
    }

    if (cardsToPlay.length === 0) {
      Toast.show({ content: '请选择要出的牌', icon: 'fail' })
      return
    }

    if (!isMyTurn) {
      Toast.show({ content: '还没轮到你出牌', icon: 'fail' })
      return
    }

    if (playPendingRef.current) {
      Toast.show({ content: '正在等待服务器确认...', icon: 'loading' })
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
      Toast.show({ content: 'Socket 未连接', icon: 'fail' })
      return
    }

    if (!isMyTurn) {
      Toast.show({ content: '还没轮到你出牌', icon: 'fail' })
      return
    }

    if (!canPass) {
      Toast.show({ content: '不能不出', icon: 'fail' })
      return
    }

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
      Toast.show({ content: 'Socket 未连接', icon: 'fail' })
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

    // 显示消息
    const bidText = bid ? '抢地主' : '不抢'
    Toast.show({ content: `您选择：${bidText}`, icon: 'success' })
  }

  // 提示 - 参考 frontend 实现（接入简化版 CardHintHelper）
  const handleHint = () => {
    // 播放提示音效
    soundManager.playHint()
    
    if (!isMyTurn) {
      console.log('💡 [提示] 还没轮到你出牌，忽略提示操作')
      return
    }

    if (myCards.length === 0) {
      console.log('💡 [提示] 当前没有手牌')
      return
    }

    // 根据当前是否允许“不要”，决定是否参考上家牌型
    // canPass === false 视为新一轮首家出牌，不参考 lastPlayedCards
    const isFollowPlay = !!lastPlayedCards && !!lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && canPass
    const lastCards: string[] | null = isFollowPlay ? lastPlayedCards!.cards : null

    const hint = CardHintHelper.getHint(myCards, lastCards)

    if (!hint || hint.length === 0) {
      // 跟牌场景下，如果没有任何可以压过上家的牌，自动选择“不出”
      if (isFollowPlay && canPass) {
        handlePass()
        return
      }

      console.log('💡 [提示] 当前没有可供提示的出牌方案')
      return
    }

    // 清空之前的选牌，只选中提示中的牌
    dispatch(clearSelection())
    hint.forEach((card) => {
      dispatch(toggleCardSelection(card))
    })
    console.log('💡 [提示] 已为你选择一手推荐出牌:', hint)
  }

  // 根据目标状态更新某张牌是否选中（避免重复 toggle）
  const updateCardSelection = (cardStr: string, shouldSelect: boolean) => {
    const isSelected = selectedCards.includes(cardStr)
    if (shouldSelect && !isSelected) {
      dispatch(toggleCardSelection(cardStr))
      console.log('✅ 选中:', cardStr)
    } else if (!shouldSelect && isSelected) {
      dispatch(toggleCardSelection(cardStr))
      console.log('❌ 取消选中:', cardStr)
    }
  }

  // 指针按下：开始拖选或单选
  const handleCardPointerDown = (cardStr: string, ev: any) => {
    ev.preventDefault()
    console.log('🎴 PointerDown 手牌:', cardStr)

    // 是否在跟牌阶段：参考 handleHint 的逻辑
    const isFollowPlay = !!lastPlayedCards && !!lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && canPass

    if (isFollowPlay) {
      const lastCards = lastPlayedCards.cards as string[]
      const lastRanks = lastCards.map((c) => parseCard(c).rank)

      const isLastPair = lastCards.length === 2 && lastRanks[0] === lastRanks[1]
      const isLastStraight = isStraightRanks(lastRanks)
      const rankCountMap: Record<string, number> = {}
      lastRanks.forEach((r) => {
        rankCountMap[r] = (rankCountMap[r] || 0) + 1
      })
      const countValues = Object.values(rankCountMap).sort((a, b) => a - b)
      const isLastTripleWithSingle =
        lastCards.length === 4 && countValues.length === 2 && countValues[0] === 1 && countValues[1] === 3
      const isLastTripleWithPair =
        lastCards.length === 5 && countValues.length === 2 && countValues[0] === 2 && countValues[1] === 3

      // 1) 上家是对子：点一张牌时整对选中/取消
      if (isLastPair) {
        const { rank } = parseCard(cardStr)
        const groupCards = myCards.filter((c: string) => parseCard(c).rank === rank)
        if (groupCards.length >= 2) {
          const allSelected = groupCards.every((c: string) => selectedCards.includes(c))
          const mode: 'select' | 'deselect' = allSelected ? 'deselect' : 'select'

          setIsDragSelecting(true)
          setDragSelectMode(mode)
          if (mode === 'select') {
            // 选择新的一对时，先清空之前的选牌，再只选中当前这一对
            dispatch(clearSelection())
            groupCards.forEach((c: string) => dispatch(toggleCardSelection(c)))
          } else {
            // 取消当前这一对的选中状态，保持其它牌的选中状态不变
            groupCards.forEach((c: string) => updateCardSelection(c, false))
          }
          return
        }
      }

      // 2) 上家是顺子：点中某张牌时，尝试从该点数开始选出同长度顺子
      if (isLastStraight) {
        const { rank } = parseCard(cardStr)
        const startIdx = STRAIGHT_RANKS.indexOf(rank)
        const needLen = lastCards.length

        if (startIdx >= 0 && startIdx + needLen <= STRAIGHT_RANKS.length) {
          const needRanks = STRAIGHT_RANKS.slice(startIdx, startIdx + needLen)
          const comboCards: string[] = []

          for (const r of needRanks) {
            const candidates = myCards.filter((c: string) => parseCard(c).rank === r)
            if (candidates.length === 0) {
              comboCards.length = 0
              break
            }
            // 优先使用尚未选中的牌，避免干扰其它结构
            const notSelected = candidates.find((c: string) => !selectedCards.includes(c))
            comboCards.push(notSelected || candidates[0])
          }

          if (comboCards.length === needLen) {
            const allSelected = comboCards.every((c: string) => selectedCards.includes(c))
            const mode: 'select' | 'deselect' = allSelected ? 'deselect' : 'select'

            setIsDragSelecting(true)
            setDragSelectMode(mode)

            comboCards.forEach((c: string) => updateCardSelection(c, mode === 'select'))
            return
          }
        }
      }

      // 3) 上家是三带一：点击三张点数时，自动选择“三张+最小一张单牌”
      if (isLastTripleWithSingle) {
        const { rank } = parseCard(cardStr)
        const sameRankCards = myCards.filter((c: string) => parseCard(c).rank === rank)
        if (sameRankCards.length >= 3) {
          const tripleCards = sameRankCards.slice(0, 3)
          const remaining = myCards.filter((c: string) => !tripleCards.includes(c))

          const remainingGroups: Record<string, string[]> = {}
          remaining.forEach((c: string) => {
            const r = parseCard(c).rank
            if (r === rank) return
            if (!remainingGroups[r]) remainingGroups[r] = []
            remainingGroups[r].push(c)
          })

          const singleRanks = Object.entries(remainingGroups)
            .filter(([, cards]) => cards.length >= 1)
            .map(([r]) => r)
            .sort((a, b) => {
              const ia = ALL_RANKS_FOR_ORDER.indexOf(a)
              const ib = ALL_RANKS_FOR_ORDER.indexOf(b)
              if (ia === -1 && ib === -1) return a.localeCompare(b)
              if (ia === -1) return 1
              if (ib === -1) return -1
              return ia - ib
            })

          if (singleRanks.length > 0) {
            const singleRank = singleRanks[0]
            const singleCard = remainingGroups[singleRank][0]
            const comboCards = [...tripleCards, singleCard]

            const allSelected = comboCards.every((c: string) => selectedCards.includes(c))
            const mode: 'select' | 'deselect' = allSelected ? 'deselect' : 'select'

            setIsDragSelecting(true)
            setDragSelectMode(mode)

            comboCards.forEach((c: string) => updateCardSelection(c, mode === 'select'))
            return
          }
        }
      }

      // 4) 上家是三带二：点击三张点数时，自动选择“三张+最小一对”
      if (isLastTripleWithPair) {
        const { rank } = parseCard(cardStr)
        const sameRankCards = myCards.filter((c: string) => parseCard(c).rank === rank)
        if (sameRankCards.length >= 3) {
          const tripleCards = sameRankCards.slice(0, 3)
          // 剩余牌中找最小的一对，点数不能与三张相同
          const remaining = myCards.filter((c: string) => !tripleCards.includes(c))
          const remainingGroups: Record<string, string[]> = {}
          remaining.forEach((c: string) => {
            const r = parseCard(c).rank
            if (r === rank) return
            if (!remainingGroups[r]) remainingGroups[r] = []
            remainingGroups[r].push(c)
          })

          const pairRanks = Object.entries(remainingGroups)
            .filter(([, cards]) => cards.length >= 2)
            .map(([r]) => r)
            .sort((a, b) => {
              const ia = ALL_RANKS_FOR_ORDER.indexOf(a)
              const ib = ALL_RANKS_FOR_ORDER.indexOf(b)
              if (ia === -1 && ib === -1) return a.localeCompare(b)
              if (ia === -1) return 1
              if (ib === -1) return -1
              return ia - ib
            })

          if (pairRanks.length > 0) {
            const pairRank = pairRanks[0]
            const pairCards = remainingGroups[pairRank].slice(0, 2)
            const comboCards = [...tripleCards, ...pairCards]

            const allSelected = comboCards.every((c: string) => selectedCards.includes(c))
            const mode: 'select' | 'deselect' = allSelected ? 'deselect' : 'select'

            setIsDragSelecting(true)
            setDragSelectMode(mode)

            comboCards.forEach((c) => updateCardSelection(c, mode === 'select'))
            return
          }
        }
      }
    }

    // 默认：按单张牌进行选中/取消，并可继续拖选
    const isSelected = selectedCards.includes(cardStr)
    const mode: 'select' | 'deselect' = isSelected ? 'deselect' : 'select'

    setIsDragSelecting(true)
    setDragSelectMode(mode)
    updateCardSelection(cardStr, mode === 'select')
  }

  // 指针滑过其它牌：根据当前模式批量选中/取消
  const handleCardPointerEnter = (cardStr: string, ev: any) => {
    if (!isDragSelecting || !dragSelectMode) return
    ev.preventDefault()
    updateCardSelection(cardStr, dragSelectMode === 'select')
  }

  // 指针抬起或离开手牌区域：结束拖选
  const handleHandPointerUp = () => {
    if (!isDragSelecting) return
    setIsDragSelecting(false)
    setDragSelectMode(null)
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
      
      // 立即显示自己的消息
      setChatMessages(prev => [...prev, {
        sender: user.name,
        message: chatMessage
      }])
      
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

  return (
    <div className="game-room-container">
      {/* 顶部信息栏 */}
      <div className="game-room-header">
        <div className="room-info">
          <span className="room-id">房间: {roomId}</span>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '✅ 已连接' : '❌ 未连接'}
          </span>
        </div>
        <Button size="small" color="danger" onClick={handleLeaveRoom}>
          退出房间
        </Button>
      </div>

      {/* 游戏桌面 */}
      <div className="game-table">
        {/* 底牌显示区域 - 桌面顶端中间 - 照抄 frontend */}
        {landlordCards.length > 0 && (
          <div className="bottom-cards-display">
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
                    {!isJoker && (
                      <div className="card-suit">
                        {suit}
                      </div>
                    )}
                  </div>
                )
              })}
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
                <div className="player-avatar">{leftPlayer.avatar || '👤'}</div>
                <div>
                  <div className="player-name">{leftPlayer.name}</div>
                  <div className="player-status">
                    {gameStatus === 'waiting'
                      ? (leftPlayer.isReady ? '✅ 已准备' : '⏳ 未准备')
                      : `${leftPlayer.cardCount || 0} 张`}
                  </div>
                </div>
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
                <div className="player-avatar">{rightPlayer.avatar || '👤'}</div>
                <div>
                  <div className="player-name">{rightPlayer.name}</div>
                  <div className="player-status">
                    {gameStatus === 'waiting'
                      ? (rightPlayer.isReady ? '✅ 已准备' : '⏳ 未准备')
                      : `${rightPlayer.cardCount || 0} 张`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 中央出牌区 - 仅展示已出牌牌面，提示迁移到头像倒计时 */}
        <div className="center-area">
          {lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && (
            <div className="played-cards-area">
              <div className="played-cards-container">
                {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                  const { rank, suit, isJoker } = parseCard(cardStr)
                  const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'

                  return (
                    <motion.div
                      key={index}
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
                        delay: index * 0.05,
                        type: 'spring',
                        stiffness: 280,
                        damping: 20,
                      }}
                    >
                      <div
                        className={`card-value ${isJoker ? 'joker-text' : ''}`}
                        style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                      >
                        {isJoker ? 'JOKER' : rank}
                      </div>
                      {!isJoker && <div className="card-suit">{suit}</div>}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 当前玩家信息 */}
        <div
          className={`current-player-info ${
            landlordId === (user?.id || user?.name) ? 'landlord' : ''
          } ${isBottomTurn ? 'turn-active' : ''}`}
        >
          {isBottomTurn && turnTimer > 0 && (
            <div className="turn-indicator">{turnTimer}</div>
          )}
          {landlordId === (user?.id || user?.name) && (
            <div className="landlord-badge" title="地主">👑</div>
          )}
          <div className="player-avatar">{currentPlayer?.avatar || user?.avatar || '👤'}</div>
          <div className="player-name">{currentPlayer?.name || user?.name}</div>
          <div className="player-status">
            {gameStatus === 'waiting'
              ? (currentPlayer?.isReady ? '✅ 已准备' : '⏳ 未准备')
              : `${myCards.length} 张`
            }
          </div>
        </div>

        {/* 手牌区域 - 照抄 frontend 结构 */}
        {myCards.length > 0 && (
          <div
            className="player-hand-section"
            onPointerUp={handleHandPointerUp}
            onPointerLeave={handleHandPointerUp}
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
                      className={`card ${isRed ? 'red' : 'black'} ${isSelected ? 'selected' : ''}`}
                      style={{ zIndex: index + 1 }}
                      onPointerDown={(ev) => handleCardPointerDown(cardStr, ev)}
                      onPointerEnter={(ev) => handleCardPointerEnter(cardStr, ev)}
                      layout
                      initial={isDealingAnimation ? { opacity: 0, y: -160, scale: 0.6, rotate: -6 } : false}
                      animate={{ opacity: 1, y: targetY, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, y: 40, scale: 0.9, rotate: 6, transition: { duration: 0.2 } }}
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
                      {!isJoker && (
                        <div className="card-suit">
                          {suit}
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
        {gameStatus === 'waiting' && (
          <div className="waiting-controls">
            <Button color="primary" size="large" onClick={handleStartGame}>
              {currentPlayer?.isReady ? '取消准备' : '准备'}
            </Button>
          </div>
        )}

        {/* 抢地主 UI - 照抄 frontend 结构 */}
        {gameStatus === 'bidding' && showBiddingUI && (
          <div className="bidding-actions" id="biddingActions">
            <div className="bidding-timer" id="biddingTimer">{biddingTimer}</div>
            <div className="bidding-buttons">
              <Button 
                color="warning" 
                size="large"
                onClick={() => handleBid(true)}
                style={{ 
                  background: '#f39c12',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '12px 40px'
                }}
              >
                抢地主
              </Button>
              <Button 
                color="default" 
                size="large"
                onClick={() => handleBid(false)}
                style={{ 
                  background: '#95a5a6',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '12px 40px'
                }}
              >
                不抢
              </Button>
            </div>
            <div className="bidding-hint" id="biddingHint">请选择是否抢地主</div>
          </div>
        )}

        {/* 出牌 UI - 照抄 frontend 结构 */}
        {(() => {
          console.log('🎮 [渲染检查] gameStatus:', gameStatus, 'isMyTurn:', isMyTurn)
          return gameStatus === 'playing' && isMyTurn
        })() && (
          <div className="game-actions" id="gameActions">
            {turnTimer > 0 && (
              <div className="turn-timer">⏰ {turnTimer}秒</div>
            )}
            <div className="game-buttons">
              <Button 
                size="large" 
                onClick={handleHint}
                style={{
                  background: '#17a2b8',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '12px 30px',
                  marginRight: '10px'
                }}
              >
                提示
              </Button>
              <Button 
                color="primary" 
                size="large" 
                onClick={handlePlayCards}
                style={{
                  background: '#007bff',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '12px 30px',
                  marginRight: '10px'
                }}
                disabled={playPending}
              >
                出牌
              </Button>
              <Button 
                size="large" 
                onClick={handlePass}
                disabled={!canPass}
                style={{
                  background: canPass ? '#6c757d' : '#a0a3a7',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '12px 30px'
                }}
              >
                {canPass ? '不出' : '首家必须出牌'}
              </Button>
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

      {/* 聊天切换按钮 */}
      {!chatVisible && (
        <button 
          className="chat-toggle-btn"
          onClick={() => setChatVisible(true)}
          title="打开聊天"
        >
          💬
        </button>
      )}

      {/* 结算界面 - 全屏覆盖层 */}
      {showSettlement && gameState.gameResult && (
        <div className="settlement-overlay">
          <div className="settlement-root">
            <div className="settlement-layout">
              <div className="settlement-panel settlement-panel-left">
                <h2 className="settlement-title">
                  {gameState.gameResult.landlordWin ? '🎊 地主获胜！' : '🎊 农民获胜！'}
                </h2>

                <div className="winner-info">
                  <div className="winner-avatar">👑</div>
                  <div className="winner-meta">
                    <div className="winner-name">{gameState.gameResult.winnerName || '未知玩家'}</div>
                    <div className="winner-role">
                      {gameState.gameResult.winnerRole === 'landlord' ? '地主' : '农民'}
                    </div>
                  </div>
                </div>

                {gameState.gameResult.score && (
                  <>
                    <div className="score-summary-grid">
                      <div className="score-item">
                        <span className="label">基础分</span>
                        <span className="value">{settlementScore?.baseScore ?? 1}</span>
                      </div>
                      <div className="score-item">
                        <span className="label">倍数</span>
                        <span className="value">×{settlementPlayerScores[0]?.multipliers?.total ?? 1}</span>
                      </div>
                    </div>

                    {multiplierDescriptions.length > 0 && (
                      <div className="score-multipliers">
                        <h4 className="section-subtitle">倍数详情</h4>
                        <div className="multiplier-tags">
                          {multiplierDescriptions.map((item, idx) => (
                            <span key={idx} className="multiplier-tag">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="settlement-panel settlement-panel-right">
                {gameState.gameResult.score && (
                  <div className="players-score">
                    <h3 className="section-title">玩家得分</h3>
                    <div className="players-score-list">
                      {settlementPlayerScores.map((ps: SettlementPlayerScore) => {
                        const isWinner = ps.isWinner
                        const isMe = ps.playerId === (user?.id || user?.name)
                        const scoreValue = ps.finalScore > 0 ? `+${ps.finalScore}` : ps.finalScore
                        return (
                          <div
                            key={ps.playerId}
                            className={`player-score-row ${isWinner ? 'winner' : ''} ${isMe ? 'me' : ''}`}
                          >
                            <div className="player-info">
                              <span className="player-name">{ps.playerName}</span>
                              <span className="player-role">{ps.role === 'landlord' ? '地主' : '农民'}</span>
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

                {settlementAchievementEntries.length > 0 && (
                  <div className="achievements-info">
                    <h3 className="section-title">🏆 解锁成就</h3>
                    <div className="achievements-list">
                      {settlementAchievementEntries.map(([playerId, achievements]: [string, string[]]) => {
                        const playerName =
                          settlementPlayerScores.find((ps: SettlementPlayerScore) => ps.playerId === playerId)?.playerName ||
                          playerId
                        return (
                          <div key={playerId} className="achievement-row">
                            <span className="achievement-player">{playerName}</span>
                            <div className="achievement-tags">
                              {achievements.map((ach: string, idx: number) => (
                                <span key={idx} className="achievement-tag">{ach}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="settlement-actions">
                  <Button color="success" onClick={handleViewProfile}>
                    查看战绩
                  </Button>
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
                      handleLeaveRoom()
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
