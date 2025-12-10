# 设计模式应用说明

本目录包含了应用于游戏房间的各种设计模式实现，旨在提高代码的可维护性、可扩展性和可测试性。

## 📦 包含的设计模式

### 1. 命令模式 (Command Pattern)
**文件**: `GameCommands.ts`

**目的**: 将游戏操作封装成对象，便于撤销、重做、日志记录等。

**使用场景**:
- 出牌操作
- 不出操作
- 抢地主操作

**优势**:
- ✅ 解耦操作的调用者和执行者
- ✅ 支持命令历史记录
- ✅ 便于实现撤销/重做功能
- ✅ 便于添加日志和审计

**使用示例**:
```typescript
import { PlayCardsCommand, CommandManager } from './patterns'

const commandManager = new CommandManager()

// 创建出牌命令
const playCommand = new PlayCardsCommand(
  roomId,
  userId,
  ['♠3', '♥3'],
  () => console.log('出牌成功'),
  (err) => console.error(err)
)

// 执行命令
commandManager.execute(playCommand)

// 查看历史
console.log(commandManager.getHistory())
```

---

### 2. 策略模式 (Strategy Pattern)
**文件**: `AutoPlayStrategies.ts`

**目的**: 定义一系列算法，将每个算法封装起来，使它们可以互相替换。

**使用场景**:
- 自动整手出牌
- 超时自动出牌
- 无牌可出自动不出

**优势**:
- ✅ 避免大量if-else判断
- ✅ 易于添加新的自动出牌策略
- ✅ 每个策略独立测试
- ✅ 策略可以动态切换

**使用示例**:
```typescript
import { AutoPlayStrategyManager } from './patterns'

const manager = new AutoPlayStrategyManager()

const context = {
  myCards: ['♠3', '♥4', '♦5'],
  lastPlayedCards: ['♠2'],
  canPass: true,
  isMyTurn: true,
  turnTimer: 10
}

// 自动找到合适的策略并执行
const result = manager.execute(context)
if (result) {
  console.log(`使用策略: ${result.strategy.getName()}`)
  console.log(`出牌: ${result.cards}`)
}
```

---

### 3. 工厂模式 (Factory Pattern)
**文件**: `EventHandlerFactory.ts`

**目的**: 提供一个创建对象的接口，让子类决定实例化哪一个类。

**使用场景**:
- Socket事件处理器创建
- 不同类型的游戏事件处理

**优势**:
- ✅ 集中管理对象创建
- ✅ 易于扩展新的事件类型
- ✅ 降低代码耦合度
- ✅ 便于单元测试

**使用示例**:
```typescript
import { EventHandlerFactory } from './patterns'

const factory = new EventHandlerFactory({
  dispatch,
  user,
  roomId,
  addMessage
})

// 处理事件
factory.handleEvent('player_joined', { playerName: 'Player1' })
factory.handleEvent('cards_played', { playerId: '123', cards: ['♠3'] })
```

---

### 4. 状态模式 (State Pattern)
**文件**: `GameStateMachine.ts`

**目的**: 允许对象在内部状态改变时改变它的行为。

**使用场景**:
- 游戏不同阶段的状态管理
- waiting → bidding → playing → finished

**优势**:
- ✅ 清晰的状态转换逻辑
- ✅ 每个状态的行为独立
- ✅ 易于添加新状态
- ✅ 防止非法状态转换

**使用示例**:
```typescript
import { GameStateMachine } from './patterns'

const stateMachine = new GameStateMachine('waiting')

// 设置状态变化回调
stateMachine.setOnStateChange((from, to) => {
  console.log(`状态转换: ${from} -> ${to}`)
})

// 状态转换
stateMachine.transition('bidding') // ✅ 合法
stateMachine.transition('finished') // ❌ 非法，会被阻止

// 检查是否可以执行某个动作
if (stateMachine.canPerformAction('bid')) {
  // 执行抢地主操作
}
```

---

## 🔄 如何集成到现有代码

### 集成步骤

1. **命令模式集成**:
```typescript
// 在index.tsx中
import { PlayCardsCommand, CommandManager } from './patterns'

const cmdManager = useRef(new CommandManager())

const handlePlayCards = () => {
  const cmd = new PlayCardsCommand(/*...*/)
  cmdManager.current.execute(cmd)
}
```

2. **策略模式集成**:
```typescript
// 替换现有的自动出牌逻辑
import { AutoPlayStrategyManager } from './patterns'

const autoPlayManager = useRef(new AutoPlayStrategyManager())

useEffect(() => {
  const result = autoPlayManager.current.execute({
    myCards,
    lastPlayedCards,
    canPass,
    isMyTurn,
    turnTimer
  })
  
  if (result) {
    // 执行自动出牌
  }
}, [myCards, isMyTurn, turnTimer])
```

3. **工厂模式集成**:
```typescript
// 简化Socket事件处理
const eventFactory = useMemo(() => 
  new EventHandlerFactory({
    dispatch,
    user,
    roomId,
    addMessage: addChatMessage
  }), 
  [dispatch, user, roomId]
)

socket.on('player_joined', (data) => 
  eventFactory.handleEvent('player_joined', data)
)
```

4. **状态模式集成**:
```typescript
// 管理游戏状态
const gameStateMachine = useRef(new GameStateMachine())

useEffect(() => {
  if (gameStatus === 'bidding') {
    gameStateMachine.current.transition('bidding')
  }
}, [gameStatus])
```

---

## 📈 优势总结

### 代码质量提升
- ✅ **更好的组织**: 相关逻辑集中管理
- ✅ **易于测试**: 每个模式单独测试
- ✅ **降低耦合**: 组件间依赖减少
- ✅ **提高复用**: 模式可在不同场景复用

### 可维护性提升
- ✅ **清晰的职责**: 每个类单一职责
- ✅ **易于扩展**: 开放-封闭原则
- ✅ **减少bug**: 逻辑更加清晰

### 开发效率提升
- ✅ **快速定位**: 问题更容易找到
- ✅ **便于修改**: 改动影响范围小
- ✅ **团队协作**: 统一的代码风格

---

## 🎯 预期收益

### 代码行数减少
- 通过模式复用，预计减少 **100-150行** 重复代码
- 更简洁的主文件逻辑

### 性能优化
- 命令模式支持批处理
- 策略模式避免重复计算
- 状态模式减少不必要的检查

### 未来扩展
- 新增自动出牌策略无需修改现有代码
- 新增事件类型只需添加新的Handler
- 游戏状态扩展不影响现有状态

---

## 📝 注意事项

1. **渐进式采用**: 不必一次性全部重构，可以逐步替换
2. **保持向后兼容**: 确保现有功能正常工作
3. **充分测试**: 每个模式都需要单元测试
4. **文档更新**: 及时更新使用文档

---

## 🔗 相关文档

- [命令模式详解](https://refactoring.guru/design-patterns/command)
- [策略模式详解](https://refactoring.guru/design-patterns/strategy)
- [工厂模式详解](https://refactoring.guru/design-patterns/factory-method)
- [状态模式详解](https://refactoring.guru/design-patterns/state)
