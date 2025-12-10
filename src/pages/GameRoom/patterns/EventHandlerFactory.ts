/**
 * 工厂模式 - 事件处理器工厂
 * 根据事件类型创建对应的处理器
 */

// 事件处理器接口
export interface EventHandler<T = any> {
  handle(data: T): void
  getEventName(): string
}

// 事件处理器上下文
export interface EventContext {
  dispatch: any
  user: any
  roomId: string
  addMessage: (name: string, msg: string) => void
  // ... 其他需要的依赖
}

// 玩家加入事件处理器
export class PlayerJoinedHandler implements EventHandler {
  constructor(private context: EventContext) {}

  getEventName(): string {
    return 'player_joined'
  }

  handle(data: any): void {
    if (data.playerName && data.playerName !== this.context.user?.name) {
      this.context.addMessage('系统', `${data.playerName} 加入了房间`)
    }
  }
}

// 玩家离开事件处理器
export class PlayerLeftHandler implements EventHandler {
  constructor(private context: EventContext) {}

  getEventName(): string {
    return 'player_left'
  }

  handle(data: any): void {
    this.context.addMessage('系统', `${data.playerName || '玩家'} 离开了房间`)
  }
}

// 出牌事件处理器
export class CardsPlayedHandler implements EventHandler {
  constructor(private context: EventContext) {}

  getEventName(): string {
    return 'cards_played'
  }

  handle(data: any): void {
    if (!data.playerId || !data.cards) return

    const currentUserId = this.context.user?.id || this.context.user?.name
    const isCurrentUser = data.playerId === currentUserId || data.playerName === this.context.user?.name

    if (!isCurrentUser && data.cardType?.description) {
      this.context.addMessage('系统', `${data.playerName} 打出 ${data.cardType.description}`)
    }
  }
}

// 事件处理器工厂
export class EventHandlerFactory {
  private handlers: Map<string, EventHandler> = new Map()

  constructor(private context: EventContext) {
    this.registerDefaultHandlers()
  }

  private registerDefaultHandlers(): void {
    const handlers = [
      new PlayerJoinedHandler(this.context),
      new PlayerLeftHandler(this.context),
      new CardsPlayedHandler(this.context),
    ]

    handlers.forEach((handler) => {
      this.register(handler)
    })
  }

  register(handler: EventHandler): void {
    this.handlers.set(handler.getEventName(), handler)
  }

  unregister(eventName: string): void {
    this.handlers.delete(eventName)
  }

  createHandler(eventName: string): EventHandler | null {
    return this.handlers.get(eventName) || null
  }

  handleEvent(eventName: string, data: any): boolean {
    const handler = this.createHandler(eventName)
    if (!handler) return false

    handler.handle(data)
    return true
  }

  getAllHandlers(): EventHandler[] {
    return Array.from(this.handlers.values())
  }
}
