/**
 * 卡牌操作业务逻辑
 * 包含出牌、提示、不出等核心逻辑
 */

import { CardHintHelper } from '@/utils/cardHintHelper'
import type { Socket } from 'socket.io-client'

/**
 * 执行出牌操作
 */
export function playCards(params: {
  roomId: string
  userId: string | number
  cards: string[]
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, userId, cards, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  if (cards.length === 0) {
    onError?.('请选择要出的牌')
    return
  }

  console.log('[PlayCards] 发送出牌请求', { roomId, userId, cards })

  // 注意：后端不使用回调模式，而是通过广播事件通知结果
  // 实际的成功/失败由 cards_played 或 play_cards_failed 事件处理
  // 这里不调用 onSuccess/onError，避免过早重置状态
  socket.emit('play_cards', { roomId, userId, cards })
}

/**
 * 执行不出操作
 */
export function passCards(params: {
  roomId: string
  socket: Socket | null
  onSuccess?: () => void
  onError?: (msg: string) => void
}) {
  const { roomId, socket, onSuccess, onError } = params

  if (!socket) {
    onError?.('Socket未连接')
    return
  }

  console.log('[Pass] 发送不出请求', { roomId })

  socket.emit('pass', { roomId }, (response: any) => {
    if (response?.success) {
      onSuccess?.()
    } else {
      onError?.(response?.error || '不出失败')
    }
  })
}

/**
 * 获取出牌提示
 */
export function getCardHint(params: {
  myCards: string[]
  lastCards: string[] | null
  isFollowPlay: boolean
}): string[] {
  const { myCards, lastCards, isFollowPlay } = params

  if (myCards.length === 0) {
    return []
  }

  // 根据是否跟牌决定参数
  const hintLastCards = isFollowPlay ? lastCards : null

  // 获取所有可行提示
  const allHints = CardHintHelper.getAllHints(myCards, hintLastCards)

  if (!allHints || allHints.length === 0) {
    return []
  }

  // 返回第一个提示
  return allHints[0]
}

/**
 * 检查是否可以自动整手出牌
 */
export function getFullHandIfSinglePattern(
  myCards: string[]
): string[] | null {
  if (myCards.length === 0) {
    return null
  }

  return CardHintHelper.getFullHandIfSinglePattern(myCards)
}

/**
 * 验证出牌是否合法
 */
export function validatePlayCards(params: {
  selectedCards: string[]
  myCards: string[]
  lastCards: string[] | null
  canPass: boolean
}): { valid: boolean; error?: string } {
  const { selectedCards, myCards, lastCards, canPass } = params

  // 如果没有选牌，尝试整手出牌
  if (selectedCards.length === 0) {
    const fullHand = getFullHandIfSinglePattern(myCards)
    if (fullHand && fullHand.length === myCards.length) {
      return { valid: true }
    }
    return { valid: false, error: '请选择要出的牌' }
  }

  // TODO: 可以添加更多验证逻辑（如是否能压过上家等）

  return { valid: true }
}
