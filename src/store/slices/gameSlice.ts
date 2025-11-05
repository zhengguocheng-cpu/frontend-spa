import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Player } from './roomSlice'

// 卡牌类型：使用字符串格式（与 frontend 一致）
// 例如：'♠A', '♥K', '🃏大王'
export type Card = string

export interface CardObject {
  suit: string // 花色：'♠', '♥', '♣', '♦', 'joker'
  rank: string // 点数：'3'-'10', 'J', 'Q', 'K', 'A', '2', 'small', 'big'
  value: number // 数值：用于比较大小
  id: string // 唯一标识
}

export interface GamePlayer extends Player {
  cards: Card[] // 手牌
  cardCount: number // 手牌数量
  role?: 'landlord' | 'farmer' // 角色
  position?: 'bottom' | 'left' | 'right' // 位置
}

export interface PlayedCards {
  playerId: string
  playerName: string
  cards: Card[]
  type?: string // 牌型：'single', 'pair', 'triple', 'bomb' 等
}

interface GameState {
  // 游戏基本信息
  roomId: string | null
  gameStatus: 'waiting' | 'bidding' | 'playing' | 'finished'
  
  // 玩家信息
  players: GamePlayer[]
  currentPlayerId: string | null // 当前出牌玩家
  landlordId: string | null // 地主
  
  // 牌相关
  myCards: Card[] // 我的手牌
  selectedCards: Card[] // 选中的牌
  landlordCards: Card[] // 地主牌（底牌）
  lastPlayedCards: PlayedCards | null // 上一次出的牌
  playHistory: PlayedCards[] // 出牌历史
  
  // 叫地主相关
  biddingHistory: Array<{ playerId: string; bid: number }> // 叫地主历史
  currentBid: number // 当前叫分
  
  // 游戏结果
  winner: string | null // 获胜者
  gameResult: {
    winner: string
    landlordWin: boolean
    scores: Record<string, number>
  } | null
  
  // UI 状态
  showHint: boolean // 是否显示提示
  hintCards: Card[][] // 提示的牌组
  isMyTurn: boolean // 是否轮到我
  canPass: boolean // 是否可以不要
  
  // 音效和动画
  soundEnabled: boolean
  animationEnabled: boolean
}

