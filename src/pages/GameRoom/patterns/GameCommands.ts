/**
 * 命令模式 - 封装游戏操作
 * 将操作封装成对象，便于撤销、重做、日志记录等
 */

import { globalSocket } from '@/services/socket'

// 命令接口
interface GameCommand {
  execute(): void
  undo?(): void
  canExecute(): boolean
}

// 出牌命令
export class PlayCardsCommand implements GameCommand {
  constructor(
    private roomId: string,
    private userId: string,
    private cards: string[],
    private onSuccess: () => void,
    private onError: (msg: string) => void,
  ) {}

  canExecute(): boolean {
    return this.cards.length > 0 && !!globalSocket.getSocket()
  }

  execute(): void {
    if (!this.canExecute()) {
      this.onError('无法执行出牌操作')
      return
    }

    const socket = globalSocket.getSocket()
    
    console.log('[PlayCardsCommand] 发送出牌请求', {
      roomId: this.roomId,
      userId: this.userId,
      cards: this.cards
    })

    // 发送出牌请求
    socket?.emit('play_cards', {
      roomId: this.roomId,
      userId: this.userId,
      cards: this.cards
    })

    // 立即调用 onSuccess 重置 pending 状态
    // 实际的出牌结果由 cards_played/play_cards_failed 事件通知
    this.onSuccess()
  }
}

// 不出命令
export class PassCommand implements GameCommand {
  constructor(
    private roomId: string,
    private userId: string,
    private onSuccess: () => void,
    private onError: (msg: string) => void,
  ) {}

  canExecute(): boolean {
    return !!globalSocket.getSocket()
  }

  execute(): void {
    if (!this.canExecute()) {
      this.onError('无法连接服务器')
      return
    }

    const socket = globalSocket.getSocket()
    socket?.emit('pass_turn', {
      roomId: this.roomId,
      userId: this.userId,
    })
    this.onSuccess()
  }
}

// 抢地主命令
export class BidCommand implements GameCommand {
  constructor(
    private roomId: string,
    private userId: string,
    private bid: boolean,
    private onSuccess: () => void,
  ) {}

  canExecute(): boolean {
    return !!globalSocket.getSocket()
  }

  execute(): void {
    if (!this.canExecute()) {
      return
    }

    const socket = globalSocket.getSocket()
    socket?.emit('bid', {
      roomId: this.roomId,
      userId: this.userId,
      bid: this.bid,
    })
    this.onSuccess()
  }
}

// 命令管理器 - 可以记录历史、撤销等
export class CommandManager {
  private history: GameCommand[] = []
  private currentIndex = -1

  execute(command: GameCommand): boolean {
    if (!command.canExecute()) {
      return false
    }

    command.execute()
    this.history.push(command)
    this.currentIndex++
    return true
  }

  canUndo(): boolean {
    return this.currentIndex >= 0 && !!this.history[this.currentIndex]?.undo
  }

  undo(): void {
    if (this.canUndo()) {
      this.history[this.currentIndex]?.undo?.()
      this.currentIndex--
    }
  }

  getHistory(): GameCommand[] {
    return [...this.history]
  }

  clear(): void {
    this.history = []
    this.currentIndex = -1
  }
}
