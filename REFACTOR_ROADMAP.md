# GameRoom 重构路线图

## 📊 当前状态

**文件**: `src/pages/GameRoom/index.tsx`
- **起始**: 2708 行
- **当前**: 2544 行  
- **已减少**: 164 行 (6.1%)
- **目标**: ≤ 500 行
- **还需减少**: 2044 行 (80.3%)

---

## ✅ 已完成工作

### Phase 4.2 - Hook 和基础组件
- ✅ useGameUI Hook (178行)
- ✅ useGameTimer Hook (195行)
- ✅ ChatPanel 组件（共享）
- ✅ BiddingControls 组件（游戏特定）

### Phase 5.1 - 快速组件化
- ✅ SettlementPanel 组件 (87行)
- ✅ GameActions 组件 (64行)
- ✅ AiHintPanel 组件 (136行)
- ✅ helpers 工具函数 (92行)

---

## 📋 剩余工作清单

### 🔴 优先级 P0（必须完成）

#### 1. 提取玩家显示组件（预计减少 ~300 行）⭐
**位置**: 行 ~800-1100  
**内容**: 左侧、右侧、底部玩家的显示逻辑

**提取方案**:
```typescript
// 创建 PlayerDisplay 组件
<PlayerDisplay
  position="left" | "right" | "bottom"
  player={playerData}
  isLandlord={boolean}
  cardsCount={number}
  lastPlayed={cards}
  turnTimer={number}
/>
```

**文件**:
- `components/PlayerDisplay/index.tsx`
- `components/PlayerDisplay/style.css`

---

#### 2. 提取手牌组件（预计减少 ~200 行）⭐
**位置**: 行 ~2400-2600  
**内容**: 手牌显示、选中、拖拽逻辑

**提取方案**:
```typescript
// 创建 HandCards 组件
<HandCards
  cards={myCards}
  selectedCards={selectedCards}
  isDragSelecting={boolean}
  onCardClick={handleCardClick}
  onDragSelect={handleDragSelect}
/>
```

**文件**:
- `components/HandCards/index.tsx`
- `components/HandCards/style.css`

---

#### 3. 提取底牌显示组件（预计减少 ~80 行）
**位置**: 行 ~2100-2180  
**内容**: 底牌显示逻辑

**提取方案**:
```typescript
<BottomCards
  visible={!hideBottomCards}
  cards={landlordCards}
/>
```

---

#### 4. 提取事件处理函数（预计减少 ~500 行）⭐⭐
**位置**: 行 ~700-1200  
**内容**: 所有 Socket 事件处理函数

**提取方案**:
```typescript
// 创建 events/handlers.ts
export function createEventHandlers({
  socket,
  dispatch,
  user,
  roomId
}) {
  return {
    handleRoomJoined: (data) => { ... },
    handlePlayerJoined: (data) => { ... },
    handleGameStarted: (data) => { ... },
    handleCardsPlayed: (data) => { ... },
    // ... 20+ 个处理函数
  }
}
```

**文件**:
- `events/handlers.ts` (~300行)
- `events/biddingHandlers.ts` (~150行)
- `events/playHandlers.ts` (~200行)

---

#### 5. 提取业务逻辑函数（预计减少 ~400 行）⭐
**位置**: 分散在整个文件  
**内容**: 出牌、提示、准备等业务逻辑

**提取方案**:
```typescript
// logic/cardOperations.ts
export function playCards(params) { ... }
export function getHint(params) { ... }
export function handlePass(params) { ... }

// logic/gameFlow.ts
export function startGame(params) { ... }
export function leaveRoom(params) { ... }
export function prepareGame(params) { ... }
```

**文件**:
- `logic/cardOperations.ts` (~250行)
- `logic/gameFlow.ts` (~150行)

---

### 🟡 优先级 P1（重要但不紧急）

#### 6. 整合 useEffect（预计减少 ~200 行）
**位置**: 分散在整个文件  
**内容**: 10+ 个 useEffect

**提取方案**:
```typescript
// hooks/useGameEffects.ts
export function useGameEffects(params) {
  // 整合所有副作用逻辑
  useAutoPlay()
  useAutoHint()
  useAutoReady()
  // ...
}
```

---

#### 7. 提取状态管理（预计减少 ~150 行）
**位置**: 行 ~50-200  
**内容**: 30+ 个 useState

**优化方案**:
```typescript
// 使用 useReducer 整合相关状态
const [gameUIState, dispatchUIAction] = useReducer(gameUIReducer, initialState)
```

---

### 🟢 优先级 P2（优化项）

#### 8. 应用设计模式

**状态模式**:
```typescript
// 管理游戏不同阶段的行为
class WaitingState implements GameState
class BiddingState implements GameState  
class PlayingState implements GameState
```

**命令模式**:
```typescript
// 封装用户操作
class PlayCardsCommand implements Command
class BidCommand implements Command
class PassCommand implements Command
```

---

## 📐 预期效果

### 完成所有 P0 项目后

