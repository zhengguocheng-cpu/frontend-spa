# 激进重构计划 - 所有文件 ≤ 500 行

## 🎯 目标
1. 将 GameRoom/index.tsx 从 **2708 行** 降到 **≤ 500 行**
2. **所有新创建的文件** 都 **≤ 500 行**
3. 确保代码质量和可维护性

需要减少：**2200+ 行**

---

## 📊 当前文件结构分析

### 主要内容占比（估算）
1. **Socket 事件处理** - ~600 行
2. **JSX 渲染** - ~800 行  
3. **业务逻辑函数** - ~400 行
4. **useEffect 副作用** - ~300 行
5. **状态声明和 Hooks** - ~200 行
6. **工具函数** - ~200 行
7. **其他** - ~200 行

---

## 🔧 重构策略

### Phase 5.1: 提取所有 UI 组件 (减少 ~800 行)

#### 5.1.1 玩家区域组件 (减少 ~200 行)
- ✅ `PlayerArea` 组件已存在
- [ ] 在 GameRoom 中使用 PlayerArea
- [ ] 提取左侧玩家、右侧玩家、底部玩家的渲染逻辑

#### 5.1.2 手牌组件 (减少 ~150 行)
- [ ] 创建 `HandCards` 组件
- [ ] 提取手牌显示、选中、拖拽逻辑

#### 5.1.3 游戏控制组件 (减少 ~100 行)
- [ ] 创建 `GameControls` 组件
- [ ] 提取出牌/提示/不出按钮

#### 5.1.4 结算面板组件 (减少 ~200 行)
- [ ] 创建 `SettlementPanel` 组件
- [ ] 提取整个结算 UI

#### 5.1.5 底牌显示组件 (减少 ~50 行)
- [ ] 创建 `BottomCards` 组件
- [ ] 提取底牌显示逻辑

#### 5.1.6 AI 提示面板组件 (减少 ~100 行)
- [ ] 创建 `AiHintPanel` 组件
- [ ] 提取 AI 出牌记录侧边栏

---

### Phase 5.2: 拆分 Socket 事件处理 (减少 ~600 行)

#### 5.2.1 创建事件处理模块
```
src/pages/GameRoom/events/
├── index.ts
├── roomEvents.ts      (房间相关事件)
├── biddingEvents.ts   (抢地主事件)
├── playingEvents.ts   (出牌事件)
└── chatEvents.ts      (聊天事件)
```

- [ ] `roomEvents.ts` - room_joined, player_joined, player_left 等
- [ ] `biddingEvents.ts` - bidding_start, bid_result, landlord_determined
- [ ] `playingEvents.ts` - turn_to_play, cards_played, player_passed, game_ended
- [ ] `chatEvents.ts` - message_received

---

### Phase 5.3: 提取业务逻辑 (减少 ~400 行)

#### 5.3.1 创建业务逻辑模块
```
src/pages/GameRoom/logic/
├── index.ts
├── cardLogic.ts       (出牌相关逻辑)
├── biddingLogic.ts    (抢地主逻辑)
└── gameFlowLogic.ts   (游戏流程逻辑)
```

- [ ] `cardLogic.ts` - doPlayCards, handlePass, handleHint 等
- [ ] `biddingLogic.ts` - handleBid
- [ ] `gameFlowLogic.ts` - handleStartGame, handleLeaveRoom 等

---

### Phase 5.4: 整合 useEffect (减少 ~200 行)

#### 5.4.1 创建自定义 Hooks
```
src/pages/GameRoom/hooks/
├── useGameEffects.ts     (整合所有 useEffect)
├── useAutoPlay.ts        (自动出牌相关)
├── useWalletScore.ts     (积分管理)
└── useAutoReplay.ts      (自动再来一局)
```

---

### Phase 5.5: 工具函数模块化 (减少 ~150 行)

```
src/pages/GameRoom/utils/
├── index.ts
├── debugLogger.ts        (调试日志)
├── playerHelper.ts       (玩家辅助函数)
└── cardHelper.ts         (卡牌辅助函数)
```

---

## 📐 最终结构

### 目标文件结构
```
src/pages/GameRoom/
├── index.tsx                    (~500 行) ⭐ 主文件
├── hooks/
│   ├── index.ts
│   ├── useGameUI.ts            (已完成)
│   ├── useGameTimer.ts         (已完成)
│   ├── useGameSocket.ts        (已完成)
│   ├── useGameEffects.ts       (新增)
│   ├── useAutoPlay.ts          (新增)
│   ├── useWalletScore.ts       (新增)
│   └── useAutoReplay.ts        (新增)
├── events/
│   ├── index.ts
│   ├── roomEvents.ts           (新增)
│   ├── biddingEvents.ts        (新增)
│   ├── playingEvents.ts        (新增)
│   └── chatEvents.ts           (新增)
├── logic/
│   ├── index.ts
│   ├── cardLogic.ts            (新增)
│   ├── biddingLogic.ts         (新增)
│   └── gameFlowLogic.ts        (新增)
├── components/
│   ├── HandCards/              (新增)
│   ├── GameControls/           (新增)
│   ├── SettlementPanel/        (新增)
│   ├── BottomCards/            (新增)
│   └── AiHintPanel/            (新增)
├── utils/
│   ├── index.ts
│   ├── debugLogger.ts          (新增)
│   ├── playerHelper.ts         (新增)
│   └── cardHelper.ts           (新增)
├── style.css
├── game.css
└── ai-panel.css
```

### index.tsx 最终内容（~500 行）
```typescript
// 1. 导入 (50 行)
// 2. 使用 Hooks (50 行)
// 3. 简化的事件绑定 (50 行)
// 4. 核心渲染逻辑 (350 行)
```

---

## 🚀 执行顺序

### 阶段 1: 快速见效（先做这些）
1. ✅ 提取 PlayerArea 使用
2. ✅ 提取 SettlementPanel
3. ✅ 提取 HandCards
4. ✅ 提取 GameControls

**预计减少**: ~650 行

### 阶段 2: 深度重构
5. ✅ 拆分 Socket 事件处理
6. ✅ 提取业务逻辑

**预计减少**: ~1000 行

### 阶段 3: 最终优化
7. ✅ 整合 useEffect
8. ✅ 提取工具函数

**预计减少**: ~350 行

---

## ⏱️ 预计时间

- 阶段 1: 30-40 分钟
- 阶段 2: 40-50 分钟  
- 阶段 3: 20-30 分钟

**总计**: 90-120 分钟

---

## 🎯 成功标准

1. ✅ GameRoom/index.tsx < 500 行
2. ✅ 所有功能正常运行
3. ✅ 代码结构清晰
4. ✅ 易于维护和扩展

---

**开始时间**: 2025-12-10 05:35 AM  
**目标完成时间**: 2025-12-10 07:30 AM
