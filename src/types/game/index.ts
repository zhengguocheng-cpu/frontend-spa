/**
 * 游戏相关类型定义
 */

// 玩家信息
export interface Player {
  id: string
  name: string
  avatar?: string
  ready?: boolean
  role?: 'landlord' | 'farmer' | null
  cards?: string[]
  cardCount?: number
  score?: number
  isBot?: boolean
}

// 卡牌牌型
export interface CardPattern {
  type: string
  cards: string[]
  value?: number
  length?: number
}

// 聊天消息
export interface ChatMessage {
  sender: string
  message: string
  timestamp?: number
}

// 游戏结算信息
export interface SettlementData {
  winnerId: string
  winnerName: string
  winnerRole: 'landlord' | 'farmer'
  landlordWin: boolean
  score: {
    baseScore: number
    bombCount: number
    rocketCount: number
    isSpring: boolean
    isAntiSpring: boolean
    playerScores: Array<{
      playerId: string
      playerName: string
      role: 'landlord' | 'farmer'
      isWinner: boolean
      baseScore: number
      multipliers: string[]
      finalScore: number
    }>
  }
  remainingHands?: {
    [playerId: string]: {
      playerId: string
      playerName: string
      cards: string[]
    }
  }
}

// Socket 事件数据类型
export interface SocketEventData {
  // 房间事件
  room_joined: {
    players: Player[]
    roomId: string
  }
  
  player_joined: {
    player: Player
  }
  
  player_left: {
    playerId: string
    playerName: string
  }
  
  player_ready: {
    playerId: string
    ready: boolean
  }
  
  // 游戏流程事件
  game_started: {
    players: Player[]
  }
  
  deal_cards: {
    cards: string[]
    playerCards?: { [playerId: string]: string[] }
  }
  
  deal_cards_all: {
    playerCards: { [playerId: string]: string[] }
  }
  
  bidding_started: {
    currentBidderId: string
    biddingOrder: string[]
  }
  
  bidding_turn: {
    playerId: string
    playerName: string
  }
  
  player_bid: {
    playerId: string
    playerName: string
    bid: boolean
  }
  
  landlord_determined: {
    landlordId: string
    landlordName: string
    bottomCards: string[]
  }
  
  // 出牌事件
  turn_to_play: {
    playerId: string
    playerName: string
    isFirstPlay?: boolean
    lastPattern?: CardPattern | null
  }
  
  cards_played: {
    playerId: string
    playerName: string
    cards: string[]
    cardType?: CardPattern
    remainingCards: number
  }
  
  player_passed: {
    playerId: string
    playerName: string
  }
  
  new_round_started: {
    startPlayerId: string
    startPlayerName: string
  }
  
  game_over: SettlementData
  
  // AI 提示事件
  ai_hint_result: {
    success: boolean
    suggestion?: string[]
    allSuggestions?: string[][]
    reasoning?: string
    error?: string
  }
  
  // 错误事件
  play_cards_failed: {
    error: string
  }
  
  error: {
    message: string
  }
}

// LLM 设置
export interface LLMSettings {
  enabled: boolean
  provider: 'openai' | 'deepseek' | 'ollama'
  model: string
  apiKey?: string
  baseUrl?: string
}

// 游戏设置
export interface GameSettings {
  autoReady: boolean
  autoReadyDelay: number
  soundEnabled: boolean
  musicEnabled: boolean
  autoFullHandPlay: boolean
  autoFollowHint: boolean
  autoTimeoutPlay: boolean
}