const initialState: GameState = {
  roomId: null,
  gameStatus: 'waiting',
  players: [],
  currentPlayerId: null,
  landlordId: null,
  myCards: [],
  selectedCards: [],
  landlordCards: [],
  lastPlayedCards: null,
  playHistory: [],
  biddingHistory: [],
  currentBid: 0,
  winner: null,
  gameResult: null,
  showHint: false,
  hintCards: [],
  isMyTurn: false,
  canPass: false,
  soundEnabled: true,
  animationEnabled: true,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // 初始化游戏
    initGame: (state, action: PayloadAction<{ roomId: string; players: GamePlayer[] }>) => {
      state.roomId = action.payload.roomId
      state.players = action.payload.players
      state.gameStatus = 'waiting'
    },
    
    // 更新玩家列表
    updatePlayers: (state, action: PayloadAction<GamePlayer[]>) => {
      state.players = action.payload
    },
    
    // 更新单个玩家状态
    updatePlayerStatus: (state, action: PayloadAction<{ playerId: string; isReady: boolean }>) => {
      const player = state.players.find(p => 
        p.id === action.payload.playerId || p.name === action.payload.playerId
      )
      if (player) {
        player.isReady = action.payload.isReady
        console.log('✅ 更新玩家状态:', player.name, '准备状态:', action.payload.isReady)
      } else {
        console.warn('⚠️ 未找到玩家:', action.payload.playerId)
      }
    },
    
    // 开始游戏
    startGame: (state, action: PayloadAction<{ myCards: Card[] }>) => {
      state.gameStatus = 'bidding'
      state.myCards = action.payload.myCards
      state.selectedCards = []
    },
    
    // 叫地主
    addBid: (state, action: PayloadAction<{ playerId: string; bid: number }>) => {
      state.biddingHistory.push(action.payload)
      if (action.payload.bid > state.currentBid) {
        state.currentBid = action.payload.bid
      }
    },
    
    // 确定地主
    setLandlord: (state, action: PayloadAction<{ landlordId: string; landlordCards: Card[]; isMe?: boolean }>) => {
      state.landlordId = action.payload.landlordId
      state.landlordCards = action.payload.landlordCards
      state.gameStatus = 'playing'
      
      console.log('🎮 [Redux] setLandlord - gameStatus 设置为 playing')
      console.log('🎮 [Redux] landlordId:', action.payload.landlordId)
      console.log('🎮 [Redux] landlordCards:', action.payload.landlordCards)
      
      // 如果我是地主，把底牌加到手牌
      // 通过比较 landlordId 和玩家列表中的 ID 来判断
      const landlordPlayer = state.players.find(p => 
        p.id === action.payload.landlordId || p.name === action.payload.landlordId
      )
      
      if (landlordPlayer && state.myCards.length > 0) {
        // 如果找到地主玩家，并且当前有手牌，说明游戏已经开始
        // 检查是否需要添加底牌（避免重复添加）
        const hasLandlordCards = action.payload.landlordCards.every(card => 
          state.myCards.includes(card)
        )
        
        if (!hasLandlordCards) {
          state.myCards = [...state.myCards, ...action.payload.landlordCards]
          console.log('🎮 [Redux] 地主底牌已添加到手牌，当前手牌数:', state.myCards.length)
        } else {
          console.log('🎮 [Redux] 底牌已存在，跳过添加')
        }
      }
      
      // 更新玩家角色
      state.players = state.players.map((p) => ({
        ...p,
        role: p.id === action.payload.landlordId || p.name === action.payload.landlordId ? 'landlord' : 'farmer',
      }))
    },
    
    // 设置当前出牌玩家
    setCurrentPlayer: (state, action: PayloadAction<string>) => {
      state.currentPlayerId = action.payload
      const myId = localStorage.getItem('userId')
      state.isMyTurn = action.payload === myId
    },
    
    // 选择/取消选择牌
    toggleCardSelection: (state, action: PayloadAction<Card>) => {
      // 卡牌现在是字符串，直接比较
      const index = state.selectedCards.findIndex((c) => c === action.payload)
      if (index !== -1) {
        state.selectedCards.splice(index, 1)
      } else {
        state.selectedCards.push(action.payload)
      }
    },
    
    // 清空选中的牌
    clearSelection: (state) => {
      state.selectedCards = []
    },
    
    // 出牌
    playCards: (state, action: PayloadAction<PlayedCards>) => {
      state.lastPlayedCards = action.payload
      state.playHistory.push(action.payload)
      
      // 如果是我出的牌，从手牌中移除
      const myId = localStorage.getItem('userId')
      if (action.payload.playerId === myId) {
        // 卡牌现在是字符串，直接比较
        state.myCards = state.myCards.filter((c) => !action.payload.cards.includes(c))
        state.selectedCards = []
      }
      
      // 更新玩家手牌数量
      const player = state.players.find((p) => p.id === action.payload.playerId)
      if (player) {
        player.cardCount = player.cardCount - action.payload.cards.length
      }
      
      state.canPass = true
    },
    
    // 不要（过）
    pass: (state, action: PayloadAction<string>) => {
      // 记录过牌
      state.playHistory.push({
        playerId: action.payload,
        playerName: state.players.find((p) => p.id === action.payload)?.name || '',
        cards: [],
      })
    },
    
    // 显示提示
    setHint: (state, action: PayloadAction<Card[][]>) => {
      state.hintCards = action.payload
      state.showHint = true
    },
    
    // 隐藏提示
    hideHint: (state) => {
      state.showHint = false
      state.hintCards = []
    },
    
    // 游戏结束
    endGame: (state, action: PayloadAction<GameState['gameResult']>) => {
      state.gameStatus = 'finished'
      state.gameResult = action.payload
      state.winner = action.payload?.winner || null
    },
    
    // 重置游戏
    resetGame: (state) => {
      return { ...initialState, soundEnabled: state.soundEnabled, animationEnabled: state.animationEnabled }
    },
    
    // 设置音效
    setSoundEnabled: (state, action: PayloadAction<boolean>) => {
      state.soundEnabled = action.payload
    },
    
    // 设置动画
    setAnimationEnabled: (state, action: PayloadAction<boolean>) => {
      state.animationEnabled = action.payload
    },
    
    // 恢复游戏状态（断线重连）
    restoreGameState: (state, action: PayloadAction<Partial<GameState>>) => {
      return { ...state, ...action.payload }
    },
  },
})

export const {
  initGame,
  updatePlayers,
  updatePlayerStatus,
  startGame,
  addBid,
  setLandlord,
  setCurrentPlayer,
  toggleCardSelection,
  clearSelection,
  playCards,
  pass,
  setHint,
  hideHint,
  endGame,
  resetGame,
  setSoundEnabled,
  setAnimationEnabled,
  restoreGameState,
} = gameSlice.actions

export default gameSlice.reducer
