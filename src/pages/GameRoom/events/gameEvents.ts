import { Dispatch } from '@reduxjs/toolkit'
import {
  prepareNextGame,
  initGame,
  updatePlayers,
  setLandlord,
  setLastPlayedFromState,
  setCurrentPlayer,
  updatePlayerStatus,
  startGame,
  pass as passAction,
} from '@/store/slices/gameSlice'

export interface GameEventHandlers {
  handleRoomJoined: (data: any) => void
  handleJoinGameSuccess: (data: any) => void
  handleGameStateRestored: (data: any) => void
  handlePlayerJoined: (data: any) => void
  handlePlayerLeft: (data: any) => void
  handlePlayerReady: (data: any) => void
  handleGameStarted: (data: any) => void
  handleDealCardsAll: (data: any) => void
  handleBiddingStart: (data: any) => void
  handleBidResult: (data: any) => void
  handleLandlordDetermined: (data: any) => void
  handleGameStateUpdated: (data: any) => void
  handleTurnToPlay: (data: any) => void
  handlePlayCardsFailed: (data: { error?: string }) => void
  handleTurnChanged: (data: any) => void
  handleCardsPlayed: (data: any) => void
  handlePlayerPassed: (data: any) => void
  handleGameEnded: (data: any) => void
  handleChatMessage: (data: any) => void
}

export interface GameEventHandlerParams {
  dispatch: Dispatch
  user: any
  players: any[]
  gameStatus: string
  lastPlayedCards: any
  canPass: boolean
  appendSystemMessage: (msg: string) => void
  appendDebugMessage: (tag: string, msg: string) => void
  addChatMessage: (name: string, msg: string) => void
  quickFlowRef: React.MutableRefObject<any>
  closeSettlement: () => void
  setCurrentBombCount: (count: number) => void
  setHideBottomCards: (hide: boolean) => void
  soundManager: any
  dealAnimationTimeoutRef: React.MutableRefObject<number | null>
  startDealingAnimation: () => void
  stopDealingAnimation: () => void
  openBiddingUI: () => void
  closeBiddingUI: () => void
  stopBiddingTimer: () => void
  startBiddingTimer: (seconds: number) => void
  playPendingRef: React.MutableRefObject<boolean>
  setPlayPending: (pending: boolean) => void
  setTurnState: (isMyTurn: boolean, canPass: boolean) => void
  CardHintHelper: any
  autoFullHandPlayedRef: React.MutableRefObject<boolean>
  autoFollowHintAppliedRef: React.MutableRefObject<boolean>
  startTurnTimer: (seconds: number) => void
  stopTurnTimer: () => void
  markPlayerPassed: (playerId: string) => void
  doLeaveRoom: () => void
}