| 项目 | 减少行数 |
|------|---------|
| PlayerDisplay | -300 |
| HandCards | -200 |
| BottomCards | -80 |
| Event Handlers | -500 |
| Business Logic | -400 |
| **总计** | **-1480** |

**预计结果**: 2544 - 1480 = **1064 行**

### 完成 P0 + P1 后

| 项目 | 减少行数 |
|------|---------|
| P0 总计 | -1480 |
| useEffect 整合 | -200 |
| 状态管理优化 | -150 |
| **总计** | **-1830** |

**预计结果**: 2544 - 1830 = **714 行**

### 完成全部后（包括设计模式重构）

**预计结果**: **400-500 行** ✅ 达标

---

## 🚀 执行计划

### 第一阶段（2-3小时）
1. ✅ PlayerDisplay 组件
2. ✅ HandCards 组件
3. ✅ BottomCards 组件

**预计减少**: ~580 行 → 降到 ~1960 行

### 第二阶段（2-3小时）
4. ✅ 提取事件处理函数
5. ✅ 提取业务逻辑函数

**预计减少**: ~900 行 → 降到 ~1060 行

### 第三阶段（1-2小时）
6. ✅ 整合 useEffect
7. ✅ 优化状态管理

**预计减少**: ~350 行 → 降到 ~710 行

### 第四阶段（1-2小时）
8. ✅ 应用设计模式
9. ✅ 最终优化

**预计减少**: ~210 行 → 降到 **500 行以内** ✅

---

## 📝 详细步骤

### Step 1: 提取 PlayerDisplay

**创建文件**: `components/PlayerDisplay/index.tsx`

**需要提取的代码段**:
- 左侧玩家显示区域
- 右侧玩家显示区域  
- 底部玩家显示区域
- 玩家信息（名称、金币、等级）
- 地主标识
- 上一手出牌显示
- 倒计时显示

**Props 设计**:
```typescript
interface PlayerDisplayProps {
  position: 'left' | 'right' | 'bottom'
  player: {
    id: string
    name: string
    level?: number
    coins?: number
    cardsCount: number
  }
  isLandlord: boolean
  landlordMultiplier?: number
  lastPlayed?: {
    cards: string[]
    pattern?: string
  }
  turnTimer?: number
  isPassed: boolean
}
```

---

### Step 2: 提取 HandCards

**创建文件**: `components/HandCards/index.tsx`

**需要提取的代码段**:
- 手牌渲染逻辑
- 卡牌选中效果
- 拖拽选牌逻辑
- 卡牌点击事件

**Props 设计**:
```typescript
interface HandCardsProps {
  cards: string[]
  selectedCards: string[]
  isDragSelecting: boolean
  dragSelectMode: 'select' | 'deselect' | null
  onCardClick: (card: string) => void
  onDragStart: (card: string) => void
  onDragOver: (card: string) => void
  onDragEnd: () => void
}
```

---

### Step 3: 提取事件处理函数

**创建文件**: `events/handlers.ts`

**提取函数列表**:
1. handleRoomJoined
2. handleJoinGameSuccess
3. handleGameStateRestored
4. handlePlayerJoined
5. handlePlayerLeft
6. handlePlayerReady
7. handleGameStarted
8. handleDealCardsAll
9. handleBiddingStart
10. handleBidResult
11. handleLandlordDetermined
12. handleGameStateUpdated
13. handleTurnToPlay
14. handleTurnChanged
15. handleCardsPlayed
16. handlePlayerPassed
17. handlePlayCardsFailed
18. handleGameEnded
19. handleChatMessage
20. handleConnect
21. handleDisconnect
22. handleHintResult

**组织方式**:
```typescript
// events/handlers.ts
export function createGameHandlers(deps) {
  const {
    socket,
    dispatch,
    user,
    roomId,
    gameUI,
    gameTimer,
    // ...
  } = deps

  return {
    room: createRoomHandlers(deps),
    bidding: createBiddingHandlers(deps),
    play: createPlayHandlers(deps),
    chat: createChatHandlers(deps)
  }
}
```

---

## ⚡ 快速开始

### 下次继续时的步骤

1. **打开文件**: `src/pages/GameRoom/index.tsx`
2. **查看路线图**: `REFACTOR_ROADMAP.md`
3. **从 Step 1 开始**: 提取 PlayerDisplay
4. **每完成一步**: 测试 + 提交
5. **监控行数**: 确保朝 500 行目标前进

---

## 🎯 成功标准

- ✅ `index.tsx` ≤ 500 行
- ✅ 所有文件 ≤ 500 行
- ✅ 功能完整无Bug
- ✅ 代码清晰易维护
- ✅ 架构清晰可扩展

---

**当前时间**: 2025-12-10 05:53 AM  
**已用时间**: ~2 小时  
**预计剩余时间**: 6-10 小时  
**建议**: 分多个session完成，避免疲劳

---

**下一步**: 从 PlayerDisplay 组件开始 ⭐
