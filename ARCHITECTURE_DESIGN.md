# 前端架构设计方案 - 多棋牌游戏平台

## 设计目标
1. **避免单文件过大**：每个文件 < 200 行
2. **业务逻辑分离**：游戏特定 vs 通用逻辑
3. **可扩展性**：快速支持新游戏（掼蛋、升级、够级等）
4. **可维护性**：清晰的模块边界和职责划分

---

## 核心架构模式

### 1. 分层架构（Layered Architecture）

```
┌─────────────────────────────────────────────────┐
│           UI Layer (表现层)                       │
│  - 页面组件 (Pages)                              │
│  - UI 组件 (Components)                          │
│  - 布局组件 (Layouts)                            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│      Business Logic Layer (业务逻辑层)           │
│  - Custom Hooks                                  │
│  - Game Controllers                              │
│  - State Management (Redux)                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         Service Layer (服务层)                   │
│  - Socket Service                                │
│  - API Service                                   │
│  - Sound Service                                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│          Core Layer (核心层)                      │
│  - Game Engine (游戏引擎抽象)                     │
│  - Utils (工具函数)                              │
│  - Types (类型定义)                              │
└─────────────────────────────────────────────────┘
```

---

## 推荐的设计模式

### 2. 策略模式（Strategy Pattern）- 游戏规则抽象

每个棋牌游戏都有不同的规则，使用策略模式封装：

```typescript
// src/core/game/IGameStrategy.ts
export interface IGameStrategy {
  // 游戏名称
  getName(): string
  
  // 卡牌相关
  validateCards(cards: string[]): boolean
  compareCards(cards1: string[], cards2: string[]): number
  
  // 玩家数量
  getPlayerCount(): number
  
  // 回合逻辑
  canPass(): boolean
  isGameOver(): boolean
  
  // 计分逻辑
  calculateScore(gameData: any): number
}

// src/games/doudizhu/strategy.ts
export class DouDiZhuStrategy implements IGameStrategy {
  getName() { return '斗地主' }
  getPlayerCount() { return 3 }
  // ... 实现斗地主特定逻辑
}

// src/games/guandan/strategy.ts
export class GuanDanStrategy implements IGameStrategy {
  getName() { return '掼蛋' }
  getPlayerCount() { return 4 }
  // ... 实现掼蛋特定逻辑
}
```

### 3. 工厂模式（Factory Pattern）- 游戏实例创建

```typescript
// src/core/game/GameFactory.ts
export class GameFactory {
  private static strategies = new Map<string, IGameStrategy>()
  
  static register(gameType: string, strategy: IGameStrategy) {
    this.strategies.set(gameType, strategy)
  }
  
  static create(gameType: string): IGameStrategy {
    const strategy = this.strategies.get(gameType)
    if (!strategy) throw new Error(`Unknown game type: ${gameType}`)
    return strategy
  }
}

// 注册游戏
GameFactory.register('doudizhu', new DouDiZhuStrategy())
GameFactory.register('guandan', new GuanDanStrategy())
GameFactory.register('shengji', new ShengJiStrategy())
```

### 4. 观察者模式（Observer Pattern）- 游戏事件

```typescript
// src/core/event/GameEventBus.ts
export class GameEventBus {
  private listeners = new Map<string, Set<Function>>()
  
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }
  
  off(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler)
  }
  
  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(handler => handler(data))
  }
}
```

### 5. 组合模式（Composition Pattern）- UI 组件拆分

将大组件拆分成小的、可组合的组件：

```
GameRoom (< 150 行)
├── PlayerArea (< 100 行)
│   ├── PlayerInfo
│   ├── PlayerCards
│   └── PlayerStatus
├── PlayArea (< 100 行)
│   ├── CardSelector
│   ├── ActionButtons
│   └── LastPlayedCards
├── GameControls (< 80 行)
│   ├── ChatPanel
│   ├── SettingsPanel
│   └── HintPanel
└── GameOverlay (< 80 行)
    ├── BiddingUI
    ├── Settlement
    └── Loading
```

---

## 目录结构设计

