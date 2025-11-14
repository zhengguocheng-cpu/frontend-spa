import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Dialog, Toast } from 'antd-mobile'
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
  // addBid,
  // clearSelection,
  pass as passAction,
} from '@/store/slices/gameSlice'
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

  // 计算玩家位置（逆时针排列）
  const getPlayerPositions = () => {
    if (!players || players.length === 0 || !user) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    // 找到当前玩家的索引
    const myIndex = players.findIndex((p: any) => p.id === user.id || p.name === user.name)
    
    if (myIndex === -1) {
      return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
    }

    // 当前玩家（底部）
    const currentPlayer = players[myIndex]

    // 左侧玩家（逆时针下一位）
    const leftPlayer = players.length >= 2 ? players[(myIndex + 1) % players.length] : null

    // 右侧玩家（逆时针再下一位）
    const rightPlayer = players.length >= 3 ? players[(myIndex + 2) % players.length] : null

    return { leftPlayer, rightPlayer, currentPlayer }
  }

  const { leftPlayer, rightPlayer, currentPlayer } = getPlayerPositions()

  // 解析卡牌 - 照抄 frontend/public/room/js/room-simple.js 第 2065-2093 行
  const parseCard = (card: string) => {
    // 处理大小王
    if (card === '大王' || card === '🃏大王' || card.includes('大王')) {
      return { rank: 'JOKER', suit: '', isJoker: 'big' }
    }
    if (card === '小王' || card === '🃏小王' || card.includes('小王')) {
      return { rank: 'joker', suit: '', isJoker: 'small' }
    }
    
    // 处理JOKER格式
    if (card.includes('JOKER')) {
      return { rank: 'JOKER', suit: '', isJoker: 'big' }
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
    }
  }, [user, roomId, dispatch])

  // 监听游戏事件
  useEffect(() => {
    if (!connected) return

    const socket = globalSocket.getSocket()
    if (!socket) return

    // 房间加入成功
    const handleRoomJoined = (data: any) => {
      console.log('✅ 加入房间成功:', data)
      Toast.show({ content: '加入房间成功', icon: 'success' })
    }

    // 加入游戏成功
    const handleJoinGameSuccess = (data: any) => {
      console.log('🎉 [加入游戏成功] 收到数据:', data)
      
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
      
      // 恢复当前回合
      if (data.currentPlayerId) {
        dispatch(setCurrentPlayer(data.currentPlayerId))
        console.log('✅ 恢复当前回合')
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
        
        // 更新所有玩家的牌数
        if (data.players) {
          const players = data.players.map((p: any) => ({
            ...p,
            id: p.playerId || p.id,
            cardCount: p.cards?.length || 0,
            isReady: true
          }))
          dispatch(updatePlayers(players))
          console.log('✅ 更新所有玩家牌数:', players)
        }
        
        Toast.show({ content: '🎴 发牌完成，开始叫地主', icon: 'success' })
      } else {
        console.error('❌ 未找到我的牌数据，currentPlayerId:', user?.id || user?.name)
        console.error('❌ 所有玩家数据:', data.players)
      }
    }

    // 发牌事件（单播版本，兼容旧版）
    const handleCardsDealt = (data: any) => {
      console.log('🎯 [发牌事件-单播] 收到数据:', data)
      
      if (data.playerId === user?.id || data.playerId === user?.name) {
        if (data.cards && data.cards.length > 0) {
          console.log('🎴 开始发牌，牌数:', data.cards.length)
          dispatch(startGame({ myCards: data.cards }))
          Toast.show({ content: `🎴 您获得了 ${data.cards.length} 张牌`, icon: 'success' })
        }
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
      if (data.firstBidderName === user?.name) {
        console.log('✅ 轮到我叫地主')
        setShowBiddingUI(true)
        
        // 启动倒计时（15秒）
        let timeLeft = 15
        setBiddingTimer(timeLeft)
        
        const timer = setInterval(() => {
          timeLeft--
          setBiddingTimer(timeLeft)
          
          if (timeLeft <= 0) {
            clearInterval(timer)
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
          if (data.nextBidderId === (user?.id || user?.name)) {
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

    // 轮到出牌 - 照抄 frontend 逻辑
    const handleTurnToPlay = (data: any) => {
      console.log('🎯 [轮到出牌] 收到事件:', data)
      console.log('🎯 [轮到出牌] 当前玩家ID:', user?.id)
      console.log('🎯 [轮到出牌] 事件中的玩家ID:', data.playerId)
      console.log('🎯 [轮到出牌] 当前 gameStatus:', gameStatus)
      
      if (data.playerId) {
        dispatch(setCurrentPlayer(data.playerId))
        
        if (data.playerId === (user?.id || user?.name)) {
          // 轮到我出牌
          setIsMyTurn(true)
          
          // 判断是否可以不出
          // 如果是首次出牌或新一轮开始，不能不出
          const isFirst = data.isFirst || data.isFirstPlay  // 兼容两种字段名
          const canPassNow = !isFirst && lastPlayedCards !== null
          setCanPass(canPassNow)
          
          console.log('🎯 [轮到出牌] 是否可以不出:', canPassNow)
          console.log('🎯 [轮到出牌] 首次出牌:', isFirst)
          console.log('🎯 [轮到出牌] 上家出牌:', lastPlayedCards)
          console.log('🎯 [轮到出牌] isMyTurn 已设置为 true')
          
          Toast.show({ content: '🎯 轮到你出牌了！', icon: 'success' })
          
          // 开始倒计时（30秒）
          setTurnTimer(30)
          if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current)
          }
          turnTimerRef.current = setInterval(() => {
            setTurnTimer(prev => {
              if (prev <= 1) {
                clearInterval(turnTimerRef.current!)
                turnTimerRef.current = null
                // 自动不出
                handlePass()
                return 0
              }
              return prev - 1
            })
          }, 1000)
        } else {
          // 不是我的回合
          setIsMyTurn(false)
          if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current)
            turnTimerRef.current = null
          }
          Toast.show({ content: `等待 ${data.playerName || '玩家'} 出牌...`, icon: 'loading' })
        }
      }
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
        // 更新 Redux 状态
        dispatch(playCardsAction({
          playerId: data.playerId,
          playerName: data.playerName || data.playerId,
          cards: data.cards,
          type: data.cardType,
        }))
        
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

    // 注册事件监听
    socket.on('room_joined', handleRoomJoined)
    socket.on('join_game_success', handleJoinGameSuccess)
    socket.on('game_state_restored', handleGameStateRestored)
    socket.on('player_joined', handlePlayerJoined)
    socket.on('player_left', handlePlayerLeft)
    socket.on('player_ready', handlePlayerReady)
    socket.on('game_started', handleGameStarted)
    socket.on('deal_cards_all', handleDealCardsAll)
    socket.on('cards_dealt', handleCardsDealt)
    socket.on('bidding_start', handleBiddingStart)
    socket.on('bid_result', handleBidResult)
    socket.on('landlord_determined', handleLandlordDetermined)
    socket.on('game_state_updated', handleGameStateUpdated)
    socket.on('turn_to_play', handleTurnToPlay)
    socket.on('turn_changed', handleTurnChanged)
    socket.on('cards_played', handleCardsPlayed)
    socket.on('player_passed', handlePlayerPassed)
    socket.on('game_over', handleGameEnded)  // 后端发送的是 game_over
    socket.on('game_ended', handleGameEnded)  // 兼容旧事件名

    return () => {
      socket.off('room_joined', handleRoomJoined)
      socket.off('join_game_success', handleJoinGameSuccess)
      socket.off('game_state_restored', handleGameStateRestored)
      socket.off('player_joined', handlePlayerJoined)
      socket.off('player_left', handlePlayerLeft)
      socket.off('player_ready', handlePlayerReady)
      socket.off('game_started', handleGameStarted)
      socket.off('deal_cards_all', handleDealCardsAll)
      socket.off('cards_dealt', handleCardsDealt)
      socket.off('bidding_start', handleBiddingStart)
      socket.off('bid_result', handleBidResult)
      socket.off('landlord_determined', handleLandlordDetermined)
      socket.off('game_state_updated', handleGameStateUpdated)
      socket.off('turn_to_play', handleTurnToPlay)
      socket.off('turn_changed', handleTurnChanged)
      socket.off('cards_played', handleCardsPlayed)
      socket.off('player_passed', handlePlayerPassed)
      socket.off('game_ended', handleGameEnded)
    }
  }, [connected, dispatch])

  // 离开房间
  const handleLeaveRoom = () => {
    Dialog.confirm({
      content: '确定要离开房间吗？',
      onConfirm: () => {
        if (roomId) {
          globalSocket.leaveGame(roomId)
        }
        // 清除房间信息
        sessionStorage.removeItem('lastRoomId')
        sessionStorage.removeItem('lastRoomTime')
        dispatch(resetGame())
        navigate('/rooms')
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

  // 出牌 - 照抄 frontend 逻辑
  const handlePlayCards = () => {
    const socket = globalSocket.getSocket()
    if (!socket || !roomId || !user) {
      Toast.show({ content: 'Socket 未连接', icon: 'fail' })
      return
    }

    if (selectedCards.length === 0) {
      Toast.show({ content: '请选择要出的牌', icon: 'fail' })
      return
    }

    if (!isMyTurn) {
      Toast.show({ content: '还没轮到你出牌', icon: 'fail' })
      return
    }

    console.log('🎴 发送出牌请求:', selectedCards)

    // 发送出牌请求
    socket.emit('play_cards', {
      roomId,
      userId: user.id || user.name,
      cards: selectedCards,
    })

    // 停止倒计时
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }

    // 隐藏出牌按钮
    setIsMyTurn(false)
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

    console.log('⏭️ 发送不出请求')

    // 发送不出请求
    socket.emit('pass', {
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

    console.log('🎲 选择叫地主:', bid)

    // 隐藏叫地主 UI
    setShowBiddingUI(false)
    if (biddingTimerRef.current) {
      clearInterval(biddingTimerRef.current)
      biddingTimerRef.current = null
    }

    // 发送选择到服务器
    socket.emit('bid', {
      roomId,
      userId: user.id || user.name,
      bid: bid, // true = 抢，false = 不抢
    })

    // 显示消息
    const bidText = bid ? '抢地主' : '不抢'
    Toast.show({ content: `您选择：${bidText}`, icon: 'success' })
  }

  // 提示
  const handleHint = () => {
    Toast.show({ content: '提示功能开发中', icon: 'fail' })
  }

  // 选中/取消选中手牌
  const handleCardClick = (cardStr: string) => {
    console.log('🎴 点击手牌:', cardStr)
    
    // 检查是否已选中
    const isSelected = selectedCards.includes(cardStr)
    
    if (isSelected) {
      // 取消选中
      dispatch(toggleCardSelection(cardStr))
      console.log('❌ 取消选中:', cardStr)
    } else {
      // 选中
      dispatch(toggleCardSelection(cardStr))
      console.log('✅ 选中:', cardStr)
    }
  }

  // 发送聊天消息
  const handleSendChat = () => {
    if (!chatMessage.trim()) return
    
    // TODO: 发送到服务器
    setChatMessages([...chatMessages, { sender: user?.name || '我', message: chatMessage }])
    setChatMessage('')
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

  // 动态计算手牌遮挡宽度
  useEffect(() => {
    const calculateCardOverlap = () => {
      const handSection = document.querySelector('.player-hand-section')
      const cards = document.querySelectorAll('.player-hand .card')
      
      if (!handSection || cards.length === 0) return
      
      const containerWidth = handSection.clientWidth  // 容器宽度 x
      const n = cards.length                          // 牌数 n
      const cardWidth = cards[0].clientWidth          // 单张牌宽度 w
      
      if (n <= 1) {
        // 只有一张牌，不需要遮挡
        return
      }
      
      // 计算理想的遮挡宽度
      // 总宽度 = 第一张牌宽度 + (n-1) × 每张牌露出宽度
      // containerWidth = cardWidth + (n-1) × visibleWidth
      // visibleWidth = (containerWidth - cardWidth) / (n-1)
      // overlap = visibleWidth - cardWidth
      
      const visibleWidth = (containerWidth - cardWidth) / (n - 1)
      let overlap = (visibleWidth - cardWidth) * 1.4
      
      // 限制遮挡范围：最多遮挡 80%，最少遮挡 20%
      const minOverlap = -cardWidth * 0.8  // 最多遮挡 80%
      const maxOverlap = -cardWidth * 0.2  // 最少遮挡 20%
      
      // 如果计算出的遮挡超出限制，需要重新计算
      if (overlap < minOverlap) {
        // 遮挡太多，使用最大遮挡
        overlap = minOverlap
      } else if (overlap > maxOverlap) {
        // 遮挡太少，使用最小遮挡
        overlap = maxOverlap
      }
      
      // 计算实际总宽度
      const actualTotalWidth = cardWidth + (n - 1) * (cardWidth + overlap)
      
      // 如果实际总宽度超过容器，强制调整遮挡
      if (actualTotalWidth > containerWidth) {
        overlap = (containerWidth - cardWidth) / (n - 1) - cardWidth
        console.warn('⚠️ 总宽度超出容器，强制调整遮挡:', overlap)
      }
      
      // 应用到所有牌（第一张不偏移，后续牌正常遮挡）
      cards.forEach((card, index) => {
        if (index === 0) {
          // 第一张牌：不偏移
          (card as HTMLElement).style.marginLeft = '0'
        } else {
          // 后续牌：正常遮挡
          (card as HTMLElement).style.marginLeft = `${overlap}px`
        }
      })
      
      console.log('🎴 手牌遮挡计算:', {
        容器宽度: containerWidth,
        牌数: n,
        牌宽: cardWidth,
        每张露出宽度: visibleWidth,
        遮挡宽度: overlap,
        实际总宽度: actualTotalWidth,
        是否超出: actualTotalWidth > containerWidth ? '❌ 是' : '✅ 否'
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
                const isRed = suit === '♥' || suit === '♦'
                
                return (
                  <div key={index} className={`bottom-card ${isRed ? 'red' : 'black'}`}>
                    <div className={`card-value ${isJoker ? 'joker-text' : ''}`}>
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
          <div className="player-slot left">
            {leftPlayer && (
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
                      : `${leftPlayer.cardCount || 0} 张`
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="player-slot right">
            {rightPlayer && (
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
                      : `${rightPlayer.cardCount || 0} 张`
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 中央出牌区 - 照抄 frontend */}
        <div className="center-area">
          {lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0 && (
            <div className="played-cards-area">
              <div className="played-cards-label">
                {lastPlayedCards.playerName || '玩家'} 出牌
              </div>
              <div className="played-cards-container">
                {lastPlayedCards.cards.map((cardStr: string, index: number) => {
                  const { rank, suit, isJoker } = parseCard(cardStr)
                  const isRed = suit === '♥' || suit === '♦'
                  
                  return (
                    <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
                      <div className={`card-value ${isJoker ? 'joker-text' : ''}`}>
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
        </div>

        {/* 当前玩家信息 */}
        <div className={`current-player-info ${landlordId === (user?.id || user?.name) ? 'landlord' : ''}`}>
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
        <div className="player-hand-section">
          <div className="player-hand">
            {myCards.map((cardStr: string, index: number) => {
              // 解析卡牌字符串
              const { rank, suit, isJoker } = parseCard(cardStr)
              const isRed = suit === '♥' || suit === '♦'
              const isSelected = selectedCards.some((c: any) => c === cardStr)
              
              return (
                <div
                  key={`${cardStr}-${index}`}
                  className={`card ${isRed ? 'red' : 'black'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleCardClick(cardStr)}
                >
                  <div className={`card-value ${isJoker ? 'joker-text' : ''}`}>
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

        {/* 控制按钮 */}
        <div className="game-controls">
        {gameStatus === 'waiting' && (
          <div className="waiting-controls">
            <Button color="primary" size="large" onClick={handleStartGame}>
              准备
            </Button>
            <Button size="large" onClick={handleLeaveRoom}>
              返回大厅
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
              >
                出牌
              </Button>
              {canPass && (
                <Button 
                  size="large" 
                  onClick={handlePass}
                  style={{
                    background: '#6c757d',
                    border: 'none',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    padding: '12px 30px'
                  }}
                >
                  不出
                </Button>
              )}
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

      {/* 结算弹窗 - 照抄 frontend 结构 */}
      {showSettlement && gameState.gameResult && (
        <Dialog
          visible={showSettlement}
          content={
            <div className="settlement-content">
              <h2 className="settlement-title">
                {gameState.gameResult.landlordWin ? '🎊 地主获胜！' : '🎊 农民获胜！'}
              </h2>
              
              <div className="winner-info">
                <div className="winner-avatar">👑</div>
                <div className="winner-name">{gameState.gameResult.winnerName || '未知玩家'}</div>
                <div className="winner-role">
                  {gameState.gameResult.winnerRole === 'landlord' ? '地主' : '农民'}
                </div>
              </div>

              {gameState.gameResult.score && (
                <div className="score-info">
                  <div className="score-item">
                    <span>底分：</span>
                    <span>{gameState.gameResult.score.baseScore || 1}</span>
                  </div>
                  <div className="score-item">
                    <span>倍数：</span>
                    <span>{gameState.gameResult.score.multiplier || 1}x</span>
                  </div>
                  <div className="score-item total">
                    <span>总分：</span>
                    <span>{gameState.gameResult.score.totalScore || 1}</span>
                  </div>
                </div>
              )}

              <div className="settlement-actions">
                <Button
                  color="primary"
                  onClick={() => {
                    setShowSettlement(false)
                    handleStartGame()  // 再来一局
                  }}
                  style={{ marginRight: '10px' }}
                >
                  再来一局
                </Button>
                <Button
                  onClick={() => {
                    setShowSettlement(false)
                    handleLeaveRoom()
                  }}
                >
                  返回大厅
                </Button>
              </div>
            </div>
          }
          closeOnMaskClick={false}
        />
      )}
    </div>
  )
}
