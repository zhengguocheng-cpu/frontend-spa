import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Player } from './roomSlice'

// 卡牌类型：使用字符串格式（与 frontend 一致）
// 例如：'♠A', '♥K', '🃏大王'
export type Card = string

export type SettlementRole = 'landlord' | 'farmer'

export interface SettlementMultipliers {
  base: number
  bomb: number
  rocket: number
  spring: number
  antiSpring: number
  total: number
}

export interface SettlementPlayerScore {
  playerId: string
  playerName: string
  role: SettlementRole
  isWinner: boolean
  baseScore: number
  multipliers: SettlementMultipliers
  finalScore: number
}

export interface SettlementScore {
  baseScore: number
  bombCount: number
  rocketCount: number
  isSpring: boolean
  isAntiSpring: boolean
  landlordWin: boolean
  playerScores: SettlementPlayerScore[]
}

export interface SettlementAchievements {
  [playerId: string]: string[]
}

export interface GameResultPayload {
  winnerId: string
  winnerName: string
  winnerRole: SettlementRole
  landlordWin: boolean
  score?: SettlementScore
  achievements?: SettlementAchievements
  // 各玩家剩余手牌（由后端在 game_over 中提供）
  remainingHands?: {
    [playerId: string]: {
      playerId: string
      playerName: string
      cards: Card[]
    }
  }
}

const CARD_RANK_VALUE: Record<string, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  '10': 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
  '2': 13,
  小王: 14,
  大王: 15,
  joker: 14,
  JOKER: 15,
  '🃏小王': 14,
  '🃏大王': 15,
}

const extractCardRank = (card: Card): string => {
  if (!card) return ''

  // 处理大小王
  if (card.includes('🃏大王') || card === '大王') return '大王'
  if (card.includes('🃏小王') || card === '小王') return '小王'
  if (card === 'JOKER' || card.includes('JOKER')) return 'JOKER'
  if (card === 'joker' || card.includes('joker')) return 'joker'

  // 普通牌，移除花色符号
  const suits = ['♠', '♥', '♦', '♣']
  for (const suit of suits) {
    if (card.startsWith(suit)) {
      return card.substring(1) // 移除第一个字符（花色）
    }
  }
  
  return card
}

const getCardRankValue = (card: Card): number => {
  const rank = extractCardRank(card)
  return CARD_RANK_VALUE[rank] ?? 0
}

