# 游戏房间实现计划

## 🎯 目标
实现完整的斗地主游戏房间，支持横屏显示，复刻 frontend 的所有核心功能，去除冗余代码。

---

## 📋 Frontend 功能分析

### ✅ 核心功能（必须实现）

#### 1. 房间管理
- 加入房间
- 离开房间
- 显示房间信息
- 玩家列表管理

#### 2. 游戏流程
- **准备阶段**
  - 玩家准备/取消准备
  - 开始游戏按钮
  
- **发牌阶段**
  - 发牌动画
  - 显示手牌
  
- **叫地主阶段**
  - 抢地主/不抢按钮
  - 倒计时
  - 显示底牌
  
- **出牌阶段**
  - 选择手牌
  - 出牌/不出/提示按钮
  - 回合倒计时
  - 显示上家出牌
  
- **结算阶段**
  - 显示游戏结果
  - 显示得分
  - 返回大厅/再来一局

#### 3. UI 显示
- 三个玩家位置（上左、上右、底部）
- 玩家头像和信息
- 手牌显示和选择
- 桌面中央出牌区
- 底牌显示区

#### 4. 实时通信
- Socket 事件监听
- 游戏状态同步
- 玩家操作广播

---

### ❌ 冗余功能（可以简化或移除）

#### 1. 认证检查冗余
```javascript
// ❌ Frontend 中的冗余代码
if (window.userAuth && window.userAuth.authenticated) {
    // 复杂的认证检查
}
```
**SPA 方案**：使用 AuthContext 和 RequireAuth，不需要重复检查

#### 2. URL 参数传递
```javascript
// ❌ Frontend 使用 URL 参数传递用户信息
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('playerName');
```
**SPA 方案**：使用 React Router params 和 AuthContext

#### 3. 全局变量管理
```javascript
// ❌ Frontend 使用全局变量
window.GlobalSocketManager
window.userAuth
```
**SPA 方案**：使用 Redux 和 Context，不需要全局变量

#### 4. 重复的 Socket 连接逻辑
```javascript
// ❌ Frontend 每个页面都重新连接
this.connectToServer()
```
**SPA 方案**：使用全局 globalSocket，已经连接

---

## 🏗️ SPA 实现架构

### 1. 组件结构
```
GameRoom/
├── index.tsx           # 主组件
├── components/
│   ├── GameTable.tsx   # 游戏桌面
│   ├── PlayerHand.tsx  # 手牌区域
│   ├── PlayerInfo.tsx  # 玩家信息
│   ├── GameControls.tsx # 游戏控制按钮
│   ├── PlayedCards.tsx # 出牌显示
│   └── Settlement.tsx  # 结算弹窗
├── hooks/
│   ├── useGameRoom.ts  # 房间逻辑
│   └── useCardSelection.ts # 手牌选择
└── style.css           # 横屏样式
```

### 2. Redux State
使用已有的 `gameSlice.ts`：
```typescript
interface GameState {
  roomId: string
  players: GamePlayer[]
  currentPlayer: string
  landlord: string
  phase: 'waiting' | 'bidding' | 'playing' | 'ended'
  myCards: Card[]
  selectedCards: Card[]
  lastPlayedCards: PlayedCards
  bottomCards: Card[]
  // ...
}
```

### 3. Socket 事件
复用 `globalSocket`，监听：
- `room_joined` - 加入房间
- `player_joined` - 玩家加入
- `player_left` - 玩家离开
- `cards_dealt` - 发牌
- `game_state_updated` - 状态更新
- `turn_changed` - 回合变化
- `cards_played` - 出牌
- `game_ended` - 游戏结束

---

## 📱 横屏设计

### 1. CSS 媒体查询
```css
/* 强制横屏 */
@media screen and (orientation: portrait) {
  .game-room-container {
    transform: rotate(90deg);
    transform-origin: center center;
  }
}

/* 横屏布局 */
@media screen and (orientation: landscape) {
  .game-room-container {
    display: flex;
    flex-direction: row;
  }
}
```

