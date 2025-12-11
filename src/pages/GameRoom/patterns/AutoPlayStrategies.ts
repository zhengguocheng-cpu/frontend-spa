/**
 * 策略模式 - 自动出牌策略
 * 不同情况下使用不同的自动出牌策略
 */

import { CardHintHelper } from '@/utils/cardHintHelper'

// 策略接口
export interface AutoPlayStrategy {
  getName(): string
  shouldAutoPlay(context: AutoPlayContext): boolean
  getCards(context: AutoPlayContext): string[] | null
}

// 自动出牌上下文
export interface AutoPlayContext {
  myCards: string[]
  lastPlayedCards: string[] | null
  canPass: boolean
  isMyTurn: boolean
  turnTimer: number
}

// 整手出牌策略 - 手牌是单一牌型且能压过上家
export class FullHandStrategy implements AutoPlayStrategy {
  getName(): string {
    return '整手出牌'
  }

  shouldAutoPlay(context: AutoPlayContext): boolean {
    if (!context.isMyTurn || !context.myCards || context.myCards.length === 0) {
      return false
    }

    const fullHandPattern = CardHintHelper.getFullHandIfSinglePattern(context.myCards)
    if (!fullHandPattern || fullHandPattern.length !== context.myCards.length) {
      return false
    }

    const canPlayFullHand = CardHintHelper.canFullHandBeatLast(
      fullHandPattern,
      context.lastPlayedCards,
    )
    return canPlayFullHand
  }

  getCards(context: AutoPlayContext): string[] | null {
    const fullHandPattern = CardHintHelper.getFullHandIfSinglePattern(context.myCards)
    return fullHandPattern && fullHandPattern.length === context.myCards.length
      ? fullHandPattern
      : null
  }
}

// 超时自动出牌策略 - 倒计时到0时
export class TimeoutStrategy implements AutoPlayStrategy {
  getName(): string {
    return '超时自动'
  }

  shouldAutoPlay(context: AutoPlayContext): boolean {
    return context.isMyTurn && context.turnTimer === 0
  }

  getCards(context: AutoPlayContext): string[] | null {
    if (context.canPass) {
      return [] // 空数组表示不出
    }

    // 必须出牌时，使用提示算法
    const hint = CardHintHelper.getHint(context.myCards, context.lastPlayedCards)
    if (hint && hint.length > 0) {
      return hint
    }

    // 兜底：出最小的牌
    return context.myCards.length > 0 ? [context.myCards[0]] : null
  }
}

// 无牌可出策略 - 自动选择不出
export class NoValidCardsStrategy implements AutoPlayStrategy {
  private timeout = 1000 // 1秒后自动不出

  getName(): string {
    return '无牌自动不出'
  }

  shouldAutoPlay(context: AutoPlayContext): boolean {
    if (!context.isMyTurn || !context.canPass) {
      return false
    }

    const hints = CardHintHelper.getAllHints(context.myCards, context.lastPlayedCards)
    return !hints || hints.length === 0
  }

  getCards(context: AutoPlayContext): string[] | null {
    // 显式使用 context，避免未使用参数的编译错误
    void context
    return [] // 空数组表示不出
  }

  getTimeout(): number {
    return this.timeout
  }
}

// 策略管理器
export class AutoPlayStrategyManager {
  private strategies: AutoPlayStrategy[] = []

  constructor() {
    // 按优先级添加策略
    this.strategies = [
      new FullHandStrategy(),
      new TimeoutStrategy(),
      new NoValidCardsStrategy(),
    ]
  }

  addStrategy(strategy: AutoPlayStrategy): void {
    this.strategies.push(strategy)
  }

  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter((s) => s.getName() !== strategyName)
  }

  findStrategy(context: AutoPlayContext): AutoPlayStrategy | null {
    return this.strategies.find((strategy) => strategy.shouldAutoPlay(context)) || null
  }

  execute(context: AutoPlayContext): { strategy: AutoPlayStrategy; cards: string[] } | null {
    const strategy = this.findStrategy(context)
    if (!strategy) return null

    const cards = strategy.getCards(context)
    if (cards === null) return null

    return { strategy, cards }
  }
}
