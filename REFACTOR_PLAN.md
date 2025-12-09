# Frontend 重构计划 - v1.7.0

## 重构目标
将臃肿的组件拆分成小型、可维护的模块，提高代码可读性和可维护性。

## 当前问题分析

### GameRoom/index.tsx (3157 行)
**问题**：单文件包含所有逻辑，难以维护和修改

**包含内容**：
1. **状态管理** (30+ useState, useRef)
   - 游戏状态、玩家信息
   - UI 状态（聊天、结算、定时器等）
   - 动画状态
   - AI 提示相关状态

2. **Socket 事件处理** (50+ 事件监听)
   - 房间事件（join、leave、ready）
   - 游戏流程事件（deal_cards、bidding、turn_to_play）
   - 出牌事件（cards_played、player_passed、game_over）
   - AI 提示事件

3. **业务逻辑函数** (40+ 函数)
   - 出牌逻辑（doPlayCards、handlePass）
   - AI 提示处理
   - 自动出牌/整手出牌
   - 定时器管理
   - 音效控制

4. **UI 渲染**
   - 玩家区域（3个玩家位置）
   - 游戏控制区（出牌、提示、设置）
   - 聊天系统
   - 结算界面
   - 抢地主界面
   - 调试面板

## 重构策略

### Phase 1: 准备工作 ✅
- [x] 创建重构分支 `refactor/frontend-v1.7.0`
- [x] 分析现有代码结构
- [ ] 创建重构目录结构

### Phase 2: 提取自定义 Hooks
**目标**: 将复杂的状态逻辑和副作用提取到可复用的 hooks

#### 2.1 Socket 事件管理
- `useGameSocket.ts` - 统一管理所有 Socket 事件监听
  - 房间事件组
  - 游戏流程事件组
  - 出牌事件组
  - AI 事件组

#### 2.2 游戏状态管理
- `useGameState.ts` - 游戏核心状态管理
  - 玩家状态
  - 回合状态
  - 出牌状态
  
- `useGameTimers.ts` - 定时器管理
  - 抢地主倒计时
  - 出牌倒计时
  - 自动准备倒计时

#### 2.3 UI 状态管理
- `useGameUI.ts` - UI 相关状态
  - 聊天可见性
  - 结算显示
  - 动画状态

#### 2.4 游戏操作
- `useGameActions.ts` - 游戏操作逻辑
  - 出牌逻辑封装
  - 不出/跟牌逻辑
  - 准备/离开房间

### Phase 3: 拆分 UI 组件
**目标**: 将单一巨型组件拆分成职责明确的小组件

#### 3.1 玩家相关组件
```
GameRoom/components/
├── PlayerArea/
│   ├── PlayerInfo.tsx          # 单个玩家信息
│   ├── PlayerCards.tsx         # 玩家手牌显示
│   ├── PlayerRole.tsx          # 角色标识（地主/农民）
│   └── index.tsx
```

#### 3.2 游戏控制组件
```
├── GameControls/
│   ├── CardSelector.tsx        # 手牌选择区
│   ├── ActionButtons.tsx       # 出牌/不出/提示按钮
│   ├── BiddingControls.tsx    # 抢地主控制
│   └── index.tsx
```

#### 3.3 信息展示组件
```
├── GameInfo/
│   ├── Settlement.tsx          # 结算界面
│   ├── LastPlayedCards.tsx    # 上家出牌显示
│   ├── LandlordCards.tsx      # 地主底牌显示
│   └── index.tsx
```

#### 3.4 辅助功能组件
```
├── ChatPanel/
│   ├── ChatMessages.tsx        # 聊天消息列表
│   ├── ChatInput.tsx           # 聊天输入框
│   └── index.tsx
├── DebugPanel/                 # 调试面板
├── SettingsPanel/              # 设置面板
└── AIHintPanel/                # AI 提示面板
```

### Phase 4: 提取业务逻辑模块
**目标**: 将纯业务逻辑提取到独立的服务模块

```
src/services/game/
├── cardPlayService.ts          # 出牌逻辑
├── aiHintService.ts            # AI 提示服务
├── gameFlowService.ts          # 游戏流程控制
└── soundService.ts             # 音效服务（已存在，需整合）
```

### Phase 5: 优化工具函数
**目标**: 整合和优化现有工具函数

```
src/utils/game/
├── cardHelper.ts               # 卡牌工具函数
├── playerHelper.ts             # 玩家相关工具
├── animationHelper.ts          # 动画辅助函数
└── index.ts
```

### Phase 6: 类型定义优化
**目标**: 统一和完善类型定义

```
src/types/game/
├── player.ts                   # 玩家相关类型
├── card.ts                     # 卡牌相关类型
├── gameState.ts                # 游戏状态类型
├── socket.ts                   # Socket 事件类型
└── index.ts
```