```
src/
├── core/                           # 核心层（所有游戏共用）
│   ├── game/
│   │   ├── IGameStrategy.ts        # 游戏策略接口
│   │   ├── GameFactory.ts          # 游戏工厂
│   │   ├── GameEngine.ts           # 游戏引擎基类
│   │   └── BaseGameController.ts   # 基础游戏控制器
│   ├── event/
│   │   └── GameEventBus.ts         # 事件总线
│   ├── socket/
│   │   ├── SocketManager.ts        # Socket 管理器
│   │   └── SocketEventAdapter.ts   # Socket 事件适配器
│   └── utils/
│       ├── cardUtils.ts            # 通用卡牌工具
│       ├── playerUtils.ts          # 通用玩家工具
│       └── animationUtils.ts       # 动画工具
│
├── games/                          # 游戏特定层
│   ├── doudizhu/                   # 斗地主
│   │   ├── strategy.ts             # 斗地主策略
│   │   ├── hooks/
│   │   │   ├── useDouDiZhuGame.ts  # 斗地主游戏 Hook
│   │   │   └── useDouDiZhuBidding.ts
│   │   ├── components/
│   │   │   ├── BiddingControls.tsx
│   │   │   ├── LandlordIndicator.tsx
│   │   │   └── BottomCards.tsx
│   │   ├── utils/
│   │   │   ├── cardValidator.ts    # 斗地主卡牌验证
│   │   │   └── scoreCalculator.ts  # 斗地主计分
│   │   └── types.ts                # 斗地主类型定义
│   │
│   ├── guandan/                    # 掼蛋（未来扩展）
│   │   ├── strategy.ts
│   │   ├── hooks/
│   │   ├── components/
│   │   └── utils/
│   │
│   └── shengji/                    # 升级（未来扩展）
│       └── ...
│
├── shared/                         # 共享层（跨游戏复用）
│   ├── hooks/
│   │   ├── useGameSocket.ts        # 通用 Socket Hook
│   │   ├── useGameTimer.ts         # 通用定时器 Hook
│   │   ├── useGameUI.ts            # 通用 UI 状态 Hook
│   │   └── useGameChat.ts          # 通用聊天 Hook
│   ├── components/
│   │   ├── GameLayout/             # 游戏布局
│   │   ├── PlayerArea/             # 玩家区域（通用）
│   │   ├── ChatPanel/              # 聊天面板（通用）
│   │   ├── SettingsPanel/          # 设置面板（通用）
│   │   └── CardHand/               # 手牌显示（通用）
│   └── services/
│       ├── apiService.ts           # API 服务
│       ├── soundService.ts         # 音效服务
│       └── storageService.ts       # 存储服务
│
├── pages/                          # 页面层
│   ├── GameRoom/
│   │   └── index.tsx               # < 150 行，组合各组件
│   ├── GameLobby/
│   │   └── index.tsx
│   └── ...
│
├── store/                          # 状态管理
│   ├── slices/
│   │   ├── gameSlice.ts            # 通用游戏状态
│   │   ├── doudizhSlice.ts         # 斗地主特定状态
│   │   └── userSlice.ts
│   └── index.ts
│
└── types/                          # 类型定义
    ├── core/                       # 核心类型
    │   ├── game.ts
    │   └── socket.ts
    └── games/                      # 游戏特定类型
        ├── doudizhu.ts
        └── guandan.ts
```

---

## 关键设计原则

### 1. 依赖倒置原则（DIP）
- 高层模块（UI）不依赖低层模块（具体游戏），都依赖抽象（接口）
- 示例：`GameRoom` 依赖 `IGameStrategy`，而不是 `DouDiZhuStrategy`

### 2. 单一职责原则（SRP）
- 每个文件/类只负责一件事
- 示例：
  - `useGameSocket.ts` - 只负责 Socket 通信
  - `useGameTimer.ts` - 只负责定时器管理
  - `PlayerInfo.tsx` - 只负责显示玩家信息

### 3. 开闭原则（OCP）
- 对扩展开放，对修改封闭
- 添加新游戏时，不需要修改核心代码，只需添加新的策略实现

### 4. 接口隔离原则（ISP）
- 不强迫组件依赖它不使用的接口
- 将大接口拆分成小的、专用的接口