export function createGameEventHandlers(params: GameEventHandlerParams): GameEventHandlers {
  const {
    dispatch,
    user,
    players,
    gameStatus,
    lastPlayedCards,
    canPass,
    appendSystemMessage,
    appendDebugMessage,
    addChatMessage,
    quickFlowRef,
    closeSettlement,
    setCurrentBombCount,
    setHideBottomCards,
    soundManager,
    dealAnimationTimeoutRef,
    startDealingAnimation,
    stopDealingAnimation,
    openBiddingUI,
    closeBiddingUI,
    stopBiddingTimer,
    startBiddingTimer,
    playPendingRef,
    setPlayPending,
    setTurnState,
    CardHintHelper,
    autoFullHandPlayedRef,
    autoFollowHintAppliedRef,
    startTurnTimer,
    stopTurnTimer,
    markPlayerPassed,
    doLeaveRoom,
  } = params

  const handleRoomJoined = (data: any) => {
    console.log('[Room] room_joined payload:', data)
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
        score: p.score ?? p.totalScore ?? null,
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
          score: typeof p.score === 'number' ? p.score : typeof p.totalScore === 'number' ? p.totalScore : undefined,
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

    if (data.lastPlay && data.lastPlay.playerId && Array.isArray(data.lastPlay.cards)) {
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
      const isMyBidTurn = !!currentUserId && biddingState.currentBidderId === currentUserId

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
        (p: any) => p.id === data.currentPlayerId || p.name === data.currentPlayerId
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
      console.log('[Player] player_joined 后刷新玩家列表:', data.players)
      const players = data.players.map((p: any) => ({
        ...p,
        isReady: p.isReady !== undefined ? p.isReady : p.ready,
      }))
      dispatch(updatePlayers(players))
    }
  }

  const handlePlayerLeft = (data: any) => {
    addChatMessage('系统', `${data.playerName || '玩家'} 离开了房间`)

    if (data.players && Array.isArray(data.players)) {
      console.log('[Player] player_left 后刷新玩家列表:', data.players)
      const players = data.players.map((p: any) => ({
        ...p,
        isReady: p.isReady !== undefined ? p.isReady : p.ready
      }))
      dispatch(updatePlayers(players))
    } else if (data.playerId) {
      console.log('[Player] 根据 playerId 从本地玩家列表中移除:', data.playerId)
      const filtered = (players || []).filter((p: any) => p.id !== data.playerId && p.userId !== data.playerId)
      dispatch(updatePlayers(filtered))
    }
  }

  const handlePlayerReady = (data: any) => {
    if (data.playerName) {
      addChatMessage('系统', `${data.playerName} 已准备`)
    }
    
    if (data.players && Array.isArray(data.players)) {
      console.log('[Player] player_ready 后刷新玩家列表:')
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
      console.log('[Player] 标记单个玩家已准备:', data.playerId, 'isReady=true')
      dispatch(updatePlayerStatus({ playerId: data.playerId, isReady: true }))
    }
  }

  const handleGameStarted = (data: any) => {
    console.log('[Game] game_started payload:', data)
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
      console.log('[Game] 当前玩家起始手牌数量:', myCards.cards.length)
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
      console.log('[Bidding] 轮到我抢地主')
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
          console.log('[Bidding] 轮到我抢地主（nextBidder）')
          openBiddingUI()
          startBiddingTimer(15)
        } else {
          console.log('[Bidding] 轮到其他玩家抢地主...')
        }
      }, 1000)
    }
  }

  const handleLandlordDetermined = (data: any) => {
    console.log('[Bidding] 当前用户ID:', user?.id)
    console.log('[Bidding] 当前用户名:', user?.name)
    appendDebugMessage('BID', '收到 landlord_determined 事件')
    
    if (data.landlordId) {
      closeBiddingUI()
      stopBiddingTimer()
      
      const isLandlord = data.landlordId === user?.id || 
                        data.landlordId === user?.name ||
                        data.landlordName === user?.name
      
      console.log('[Bidding] 当前玩家是否为地主:', isLandlord)
      
      dispatch(setLandlord({
        landlordId: data.landlordId,
        landlordCards: data.bottomCards || [],
        landlordName: data.landlordName,
        landlordHand: data.landlordCards,
        landlordCardCount: data.landlordCardCount,
        isMe: isLandlord,
      }))
      
      console.log('[Bidding] 已派发 setLandlord Redux action，gameStatus 应切换为 playing')
      addChatMessage('系统', `${data.landlordName || '玩家'} 成为地主`)
      
      if (isLandlord) {
        console.log('[Bidding] 当前玩家是地主，底牌为:', data.bottomCards)
        addChatMessage('系统', `地主获得底牌，共 ${data.bottomCards?.length || 3} 张`)
      }

      console.log('[Bidding] 等待服务器发出 turn_to_play 事件...')
    }
  }

  const handleGameStateUpdated = (data: any) => {
    // 目前仅用于调试
    console.log('[Game] game_state_updated 事件:', data)
  }

  const handleTurnToPlay = (data: any) => {
    console.log('[Turn] 当前 gameStatus:', gameStatus)
    
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
        
        console.log('[Turn] 本轮是否可以不出(canPass):', canPassNow)
        console.log('[Turn] 是否首手出牌(isFirst):', isFirst)
        console.log('[Turn] 上家出牌记录(lastPlayedCards):', lastPlayedCards)
        console.log('[Turn] isMyTurn 已设置为 true')

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

    console.log('[PlayCards] 出牌失败原因:', message)
    appendSystemMessage(`出牌失败：${message}`)
  }

  const handleTurnChanged = (data: any) => {
    if (data.currentPlayerId) {
      dispatch(setCurrentPlayer(data.currentPlayerId))
    }
  }

  const handleCardsPlayed = (data: any) => {
    console.log('[Play] 牌型信息:', data.cardType)

    appendDebugMessage(
      'FLOW',
      `收到 cards_played：player=${data.playerName || data.playerId || '未知'}，牌数=${
        Array.isArray(data.cards) ? data.cards.length : 0
      }`,
    )

    if (!data.playerId || !data.cards) {
      return
    }

    soundManager.playCardTypeSound(data.cardType)
    const typeRaw = (data.cardType?.type || data.cardType?.TYPE || '')
      .toString()
      .toLowerCase()
    const hasDedicatedSound =
      typeRaw.includes('bomb') ||
      typeRaw.includes('rocket') ||
      typeRaw.includes('plane')

    if (!hasDedicatedSound) {
      soundManager.playCardByCount(data.cards.length)
    }

    playPendingRef.current = false
    setPlayPending(false)

    const isCurrentUser = data.playerId === (user?.id || user?.name)

    if (isCurrentUser) {
      setTurnState(false, false)
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

  const handleGameEnded = (data: any) => {
    appendDebugMessage(
      'FLOW',
      `收到 game_over：winner=${data.winnerName || '未知'}，role=${data.winnerRole}, landlordWin=${
        data.landlordWin
      }`,
    )
    
    stopTurnTimer()

    ;(async () => {
      if (data.scores && Array.isArray(data.scores)) {
        const myScoreObj = data.scores.find(
          (s: any) => s.playerId === user?.id || s.playerName === user?.name
        )
        const newScore = myScoreObj?.newScore
        if (typeof newScore === 'number' && newScore <= 0) {
          addChatMessage('系统', '本局结束后你的积分已用尽，将自动返回大厅进行充值')
          dispatch(prepareNextGame())
          doLeaveRoom()
        }
      }
    })()
  }

  const handleChatMessage = (data: any) => {
    if (data.playerName && data.message) {
      addChatMessage(data.playerName, data.message)
    }
  }

  return {
    handleRoomJoined,
    handleJoinGameSuccess,
    handleGameStateRestored,
    handlePlayerJoined,
    handlePlayerLeft,
    handlePlayerReady,
    handleGameStarted,
    handleDealCardsAll,
    handleBiddingStart,
    handleBidResult,
    handleLandlordDetermined,
    handleGameStateUpdated,
    handleTurnToPlay,
    handlePlayCardsFailed,
    handleTurnChanged,
    handleCardsPlayed,
    handlePlayerPassed,
    handleGameEnded,
    handleChatMessage,
  }
}
