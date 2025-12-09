# GameRoom 设计模式应用指南

## 🎨 可应用的设计模式

### 1. 观察者模式 (Observer Pattern) ✅ 已应用

**应用场景**: Socket 事件监听

**当前实现**:
```typescript
// Socket.IO 本身就是观察者模式
socket.on('cards_played', handleCardsPlayed)
socket.on('game_ended', handleGameEnded)
```

**优化建议**:
```typescript
// 创建事件总线，统一管理
class GameEventBus {
  private handlers = new Map()
  
  subscribe(event: string, handler: Function) {
    this.handlers.set(event, handler)
  }
  
  emit(event: string, data: any) {
    this.handlers.get(event)?.(data)
  }
}
```

---

### 2. 状态模式 (State Pattern) ⭐ 推荐应用

**应用场景**: 游戏不同阶段的行为管理

**问题**: 当前代码中大量 `if (gameStatus === 'xxx')` 判断

**优化方案**:
```typescript
// 定义游戏状态接口
interface GameState {
  onEnter(): void
  onExit(): void
  handleAction(action: string): void
}

// 等待状态
class WaitingState implements GameState {
  onEnter() {
    console.log('进入等待状态')
  }
  
  handleAction(action: string) {
    if (action === 'ready') {
      // 处理准备逻辑
    }
  }
  
  onExit() {
    console.log('退出等待状态')
  }
}

// 抢地主状态
class BiddingState implements GameState {
  onEnter() {
    console.log('进入抢地主状态')
  }
  
  handleAction(action: string) {
    if (action === 'bid') {
      // 处理抢地主逻辑
    }
  }
  
  onExit() {
    console.log('退出抢地主状态')
  }
}

// 出牌状态
class PlayingState implements GameState {
  onEnter() {
    console.log('进入出牌状态')
  }
  
  handleAction(action: string) {
    if (action === 'playCards') {
      // 处理出牌逻辑
    }
  }
  
  onExit() {
    console.log('退出出牌状态')
  }
}

// 状态管理器
class GameStateManager {
  private currentState: GameState
  
  setState(newState: GameState) {
    this.currentState?.onExit()
    this.currentState = newState
    this.currentState.onEnter()
  }
  
  handleAction(action: string) {
    this.currentState.handleAction(action)
  }
}
```

**应用效果**:
```typescript
// 替代前
if (gameStatus === 'waiting') {
  // 等待逻辑
} else if (gameStatus === 'bidding') {
  // 抢地主逻辑
} else if (gameStatus === 'playing') {
  // 出牌逻辑
}

// 替代后
stateManager.handleAction('ready')
```

---

### 3. 命令模式 (Command Pattern) ⭐ 推荐应用

**应用场景**: 游戏操作（出牌、抢地主、不出等）

**优化方案**:
```typescript
// 命令接口
interface GameCommand {
  execute(): void
  undo?(): void  // 支持撤销
}

// 出牌命令
class PlayCardsCommand implements GameCommand {
  constructor(
    private cards: string[],
    private socket: Socket,
    private roomId: string
  ) {}
  
  execute() {
    this.socket.emit('play_cards', {
      roomId: this.roomId,
      cards: this.cards
    })
  }
  
  undo() {
    // 撤销出牌（如果支持）
  }
}

// 抢地主命令
class BidCommand implements GameCommand {
  constructor(
    private bid: boolean,
    private socket: Socket,
    private roomId: string
  ) {}
  
  execute() {
    this.socket.emit('bid', {
      roomId: this.roomId,
      bid: this.bid
    })
  }
}

// 命令管理器（支持历史记录）
class CommandManager {
  private history: GameCommand[] = []
  
  execute(command: GameCommand) {
    command.execute()
    this.history.push(command)
  }
  
  undo() {
    const command = this.history.pop()
    command?.undo?.()
  }
}
```

**应用效果**:
```typescript
// 替代前
socket.emit('play_cards', { roomId, cards })

// 替代后
const command = new PlayCardsCommand(cards, socket, roomId)
commandManager.execute(command)
```

---

### 4. 策略模式 (Strategy Pattern)

**应用场景**: 不同的提示算法

**优化方案**:
```typescript
// 提示策略接口
interface HintStrategy {
  getHint(myCards: string[], lastCards: string[] | null): string[]
}

// 本地算法策略
class LocalHintStrategy implements HintStrategy {
  getHint(myCards: string[], lastCards: string[] | null) {
    return CardHintHelper.getHint(myCards, lastCards)
  }
}

// AI 算法策略
class AIHintStrategy implements HintStrategy {
  constructor(private apiClient: ApiClient) {}
  
  async getHint(myCards: string[], lastCards: string[] | null) {
    return await this.apiClient.getAIHint(myCards, lastCards)
  }
}

// 策略上下文
class HintContext {
  private strategy: HintStrategy
  
  setStrategy(strategy: HintStrategy) {
    this.strategy = strategy
  }
  
  getHint(myCards: string[], lastCards: string[] | null) {
    return this.strategy.getHint(myCards, lastCards)
  }
}
```