## 重构原则

1. **渐进式重构**: 一次重构一个模块，确保每步都可运行
2. **保持功能完整**: 重构过程中不改变任何业务逻辑
3. **测试驱动**: 每个模块重构后立即测试
4. **代码审查**: 每个 Phase 完成后提交，方便回滚
5. **文档同步**: 及时更新文档和注释

## 成功标准

- [ ] GameRoom/index.tsx 缩减到 < 500 行
- [ ] 每个新组件 < 200 行
- [ ] 每个 hook < 150 行
- [ ] 类型定义完整且准确
- [ ] 所有原有功能正常运行
- [ ] 代码可读性和可维护性显著提升

## 风险控制

1. **分支策略**: 在独立分支进行，不影响主分支
2. **增量提交**: 每完成一个小模块就提交
3. **回归测试**: 重构后完整测试所有游戏流程
4. **性能监控**: 确保重构不影响性能

## 时间规划

- Phase 1: 准备工作 (0.5h)
- Phase 2: 提取 Hooks (2-3h)
- Phase 3: 拆分组件 (3-4h)
- Phase 4: 提取业务逻辑 (1-2h)
- Phase 5: 优化工具函数 (1h)
- Phase 6: 类型定义 (1h)
- 测试和调试 (2-3h)

**总计**: 约 10-14 小时

---

## 当前进度

### Phase 1: 准备工作 ✅
- ✅ Phase 1.1: 创建重构分支 `refactor/frontend-v1.7.0`
- ✅ Phase 1.2: 创建重构计划文档
- ✅ Phase 1.3: 创建目录结构
  - `src/pages/GameRoom/hooks/` - 自定义 Hooks
  - `src/pages/GameRoom/components/` - UI 组件
  - `src/types/game/` - 类型定义

### Phase 2: 提取自定义 Hooks ✅
- ✅ Phase 2.1: 创建类型定义 `src/types/game/index.ts`
  - 定义了 Player, CardPattern, ChatMessage 等核心类型
  - 定义了完整的 SocketEventData 接口
- ✅ Phase 2.2: 创建 `useGameSocket.ts` Hook
  - 统一管理所有 Socket 事件监听（20+ 事件）
  - 提供 Socket 操作方法（ready, unready, playCards, pass, bid, chat等）
  - ✅ 已修复所有类型错误
- ✅ Phase 2.3: 创建 `useGameTimer.ts` Hook
  - 管理抢地主倒计时、出牌倒计时
  - 管理自动准备、自动重玩定时器
  - 提供统一的定时器清理方法
- ✅ Phase 2.4: 创建 `useGameUI.ts` Hook
  - 管理聊天、结算、抢地主等 UI 状态
  - 管理动画状态（发牌、出牌）
  - 管理拖拽选牌、不出标记等交互状态
- ✅ Phase 2.5: 创建 Hooks 索引文件 `hooks/index.ts`

### 已解决问题 ✅
1. ✅ **类型兼容性**: 使用 `globalSocket.getSocket()` 获取真实 Socket 实例
2. ✅ **音效方法**: 统一使用 `soundManager.playSound()` 和现有方法
3. ✅ **Redux Action 参数**: 补充了 playerName 等必需字段

### 当前成果

#### 核心 Hooks 模块
```
src/pages/GameRoom/hooks/
├── useGameSocket.ts     (427 行) - Socket 事件管理
├── useGameTimer.ts      (219 行) - 定时器管理
├── useGameUI.ts         (207 行) - UI 状态管理
└── index.ts             (8 行)   - 统一导出
```

#### 共享 UI 组件（可跨游戏复用）
```
src/shared/components/
├── ChatPanel/
│   ├── index.tsx        (90 行)  - 聊天面板
│   └── style.css        (165 行)
├── PlayerArea/
│   ├── index.tsx        (135 行) - 玩家信息区
│   └── style.css        (284 行)
└── index.ts             (11 行)  - 统一导出
```

#### 斗地主特定组件
```
src/games/doudizhu/components/
├── BiddingControls/
│   ├── index.tsx        (44 行)  - 抢地主控制
│   └── style.css        (141 行)
└── index.ts             (6 行)   - 统一导出
```

**总计：已提取约 1300+ 行代码**

### Phase 3 完成情况 ✅
- ✅ ChatPanel - 聊天面板（共享）
- ✅ PlayerArea - 玩家信息区（共享）
- ✅ BiddingControls - 抢地主控制（斗地主特定）

### 下一步计划
1. Phase 4: 简化 GameRoom/index.tsx 主文件
   - 使用新的 Hooks 替换原有逻辑
   - 使用新组件替换内联 JSX
   - 目标：主文件缩减到 < 500 行（当前3157行）
2. Phase 5: 测试重构后的功能完整性