---

## 实施步骤

### Step 1: 提取核心抽象（1-2天）
```typescript
// src/core/game/IGameStrategy.ts
// src/core/game/GameEngine.ts
// src/core/socket/SocketManager.ts
```

### Step 2: 重构斗地主为第一个游戏实现（2-3天）
```typescript
// src/games/doudizhu/strategy.ts
// src/games/doudizhu/hooks/
// src/games/doudizhu/components/
```

### Step 3: 提取共享层（2-3天）
```typescript
// src/shared/hooks/
// src/shared/components/
```

### Step 4: 简化页面组件（1天）
```typescript
// src/pages/GameRoom/index.tsx - 缩减到 < 150 行
```

### Step 5: 添加新游戏（掼蛋示例）（1-2天）
```typescript
// src/games/guandan/ - 复制斗地主结构，修改规则
```

---

## 具体实现示例

### 统一游戏入口

```typescript
// src/pages/GameRoom/index.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { GameFactory } from '@/core/game/GameFactory'
import { GameLayout } from '@/shared/components/GameLayout'
import { useGameEngine } from '@/shared/hooks/useGameEngine'

export default function GameRoom() {
  const { gameType, roomId } = useParams()
  const strategy = GameFactory.create(gameType!) // 'doudizhu' | 'guandan' | 'shengji'
  const gameEngine = useGameEngine(strategy, roomId)
  
  return (
    <GameLayout gameEngine={gameEngine}>
      {/* 动态加载游戏特定 UI */}
      {gameEngine.renderGameUI()}
    </GameLayout>
  )
}
```

### 游戏引擎统一接口

```typescript
// src/core/game/GameEngine.ts
export class GameEngine {
  constructor(
    private strategy: IGameStrategy,
    private socket: SocketManager,
    private eventBus: GameEventBus
  ) {}
  
  // 通用游戏流程
  async startGame() {
    await this.strategy.initialize()
    this.eventBus.emit('game:started', {})
  }
  
  async playCards(cards: string[]) {
    const valid = this.strategy.validateCards(cards)
    if (!valid) throw new Error('Invalid cards')
    
    await this.socket.emit('play_cards', { cards })
    this.eventBus.emit('cards:played', { cards })
  }
  
  // 渲染游戏特定 UI
  renderGameUI() {
    return this.strategy.renderUI()
  }
}
```

---

## 性能优化建议

### 1. 代码分割（Code Splitting）
```typescript
// 懒加载游戏特定代码
const DouDiZhuGame = lazy(() => import('@/games/doudizhu'))
const GuanDanGame = lazy(() => import('@/games/guandan'))
```

### 2. 组件懒加载
```typescript
// 只加载当前需要的组件
const BiddingUI = lazy(() => import('./components/BiddingUI'))
```

### 3. 状态管理优化
```typescript
// 使用 Redux Toolkit 的 createSlice + immer
// 避免不必要的重新渲染
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    updatePlayer: (state, action) => {
      const player = state.players.find(p => p.id === action.payload.id)
      if (player) Object.assign(player, action.payload)
    }
  }
})
```

---

## 测试策略

### 1. 单元测试
- 每个工具函数都有对应测试
- 每个策略类都有测试用例

### 2. 集成测试
- 测试游戏引擎与策略的集成
- 测试 Socket 事件流

### 3. E2E 测试
- 使用 Playwright 测试完整游戏流程

---

## 总结

采用这种架构的**核心优势**：

1. ✅ **文件小而专注**：每个文件 < 200 行
2. ✅ **业务分离清晰**：核心、共享、游戏特定三层分离
3. ✅ **扩展新游戏快**：添加掼蛋只需实现 `GuanDanStrategy` + 特定组件
4. ✅ **代码复用率高**：Socket、UI、定时器等逻辑跨游戏复用
5. ✅ **易于维护**：清晰的模块边界，改动影响范围小
6. ✅ **易于测试**：每个模块可独立测试

**时间投资**：
- 初次重构：约 7-10 天
- 添加新游戏：约 2-3 天（有了基础架构后）
- 长期收益：维护成本降低 60%+，新功能开发速度提升 50%+
