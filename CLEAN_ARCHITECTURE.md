# GameRoom 清晰架构设计

## 🎯 设计原则

1. **单一职责原则** - 每个模块只负责一个功能
2. **开闭原则** - 对扩展开放，对修改封闭
3. **依赖倒置** - 依赖抽象，不依赖具体实现
4. **接口清晰** - 每个模块的输入输出明确
5. **易于测试** - 每个模块可独立测试

---

## 📐 分层架构

```
┌─────────────────────────────────────────┐
│         GameRoom/index.tsx              │  ← 协调层（300-400行）
│  - 组装各个模块                          │
│  - 渲染 UI 结构                          │
│  - 最小业务逻辑                          │
└─────────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────────┐
│           Hooks 层                       │
├─────────────────────────────────────────┤
│ useGameUI       - UI 状态管理            │
│ useGameTimer    - 定时器管理             │
│ useGameSocket   - Socket 连接            │
│ useGameEvents   - 事件协调器 ⭐          │
└─────────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────────┐
│         事件处理层                        │
├─────────────────────────────────────────┤
│ Room Events    - 房间相关事件            │
│ Bidding Events - 抢地主事件             │
│ Play Events    - 出牌事件                │
│ Chat Events    - 聊天事件                │
└─────────────────────────────────────────┘
              ↓ 更新
┌─────────────────────────────────────────┐
│         状态管理层                        │
├─────────────────────────────────────────┤
│ Redux Store    - 全局游戏状态            │
│ Local State    - 组件本地状态            │
└─────────────────────────────────────────┘
              ↓ 驱动
┌─────────────────────────────────────────┐
│         UI 组件层                         │
├─────────────────────────────────────────┤
│ SettlementPanel - 结算面板               │
│ PlayerDisplay   - 玩家信息               │
│ HandCards       - 手牌显示               │
│ GameActions     - 游戏按钮               │
│ ChatPanel       - 聊天面板 ✅            │
│ BiddingControls - 抢地主按钮 ✅          │
└─────────────────────────────────────────┘
```

---

## 📁 文件结构（每个文件 ≤ 500 行）

```
src/pages/GameRoom/
├── index.tsx                    (300-400行) 主协调器
│
├── hooks/                       状态管理层
│   ├── index.ts                 
│   ├── useGameUI.ts             (178行) ✅ UI状态
│   ├── useGameTimer.ts          (195行) ✅ 定时器
│   ├── useGameSocket.ts         (381行) ✅ Socket连接
│   └── useGameEvents.ts         (100行) 事件协调器
│
├── events/                      事件处理层 ⭐ 核心改进
│   ├── index.ts
│   ├── roomEvents.ts            (~150行) 房间事件
│   ├── biddingEvents.ts         (~200行) 抢地主事件
│   ├── playEvents.ts            (~250行) 出牌事件
│   └── chatEvents.ts            (~50行)  聊天事件
│
├── components/                  UI组件层
│   ├── index.ts
│   ├── SettlementPanel/         (87行) ✅ 结算面板
│   ├── PlayerDisplay/           (~150行) 玩家信息
│   ├── HandCards/               (~200行) 手牌区域
│   └── GameActions/             (~100行) 游戏按钮
│
├── logic/                       业务逻辑层
│   ├── cardOperations.ts        (~200行) 出牌逻辑
│   ├── gameFlow.ts              (~150行) 游戏流程
│   └── helpers.ts               (~100行) 辅助函数
│
└── styles/                      样式文件
    ├── index.css
    ├── game.css
    └── ai-panel.css
```

---

## 🔄 数据流

### 1. Socket 事件 → 状态更新

```typescript
Socket Event
  ↓
events/playEvents.ts              // 处理事件
  ↓
dispatch(Redux Action)            // 更新状态
  ↓
Component Re-render               // UI 自动更新
```

### 2. 用户操作 → 业务逻辑

```typescript
User Click
  ↓
logic/cardOperations.ts           // 业务逻辑
  ↓
socket.emit(...)                  // 发送事件
  ↓
Backend Processing
```

---

## 🎨 组件设计原则

### 1. Props 接口清晰

```typescript
// ❌ 不好的设计
interface MyComponentProps {
  data: any
  handlers: any
}

// ✅ 好的设计
interface MyComponentProps {
  visible: boolean
  playerName: string
  score: number
  onConfirm: () => void
  onCancel: () => void
}
```

### 2. 单向数据流