const sortCardsAscending = (cards: Card[]): Card[] => {
  const sorted = [...cards].sort((a, b) => {
    const valueA = getCardRankValue(a)
    const valueB = getCardRankValue(b)
    const diff = valueA - valueB
    
    // 调试日志
    if (diff === 0) {
      console.log(`🔍 排序比较: ${a}(${valueA}) vs ${b}(${valueB}) = ${diff}`)
    }
    
    if (diff !== 0) return diff
    
    // 花色次序：♦ < ♣ < ♥ < ♠
    const suitOrder: Record<string, number> = { '♦': 1, '♣': 2, '♥': 3, '♠': 4 }
    const suitA = a.charAt(0)
    const suitB = b.charAt(0)
    const suitDiff = (suitOrder[suitA] || 0) - (suitOrder[suitB] || 0)
    if (suitDiff !== 0) return suitDiff
    return a.localeCompare(b)
  })
  
  console.log('🔍 排序前:', cards)
  console.log('🔍 排序后:', sorted)
  console.log('🔍 每张牌的值:', sorted.map(c => `${c}=${getCardRankValue(c)}`))
  
  return sorted
}

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
  gameResult: GameResultPayload | null
  
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
    
    // 设置游戏状态
    setGameStatus: (state, action: PayloadAction<'waiting' | 'bidding' | 'playing' | 'finished'>) => {
      state.gameStatus = action.payload
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
    setLandlord: (state, action: PayloadAction<{
      landlordId: string
      landlordCards: Card[]
      landlordName?: string
      landlordHand?: Card[]
      landlordCardCount?: number
      isMe?: boolean
    }>) => {
      state.landlordId = action.payload.landlordId
      const bottomCards = action.payload.landlordCards || []
      state.landlordCards = sortCardsAscending(bottomCards)
      state.gameStatus = 'playing'
      
      console.log('🎮 [Redux] setLandlord - gameStatus 设置为 playing')
      console.log('🎮 [Redux] landlordId:', action.payload.landlordId)
      console.log('🎮 [Redux] landlordCards:', action.payload.landlordCards)
      
      const storedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId')
      const storedUserName = sessionStorage.getItem('userName') || localStorage.getItem('userName')
      const isMeLandlord = action.payload.isMe ?? Boolean(
        (action.payload.landlordId && (action.payload.landlordId === storedUserId || action.payload.landlordId === storedUserName)) ||
        (action.payload.landlordName && action.payload.landlordName === storedUserName)
      )

      if (isMeLandlord && state.myCards.length > 0) {
        let updatedCards: Card[] = []
        
        console.log('🎮 [Redux] 我是地主，开始合并手牌')
        console.log('🎮 [Redux] 当前手牌:', state.myCards)
        console.log('🎮 [Redux] 底牌:', bottomCards)
        console.log('🎮 [Redux] 后端发送的完整手牌:', action.payload.landlordHand)
        
        // 优先使用后端发送的完整手牌（已包含底牌）
        if (action.payload.landlordHand && action.payload.landlordHand.length > 0) {
          console.log('🎮 [Redux] 使用后端发送的完整手牌')
          updatedCards = sortCardsAscending(action.payload.landlordHand)
        } else {
          // 否则手动合并当前手牌和底牌
          console.log('🎮 [Redux] 手动合并手牌和底牌')
          const missingCards = bottomCards.filter(card => !state.myCards.includes(card))
          console.log('🎮 [Redux] 需要添加的底牌:', missingCards)
          updatedCards = sortCardsAscending([...state.myCards, ...missingCards])
        }
        
        state.myCards = updatedCards
        console.log('🎮 [Redux] 地主手牌已更新排序')
        console.log('🎮 [Redux] 排序后手牌:', state.myCards)
        console.log('🎮 [Redux] 手牌数量:', state.myCards.length)
      }
      
      // 更新玩家角色
      state.players = state.players.map((p) => {
        const isLandlordPlayer =
          p.id === action.payload.landlordId ||
          p.name === action.payload.landlordId ||
          (action.payload.landlordName && p.name === action.payload.landlordName)

        if (isLandlordPlayer) {
          const targetCount = action.payload.landlordCardCount ?? (p.cardCount || 0) + bottomCards.length
          return {
            ...p,
            role: 'landlord',
            cardCount: targetCount,
          }
        }

        return {
          ...p,
          role: 'farmer',
        }
      })
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
      const myId = sessionStorage.getItem('userId') || localStorage.getItem('userId') ||
        sessionStorage.getItem('userName') || localStorage.getItem('userName')
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
      
      // 第一次出牌时隐藏底牌
      if (state.landlordCards.length > 0) {
        console.log('🎴 [出牌] 第一次出牌，隐藏底牌')
        state.landlordCards = []
      }
      
      state.canPass = true
    },

    // 从服务器恢复最近一手出牌（断线重连用，不修改手牌和牌数）
    setLastPlayedFromState: (state, action: PayloadAction<PlayedCards | null>) => {
      state.lastPlayedCards = action.payload
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

    // 准备下一局：清空上一局状态，保留基础设置
    prepareNextGame: (state) => {
      state.gameStatus = 'waiting'
      state.currentPlayerId = null
      state.landlordId = null
      state.myCards = []
      state.selectedCards = []
      state.landlordCards = []
      state.lastPlayedCards = null
      state.playHistory = []
      state.biddingHistory = []
      state.currentBid = 0
      state.winner = null
      state.gameResult = null
      state.showHint = false
      state.hintCards = []
      state.isMyTurn = false
      state.canPass = false

      state.players = state.players.map((p) => ({
        ...p,
        cardCount: 0,
        cards: [],
        role: undefined,
      }))
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
    endGame: (state, action: PayloadAction<GameResultPayload | null>) => {
      state.gameStatus = 'finished'
      state.gameResult = action.payload
      state.winner = action.payload?.winnerName || null
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
  setGameStatus,
  startGame,
  addBid,
  setLandlord,
  setCurrentPlayer,
  toggleCardSelection,
  clearSelection,
  playCards,
  pass,
  prepareNextGame,
  setHint,
  hideHint,
  endGame,
  resetGame,
  setSoundEnabled,
  setAnimationEnabled,
  restoreGameState,
  setLastPlayedFromState,
} = gameSlice.actions

export default gameSlice.reducer
