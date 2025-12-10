/**
 * GameRoom Helper Functions
 */

export interface ParsedCard {
  rank: string
  suit: string
  isJoker?: 'big' | 'small' | null
}

export function parseCard(card: string): ParsedCard {
  if (card === '大王' || card === '🃏大王' || card.includes('大王') || card.includes('JOKER')) {
    return { rank: 'JOKER', suit: '', isJoker: 'big' }
  }
  if (card === '小王' || card === '🃏小王' || card.includes('小王') || card.includes('joker')) {
    return { rank: 'JOKER', suit: '', isJoker: 'small' }
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
  return { rank, suit, isJoker: null }
}

export function getSpokenRankFromCard(cardStr: string): string | null {
  const { rank, isJoker } = parseCard(cardStr)
  if (isJoker === 'big') return '大王'
  if (isJoker === 'small') return '小王'
  
  const rankMap: Record<string, string> = {
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
    '10': '十',
    'J': '杰',
    'Q': '奎',
    'K': '克',
    'A': 'A',
    '2': '二',
  }
  
  return rankMap[rank] || null
}