```typescript
// ✅ 组件只接收数据和回调
function MyComponent({ data, onAction }) {
  // 不直接修改外部状态
  // 通过回调通知父组件
  return <button onClick={onAction}>Action</button>
}
```

### 3. 容器组件 vs 展示组件

```typescript
// 容器组件（逻辑）
function PlayerContainer() {
  const player = useSelector(selectPlayer)
  const dispatch = useDispatch()
  
  return <PlayerDisplay 
    player={player} 
    onAction={() => dispatch(action())} 
  />
}

// 展示组件（纯 UI）
function PlayerDisplay({ player, onAction }) {
  return <div>{player.name}</div>
}
```

---

## 📦 模块职责

### index.tsx（主协调器）
**职责**：
- 组装所有模块
- 定义整体 UI 结构
- 最小化业务逻辑

**不做**：
- ❌ 处理复杂事件逻辑
- ❌ 直接操作 DOM
- ❌ 包含大量计算逻辑

### events/ （事件处理层）
**职责**：
- 监听 Socket 事件
- 解析事件数据
- 触发 Redux actions

**示例**：
```typescript
// events/playEvents.ts
export function usePlayEvents(props) {
  const { socket, dispatch } = props
  
  useEffect(() => {
    const handleCardsPlayed = (data) => {
      // 1. 播放音效
      soundManager.playCardSound(data.cardType)
      
      // 2. 更新状态
      dispatch(playCardsAction(data))
      
      // 3. 系统提示
      addMessage(`${data.playerName} 出牌`)
    }
    
    socket.on('cards_played', handleCardsPlayed)
    return () => socket.off('cards_played', handleCardsPlayed)
  }, [socket, dispatch])
}
```

### logic/ （业务逻辑层）
**职责**：
- 纯函数逻辑
- 可独立测试
- 无副作用

**示例**：
```typescript
// logic/cardOperations.ts
export function validatePlayCards(
  selectedCards: string[],
  lastCards: string[] | null
): { valid: boolean; error?: string } {
  // 纯逻辑，易于测试
  if (selectedCards.length === 0) {
    return { valid: false, error: '请选择要出的牌' }
  }
  // ...
  return { valid: true }
}
```

---

## ✅ 重构检查清单

### 代码质量
- [ ] 每个文件 ≤ 500 行
- [ ] 每个函数 ≤ 50 行
- [ ] 单一职责原则
- [ ] 接口清晰明确

### 可维护性
- [ ] 有意义的命名
- [ ] 适当的注释
- [ ] 清晰的文件结构
- [ ] 合理的模块划分

### 可扩展性
- [ ] 易于添加新功能
- [ ] 易于修改现有功能
- [ ] 依赖关系简单
- [ ] 模块间低耦合

### 可测试性
- [ ] 可单元测试
- [ ] 可集成测试
- [ ] Mock 友好
- [ ] 副作用隔离

---

## 🚀 重构步骤

### Phase 1: 事件处理层分离 ⭐ 最重要
1. 创建 events/ 目录
2. 提取所有 Socket 事件处理
3. 每个事件文件 ≤ 250 行

**收益**：减少 ~500 行，大幅提升可维护性

### Phase 2: UI 组件提取
1. 创建独立组件
2. 明确 Props 接口
3. 每个组件 ≤ 200 行

**收益**：减少 ~400 行，提升复用性

### Phase 3: 业务逻辑分离
1. 提取纯函数逻辑
2. 创建 logic/ 目录
3. 提升可测试性

**收益**：减少 ~300 行，易于测试

---

## 📝 最佳实践

### 1. 命名规范

```typescript
// Hooks
useGameUI, useGameEvents

// Components  
PlayerDisplay, HandCards

// Events
handleCardsPlayed, handleBidResult

// Logic
validateCards, calculateScore
```

### 2. 文件组织

```
- 相关文件放在一起
- index.ts 统一导出
- 每个目录职责单一
```

### 3. 依赖管理

```typescript
// ✅ 依赖注入
function MyComponent({ onAction }) {
  return <button onClick={onAction} />
}

// ❌ 硬编码依赖
function MyComponent() {
  const dispatch = useDispatch() // 耦合太强
}
```

---

## 🎯 最终目标

- ✅ **index.tsx**: 300-400 行（协调器）
- ✅ **所有文件**: ≤ 500 行
- ✅ **架构清晰**: 分层明确
- ✅ **易于维护**: 模块化
- ✅ **易于扩展**: 低耦合
- ✅ **易于测试**: 职责单一

---

**原则**：质量 > 数量，架构 > 行数