### 2. 布局结构
```
┌─────────────────────────────────────┐
│  Header: 房间信息 | 退出按钮        │
├─────────────────────────────────────┤
│                                     │
│  ┌─────┐    游戏桌面    ┌─────┐   │
│  │玩家2│                │玩家3│   │
│  └─────┘                └─────┘   │
│                                     │
│         ┌─────────────┐            │
│         │  出牌区域   │            │
│         └─────────────┘            │
│                                     │
│  ┌─────────────────────────────┐  │
│  │      当前玩家手牌区域       │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  出牌 | 不出 | 提示 按钮    │  │
│  └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 🎨 UI 组件映射

### Frontend → SPA (antd-mobile)

| Frontend | SPA (antd-mobile) | 说明 |
|----------|-------------------|------|
| `<button class="btn">` | `<Button>` | 按钮 |
| `<div class="modal">` | `<Dialog>` | 弹窗 |
| `<div class="timer">` | `<CountDown>` | 倒计时 |
| `<div class="avatar">` | `<Avatar>` | 头像 |
| `<div class="card">` | `<Card>` | 卡片 |
| 原生 CSS 动画 | CSS + React Spring | 动画 |

---

## 🔄 核心流程

### 1. 进入房间
```typescript
// 从路由获取 roomId
const { roomId } = useParams()
const { user } = useAuth()

// 加入房间
useEffect(() => {
  globalSocket.joinGame({
    roomId,
    userId: user.id,
    playerName: user.name,
    playerAvatar: user.avatar
  })
}, [roomId, user])
```

### 2. 游戏流程
```
准备 → 发牌 → 叫地主 → 出牌 → 结算
  ↓      ↓       ↓       ↓       ↓
Redux  Redux   Redux   Redux   Redux
```

### 3. 离开房间
```typescript
const handleLeave = () => {
  globalSocket.leaveRoom(roomId)
  navigate('/rooms')
}
```

---

## 🎯 实现步骤

### Phase 1: 基础框架（30分钟）
1. 创建 GameRoom 组件
2. 实现路由和布局
3. 横屏 CSS 设置
4. 连接 Redux

### Phase 2: 房间管理（30分钟）
1. 加入/离开房间
2. 显示玩家列表
3. 准备/开始游戏

### Phase 3: 游戏逻辑（2小时）
1. 发牌显示
2. 叫地主
3. 出牌逻辑
4. 提示功能

### Phase 4: UI 优化（1小时）
1. 动画效果
2. 音效（可选）
3. 移动端适配

### Phase 5: 测试（30分钟）
1. 单人测试
2. 多人测试
3. 边界情况

---

## 📝 关键代码片段

### 1. 手牌选择
```typescript
const [selectedCards, setSelectedCards] = useState<string[]>([])

const handleCardClick = (cardId: string) => {
  setSelectedCards(prev => 
    prev.includes(cardId)
      ? prev.filter(id => id !== cardId)
      : [...prev, cardId]
  )
}
```

### 2. 出牌验证
```typescript
const handlePlayCards = () => {
  if (selectedCards.length === 0) {
    Toast.show('请选择要出的牌')
    return
  }
  
  globalSocket.playCards(roomId, selectedCards)
  setSelectedCards([])
}
```

### 3. Socket 监听
```typescript
useEffect(() => {
  const handleCardsDealt = (data) => {
    dispatch(setMyCards(data.cards))
  }
  
  globalSocket.on('cards_dealt', handleCardsDealt)
  
  return () => {
    globalSocket.off('cards_dealt', handleCardsDealt)
  }
}, [dispatch])
```

---

## ⚠️ 注意事项

### 1. 性能优化
- 使用 `React.memo` 优化组件
- 手牌使用虚拟滚动（如果超过20张）
- 动画使用 CSS transform

### 2. 状态同步
- 所有状态存储在 Redux
- Socket 事件更新 Redux
- 组件从 Redux 读取

### 3. 错误处理
- Socket 断线重连
- 游戏状态恢复
- 操作超时处理

### 4. 移动端适配
- 触摸事件优化
- 横屏提示
- 手势操作

---

## 🚀 开始实现

**准备好了吗？我现在开始创建游戏房间组件！**

预计完成时间：4-5 小时
核心功能优先，动画和音效可以后续添加。
