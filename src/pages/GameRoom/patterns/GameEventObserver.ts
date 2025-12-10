/**
 * 观察者模式 - 游戏事件订阅系统
 * 用于解耦事件发布者和订阅者
 */

// 观察者接口
export interface GameObserver {
  update(event: GameEvent): void
  getObserverId(): string
}

// 游戏事件
export interface GameEvent {
  type: string
  data: any
  timestamp: number
}

// 具体观察者 - 积分变化观察者
export class ScoreChangeObserver implements GameObserver {
  constructor(
    private onScoreChange: (playerId: string, newScore: number) => void
  ) {}

  getObserverId(): string {
    return 'score-change-observer'
  }

  update(event: GameEvent): void {
    if (event.type === 'score_changed') {
      this.onScoreChange(event.data.playerId, event.data.newScore)
    }
  }
}

// 具体观察者 - 游戏状态观察者
export class GameStateObserver implements GameObserver {
  constructor(
    private onStateChange: (from: string, to: string) => void
  ) {}

  getObserverId(): string {
    return 'game-state-observer'
  }

  update(event: GameEvent): void {
    if (event.type === 'state_changed') {
      this.onStateChange(event.data.from, event.data.to)
    }
  }
}

// 具体观察者 - 聊天消息观察者
export class ChatMessageObserver implements GameObserver {
  constructor(
    private onMessage: (sender: string, message: string) => void
  ) {}

  getObserverId(): string {
    return 'chat-message-observer'
  }

  update(event: GameEvent): void {
    if (event.type === 'chat_message') {
      this.onMessage(event.data.sender, event.data.message)
    }
  }
}

// 具体观察者 - 牌局历史观察者
export class GameHistoryObserver implements GameObserver {
  private history: GameEvent[] = []

  getObserverId(): string {
    return 'game-history-observer'
  }

  update(event: GameEvent): void {
    // 记录所有事件
    this.history.push(event)
    
    // 只保留最近100个事件
    if (this.history.length > 100) {
      this.history.shift()
    }
  }

  getHistory(): GameEvent[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }
}

// 主题（被观察者）- 游戏事件管理器
export class GameEventSubject {
  private observers: Map<string, GameObserver> = new Map()
  private eventQueue: GameEvent[] = []
  private isProcessing = false

  /**
   * 订阅观察者
   */
  attach(observer: GameObserver): void {
    const id = observer.getObserverId()
    if (!this.observers.has(id)) {
      this.observers.set(id, observer)
      console.log(`[Observer] 订阅观察者: ${id}`)
    }
  }

  /**
   * 取消订阅
   */
  detach(observerId: string): void {
    if (this.observers.has(observerId)) {
      this.observers.delete(observerId)
      console.log(`[Observer] 取消订阅: ${observerId}`)
    }
  }

  /**
   * 通知所有观察者
   */
  notify(event: GameEvent): void {
    console.log(`[Observer] 发布事件: ${event.type}`, event.data)
    
    // 添加到队列
    this.eventQueue.push(event)
    
    // 如果没在处理，开始处理队列
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * 处理事件队列
   */
  private processQueue(): void {
    if (this.eventQueue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const event = this.eventQueue.shift()!

    // 通知所有观察者
    this.observers.forEach((observer) => {
      try {
        observer.update(event)
      } catch (error) {
        console.error(`[Observer] 观察者 ${observer.getObserverId()} 处理事件失败:`, error)
      }
    })

    // 继续处理队列（异步，避免阻塞）
    setTimeout(() => this.processQueue(), 0)
  }

  /**
   * 发布游戏事件
   */
  publishEvent(type: string, data: any): void {
    this.notify({
      type,
      data,
      timestamp: Date.now()
    })
  }

  /**
   * 获取所有观察者
   */
  getObservers(): GameObserver[] {
    return Array.from(this.observers.values())
  }

  /**
   * 清空所有观察者
   */
  clear(): void {
    this.observers.clear()
    this.eventQueue = []
    this.isProcessing = false
  }
}

// 便捷的Hook包装
export function useGameEventSubject() {
  const subject = new GameEventSubject()
  
  return {
    subject,
    subscribe: (observer: GameObserver) => subject.attach(observer),
    unsubscribe: (observerId: string) => subject.detach(observerId),
    publish: (type: string, data: any) => subject.publishEvent(type, data),
  }
}
