# 前端SPA架构优化建议

## 🎯 目标

基于**Feature-Sliced Design (FSD)** 和现代React最佳实践，重组整个项目架构，实现：
- 高度模块化、低耦合
- 清晰的依赖关系
- 易于扩展和维护
- 团队协作友好

## 📁 推荐的目录结构

### 新架构（Feature-Sliced Design）

```
frontend-spa/
├── src/
│   ├── app/                    # 应用层（最顶层）
│   │   ├── providers/          # 全局Provider组合
│   │   ├── router/             # 路由配置
│   │   ├── styles/             # 全局样式
│   │   └── index.tsx           # 应用入口
│   │
│   ├── pages/                  # 页面层（路由级页面）
│   │   ├── game-room/          # 游戏房间页 ✅ 当前重构中
│   │   ├── lobby/              # 大厅页
│   │   ├── room-list/          # 房间列表页
│   │   └── ...                 # 其他页面
│   │
│   ├── widgets/                # 组合层（复杂业务组件）
│   │   ├── game-board/         # 游戏桌面组件
│   │   ├── player-panel/       # 玩家面板
│   │   ├── chat-window/        # 聊天窗口
│   │   └── settlement-modal/   # 结算弹窗
│   │
│   ├── features/               # 功能层（业务功能）
│   │   ├── auth/               # 认证功能
│   │   ├── game-play/          # 游戏玩法
│   │   │   ├── ui/             # UI组件
│   │   │   ├── model/          # 状态管理
│   │   │   ├── lib/            # 工具函数
│   │   │   └── api/            # API调用
│   │   ├── bidding/            # 叫地主功能
│   │   ├── card-selection/     # 选牌功能
│   │   └── wallet/             # 钱包功能
│   │
│   ├── entities/               # 实体层（业务实体）
│   │   ├── player/             # 玩家实体
│   │   │   ├── model/          # 状态(Redux)
│   │   │   ├── ui/             # UI组件
│   │   │   └── lib/            # 工具函数
│   │   ├── card/               # 牌实体
│   │   ├── room/               # 房间实体
│   │   └── game/               # 游戏实体
│   │
│   ├── shared/                 # 共享层（通用代码）
│   │   ├── ui/                 # 通用UI组件
│   │   │   ├── button/
│   │   │   ├── modal/
│   │   │   ├── input/
│   │   │   └── ...
│   │   ├── lib/                # 工具库
│   │   │   ├── hooks/          # 通用hooks
│   │   │   ├── utils/          # 工具函数
│   │   │   └── constants/      # 常量
│   │   ├── api/                # API客户端
│   │   │   ├── socket/         # Socket封装
│   │   │   └── rest/           # REST API
│   │   ├── config/             # 配置
│   │   └── types/              # 全局类型
│   │
│   └── index.tsx               # 入口文件
│
├── public/                     # 静态资源
└── package.json
```

### 依赖规则

```
app → pages → widgets → features → entities → shared
  ↓      ↓       ↓         ↓          ↓          ↓
(只能依赖下层，不能依赖上层或同层)
```

## 🔧 具体优化方案

### 1. GameRoom重构示例

#### 当前结构（扁平化）
```
pages/GameRoom/
├── index.tsx                   # 1875行 😱
├── hooks/
│   ├── useGameUI.ts
│   ├── useGameTimer.ts
│   ├── useWalletScore.ts      # 新增
│   └── useAutoPlay.ts          # 新增
├── logic/
│   ├── helpers.ts
│   ├── playerHelper.ts
│   ├── voiceHelper.ts
│   └── walletHelper.ts
└── components/
    ├── BottomCards/
    ├── HandCards/
    └── ...
```

