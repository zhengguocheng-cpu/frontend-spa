/**
 * 工具函数集合
 */

/**
 * 解析扑克牌字符串
 */
export function parseCard(cardStr: string): {
  rank: string
  suit: string
  isJoker: 'big' | 'small' | null
} {
  if (!cardStr) {
    return { rank: '', suit: '', isJoker: null }
  }

  const card = cardStr.trim()

  // 大王
  if (card === 'RJ' || card === 'JOKER' || card === '大王') {
    return { rank: 'JOKER', suit: '', isJoker: 'big' }
  }

  // 小王
  if (card === 'BJ' || card === 'joker' || card === '小王') {
    return { rank: 'joker', suit: '', isJoker: 'small' }
  }

  // 普通牌：最后一个字符是花色
  const suit = card.slice(-1)
  const rank = card.slice(0, -1)

  return { rank, suit, isJoker: null }
}

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(): string {
  const now = new Date()
  return now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