---

### 5. 装饰器模式 (Decorator Pattern)

**应用场景**: 增强组件功能

**优化方案**:
```typescript
// 基础组件
function BaseButton({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>
}

// 装饰器：添加日志
function withLogging(Component) {
  return function LoggedComponent(props) {
    const handleClick = () => {
      console.log('Button clicked')
      props.onClick()
    }
    return <Component {...props} onClick={handleClick} />
  }
}

// 装饰器：添加防抖
function withDebounce(Component, delay = 300) {
  return function DebouncedComponent(props) {
    const debouncedClick = useDebounce(props.onClick, delay)
    return <Component {...props} onClick={debouncedClick} />
  }
}

// 使用
const EnhancedButton = withLogging(withDebounce(BaseButton))
```

---

### 6. 工厂模式 (Factory Pattern)

**应用场景**: 创建不同类型的UI组件

**优化方案**:
```typescript
// 组件工厂
class ComponentFactory {
  static createPlayerDisplay(type: 'left' | 'right' | 'bottom', props) {
    switch (type) {
      case 'left':
        return <LeftPlayerDisplay {...props} />
      case 'right':
        return <RightPlayerDisplay {...props} />
      case 'bottom':
        return <BottomPlayerDisplay {...props} />
    }
  }
}

// 使用
const player = ComponentFactory.createPlayerDisplay('left', playerData)
```

---

### 7. 组合模式 (Composite Pattern) ✅ 已应用

**应用场景**: React 组件树本身就是组合模式

**示例**:
```typescript
// 组合组件
function GameRoom() {
  return (
    <div>
      <PlayerArea />
      <HandCards />
      <GameControls />
      <ChatPanel />
    </div>
  )
}
```

---

### 8. 适配器模式 (Adapter Pattern)

**应用场景**: 统一不同数据源的接口

**优化方案**:
```typescript
// 统一接口
interface GameDataAdapter {
  getPlayers(): Player[]
  getCurrentPlayer(): Player
  getGameState(): GameState
}

// Redux 适配器
class ReduxAdapter implements GameDataAdapter {
  constructor(private store: Store) {}
  
  getPlayers() {
    return this.store.getState().game.players
  }
  
  getCurrentPlayer() {
    return this.store.getState().game.currentPlayer
  }
  
  getGameState() {
    return this.store.getState().game
  }
}

// Socket 数据适配器
class SocketDataAdapter implements GameDataAdapter {
  constructor(private socketData: any) {}
  
  getPlayers() {
    return this.socketData.players.map(p => ({
      id: p.playerId,
      name: p.playerName,
      // 转换数据格式
    }))
  }
}
```

---

## 🎯 推荐应用优先级

### 立即应用（高收益）
1. ⭐ **状态模式** - 简化游戏流程控制
2. ⭐ **命令模式** - 规范化操作执行
3. ⭐ **策略模式** - 灵活切换算法

### 逐步应用（中收益）
4. **装饰器模式** - 增强组件功能
5. **工厂模式** - 统一创建组件
6. **适配器模式** - 统一数据接口

### 已自然应用
7. ✅ **观察者模式** - Socket事件
8. ✅ **组合模式** - React组件树

---

## 📝 实施建议

### Phase 1: 状态模式重构
将游戏状态管理改为状态模式
- 创建 `GameStateManager`
- 定义各个状态类
- 替换条件判断

### Phase 2: 命令模式重构
将用户操作封装为命令
- 创建命令接口
- 实现各个命令类
- 支持撤销/重做

### Phase 3: 策略模式重构
将算法抽象为策略
- 定义策略接口
- 实现不同策略
- 动态切换策略

---

## 💡 设计模式组合

### 组合1: 状态 + 命令
```typescript
class GameStateManager {
  executeCommand(command: GameCommand) {
    // 根据当前状态决定是否执行命令
    if (this.currentState.canExecute(command)) {
      command.execute()
    }
  }
}
```

### 组合2: 观察者 + 命令
```typescript
class EventBus {
  on(event: string, command: GameCommand) {
    this.handlers.set(event, () => command.execute())
  }
}
```

### 组合3: 策略 + 工厂
```typescript
class HintStrategyFactory {
  static create(type: 'local' | 'ai'): HintStrategy {
    return type === 'local' 
      ? new LocalHintStrategy()
      : new AIHintStrategy()
  }
}
```

---

**下一步**: 在重构过程中逐步应用这些设计模式