#### 推荐结构（FSD）
```
pages/game-room/
├── ui/
│   └── GameRoomPage.tsx        # ~200行 ✨
│
widgets/game-board/
├── ui/
│   ├── GameBoard.tsx           # 主游戏区域
│   └── PlayerArea.tsx          # 玩家区域
├── model/
│   └── index.ts                # 组件状态
└── lib/
    └── hooks.ts                # 组件hooks

features/
├── game-play/
│   ├── ui/
│   │   ├── PlayButton.tsx
│   │   └── PassButton.tsx
│   ├── model/
│   │   ├── store.ts            # Redux slice
│   │   └── hooks.ts            # 业务hooks
│   └── lib/
│       ├── validation.ts       # 出牌验证
│       └── cardHint.ts         # 提示算法
│
├── bidding/
│   ├── ui/
│   │   └── BiddingPanel.tsx
│   ├── model/
│   │   └── store.ts
│   └── lib/
│       └── autoBid.ts
│
├── card-selection/
│   ├── ui/
│   │   └── CardGrid.tsx
│   └── model/
│       └── selection.ts
│
└── wallet/
    ├── ui/
    │   └── WalletDisplay.tsx
    ├── model/
    │   └── store.ts
    └── api/
        └── scoreApi.ts

entities/
├── player/
│   ├── model/
│   │   └── types.ts            # Player类型
│   ├── ui/
│   │   ├── PlayerCard.tsx      # 玩家卡片
│   │   └── PlayerAvatar.tsx    # 玩家头像
│   └── lib/
│       └── position.ts         # 位置计算
│
└── card/
    ├── model/
    │   └── types.ts            # Card类型
    ├── ui/
    │   └── Card.tsx            # 单张牌组件
    └── lib/
        ├── parser.ts           # 牌解析
        └── sorter.ts           # 牌排序

shared/
├── api/
│   └── socket/
│       ├── SocketClient.ts     # Socket封装
│       ├── events.ts           # 事件定义
│       └── hooks.ts            # useSocket等
│
└── lib/
    ├── hooks/
    │   ├── useAutoPlay.ts
    │   ├── useCountdown.ts
    │   └── useDebounce.ts
    └── utils/
        ├── logger.ts           # 日志工具
        └── format.ts           # 格式化
```

### 2. 设计模式应用

#### A. 策略模式 - 牌型处理
```typescript
// features/game-play/lib/patterns/index.ts
interface CardPattern {
  validate(cards: string[]): boolean
  compare(a: string[], b: string[]): number
}

class SinglePattern implements CardPattern { ... }
class PairPattern implements CardPattern { ... }
class BombPattern implements CardPattern { ... }

// 使用
const patterns = {
  single: new SinglePattern(),
  pair: new PairPattern(),
  bomb: new BombPattern(),
}
```

#### B. 观察者模式 - Socket事件
```typescript
// shared/api/socket/EventBus.ts
class SocketEventBus {
  private listeners = new Map<string, Set<Function>>()
  
  on(event: string, handler: Function) { ... }
  off(event: string, handler: Function) { ... }
  emit(event: string, data: any) { ... }
}

// 使用
socketBus.on('cards_played', handleCardsPlayed)
socketBus.on('turn_changed', handleTurnChanged)
```

#### C. 状态模式 - 游戏流程
```typescript
// features/game-play/model/gameStateMachine.ts
type GameState = 'waiting' | 'dealing' | 'bidding' | 'playing' | 'finished'

const transitions = {
  waiting: ['dealing'],
  dealing: ['bidding'],
  bidding: ['playing'],
  playing: ['finished', 'playing'],
  finished: ['waiting'],
}

class GameStateMachine {
  transition(to: GameState) {
    if (!transitions[this.current].includes(to)) {
      throw new Error(`Invalid transition from ${this.current} to ${to}`)
    }
    this.current = to
    this.emit('stateChanged', to)
  }
}
```

#### D. 工厂模式 - 组件创建
```typescript
// entities/player/lib/factory.ts
interface PlayerProps {
  id: string
  position: 'left' | 'right' | 'bottom'
  // ...
}

export function createPlayer(props: PlayerProps) {
  return {
    ...props,
    avatar: getDefaultAvatar(props.id),
    score: 0,
    cards: [],
    isReady: false,
  }
}
```

### 3. 性能优化策略

#### A. 代码分割
```typescript
// app/router/routes.tsx
const GameRoomPage = lazy(() => import('@/pages/game-room'))
const LobbyPage = lazy(() => import('@/pages/lobby'))

<Suspense fallback={<LoadingScreen />}>
  <Routes>
    <Route path="/room/:id" element={<GameRoomPage />} />
    <Route path="/" element={<LobbyPage />} />
  </Routes>
</Suspense>
```

#### B. 组件优化
```typescript
// widgets/game-board/ui/GameBoard.tsx
const GameBoard = memo(({ players, cards, currentTurn }) => {
  // 使用useMemo缓存昂贵计算
  const sortedCards = useMemo(
    () => sortCards(cards),
    [cards]
  )
  
  // 使用useCallback稳定函数引用
  const handlePlayCard = useCallback(
    (card: string) => {
      dispatch(playCard(card))
    },
    [dispatch]
  )
  
  return <div>...</div>
})
```

