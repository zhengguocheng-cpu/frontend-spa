/**
 * 状态模式 - 游戏状态机
 * 管理游戏不同阶段的状态转换和行为
 */

// 游戏状态接口
export interface GameState {
  getName(): string
  canTransitionTo(nextState: string): boolean
  enter(context: GameStateContext): void
  exit(context: GameStateContext): void
  getAllowedActions(): string[]
}

// 状态上下文
export interface GameStateContext {
  currentState: string
  onStateChange?: (from: string, to: string) => void
  onAction?: (action: string) => void
}

// 等待状态 - 等待玩家加入
export class WaitingState implements GameState {
  getName(): string {
    return 'waiting'
  }

  canTransitionTo(nextState: string): boolean {
    return nextState === 'bidding'
  }

  enter(context: GameStateContext): void {
    console.log('[State] 进入等待状态')
    context.onStateChange?.('', 'waiting')
  }

  exit(context: GameStateContext): void {
    void context
    console.log('[State] 离开等待状态')
  }

  getAllowedActions(): string[] {
    return ['ready', 'leave']
  }
}

// 叫地主状态
export class BiddingState implements GameState {
  getName(): string {
    return 'bidding'
  }

  canTransitionTo(nextState: string): boolean {
    return nextState === 'playing'
  }

  enter(context: GameStateContext): void {
    console.log('[State] 进入叫地主状态')
    context.onStateChange?.('waiting', 'bidding')
  }

  exit(context: GameStateContext): void {
    void context
    console.log('[State] 离开叫地主状态')
  }

  getAllowedActions(): string[] {
    return ['bid', 'pass']
  }
}

// 游戏进行状态
export class PlayingState implements GameState {
  getName(): string {
    return 'playing'
  }

  canTransitionTo(nextState: string): boolean {
    return nextState === 'finished'
  }

  enter(context: GameStateContext): void {
    console.log('[State] 进入游戏状态')
    context.onStateChange?.('bidding', 'playing')
  }

  exit(context: GameStateContext): void {
    void context
    console.log('[State] 离开游戏状态')
  }

  getAllowedActions(): string[] {
    return ['play', 'pass', 'hint']
  }
}

// 结算状态
export class FinishedState implements GameState {
  getName(): string {
    return 'finished'
  }

  canTransitionTo(nextState: string): boolean {
    return nextState === 'waiting'
  }

  enter(context: GameStateContext): void {
    console.log('[State] 进入结算状态')
    context.onStateChange?.('playing', 'finished')
  }

  exit(context: GameStateContext): void {
    void context
    console.log('[State] 离开结算状态')
  }

  getAllowedActions(): string[] {
    return ['playAgain', 'leave']
  }
}

// 游戏状态机
export class GameStateMachine {
  private states: Map<string, GameState> = new Map()
  private currentState: GameState
  private context: GameStateContext

  constructor(initialState: string = 'waiting') {
    // 注册所有状态
    const allStates = [
      new WaitingState(),
      new BiddingState(),
      new PlayingState(),
      new FinishedState(),
    ]

    allStates.forEach((state) => {
      this.states.set(state.getName(), state)
    })

    // 设置初始状态
    const initial = this.states.get(initialState)
    if (!initial) {
      throw new Error(`Invalid initial state: ${initialState}`)
    }

    this.currentState = initial
    this.context = { currentState: initialState }
    this.currentState.enter(this.context)
  }

  getCurrentState(): string {
    return this.currentState.getName()
  }

  canPerformAction(action: string): boolean {
    return this.currentState.getAllowedActions().includes(action)
  }

  transition(nextStateName: string): boolean {
    const nextState = this.states.get(nextStateName)
    if (!nextState) {
      console.error(`State not found: ${nextStateName}`)
      return false
    }

    if (!this.currentState.canTransitionTo(nextStateName)) {
      console.warn(
        `Invalid transition: ${this.currentState.getName()} -> ${nextStateName}`,
      )
      return false
    }

    // 执行状态转换
    const previousState = this.currentState
    previousState.exit(this.context)

    this.currentState = nextState
    this.context.currentState = nextStateName
    this.currentState.enter(this.context)

    return true
  }

  setOnStateChange(callback: (from: string, to: string) => void): void {
    this.context.onStateChange = callback
  }

  setOnAction(callback: (action: string) => void): void {
    this.context.onAction = callback
  }

  reset(): void {
    this.currentState.exit(this.context)
    const waitingState = this.states.get('waiting')
    if (waitingState) {
      this.currentState = waitingState
      this.context.currentState = 'waiting'
      this.currentState.enter(this.context)
    }
  }
}