#### C. 虚拟化长列表
```typescript
// widgets/chat-window/ui/ChatList.tsx
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={400}
  itemCount={messages.length}
  itemSize={50}
>
  {({ index, style }) => (
    <ChatMessage
      key={messages[index].id}
      message={messages[index]}
      style={style}
    />
  )}
</FixedSizeList>
```

### 4. 状态管理优化

#### A. Redux Toolkit切片划分
```typescript
// entities/player/model/store.ts
const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setPlayers,
    updatePlayer,
    removePlayer,
  },
})

// features/game-play/model/store.ts
const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    startGame,
    playCards,
    endGame,
  },
})

// app/store/index.ts
export const store = configureStore({
  reducer: {
    player: playerSlice.reducer,
    game: gameSlice.reducer,
    wallet: walletSlice.reducer,
  },
})
```

#### B. 自定义Hooks封装
```typescript
// features/game-play/model/hooks.ts
export function useGamePlay() {
  const dispatch = useDispatch()
  const game = useSelector(selectGame)
  
  const playCards = useCallback((cards: string[]) => {
    dispatch(playCardsAction(cards))
  }, [dispatch])
  
  const pass = useCallback(() => {
    dispatch(passAction())
  }, [dispatch])
  
  return { game, playCards, pass }
}

// 使用
const { game, playCards, pass } = useGamePlay()
```

### 5. 类型系统增强

#### A. 共享类型定义
```typescript
// shared/types/domain.ts
export interface Player {
  id: string
  name: string
  avatar: string
  position: PlayerPosition
  cards: Card[]
  score: number
  isReady: boolean
  isLandlord: boolean
}

export interface Card {
  id: string
  rank: CardRank
  suit: CardSuit
  isSelected: boolean
}

export type PlayerPosition = 'left' | 'right' | 'bottom'
export type CardRank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'JOKER' | 'joker'
export type CardSuit = '♠' | '♥' | '♦' | '♣' | ''
```

#### B. API类型
```typescript
// features/game-play/api/types.ts
export interface PlayCardsRequest {
  roomId: string
  userId: string
  cards: string[]
}

export interface PlayCardsResponse {
  success: boolean
  cardType: CardPattern
  nextPlayer: string
}
```

## 🔄 迁移计划

### 阶段1: 准备（1天）
- [ ] 创建新目录结构
- [ ] 设置路径别名
- [ ] 更新构建配置

### 阶段2: 共享层迁移（2天）
- [ ] 迁移shared/ui组件
- [ ] 迁移shared/lib工具
- [ ] 迁移shared/api

### 阶段3: 实体层迁移（2天）
- [ ] 创建Player实体
- [ ] 创建Card实体
- [ ] 创建Room实体

### 阶段4: 功能层迁移（3天）
- [ ] 拆分game-play功能
- [ ] 拆分bidding功能
- [ ] 拆分wallet功能

### 阶段5: 组合层迁移（2天）
- [ ] 创建game-board widget
- [ ] 创建player-panel widget
- [ ] 创建chat-window widget

### 阶段6: 页面层重构（2天）
- [ ] 简化GameRoomPage
- [ ] 重构其他页面

### 阶段7: 测试与优化（2天）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化

**总计**: 约14天完成完整迁移

## 📚 学习资源

- [Feature-Sliced Design](https://feature-sliced.design/)
- [React设计模式](https://www.patterns.dev/posts/react-patterns)
- [Redux Toolkit最佳实践](https://redux-toolkit.js.org/usage/usage-guide)
- [TypeScript深入](https://www.typescriptlang.org/docs/handbook/intro.html)

## 🎯 预期收益

### 代码质量
- ⬆️ 可维护性: 从⭐⭐提升到⭐⭐⭐⭐⭐
- ⬆️ 可测试性: 从0%提升到80%+
- ⬇️ 代码重复: 减少50%+
- ⬇️ Bug密度: 减少70%+

### 开发效率
- ⬆️ 新功能开发: 提速2-3倍
- ⬆️ Bug修复: 提速3-5倍
- ⬆️ 代码审查: 提速2倍
- ⬇️ 上手时间: 减少50%

### 团队协作
- ⬆️ 并行开发: 支持4-6人同时开发
- ⬇️ 冲突率: 减少80%
- ⬆️ 代码复用: 提升60%
- ⬆️ 知识传递: 提升80%

---

**建议**: 考虑分阶段实施，先完成当前GameRoom的模块化，再推广到整个项目。
