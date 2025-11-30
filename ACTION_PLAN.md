# 行动计划 - 按照 SPA_MIGRATION_PLAN.md 继续

## 📋 当前状态

### ✅ 已完成
1. **基础架构** (100%)
   - ✅ Socket 全局管理器
   - ✅ 用户认证系统
   - ✅ 路由配置
   - ✅ 登录页面
   - ✅ 路由守卫

2. **房间列表页** (60%)
   - ✅ 基础 UI
   - ✅ 获取房间列表
   - ✅ 加入房间
   - ⏳ 创建房间（待完善）
   - ⏳ 实时更新（待完善）

3. **游戏房间页** (40%)
   - ✅ 基础 UI 布局
   - ✅ 玩家位置显示（逆时针排列）
   - ✅ 准备功能
   - ✅ 重连功能
   - ✅ 字段转换（ready → isReady）
   - ⏳ 发牌逻辑（待调试）
   - ❌ 叫地主功能
   - ❌ 出牌功能
   - ❌ 游戏结算

### ⚠️ 当前问题
- **三个玩家准备后未发牌**
  - 原因：后端 `togglePlayerReady` 使用切换逻辑
  - 解决方案：已记录在 `BACKEND_MODIFICATION_PLAN.md`
  - 调试步骤：已记录在 `CURRENT_ISSUE_DEBUG.md`

---

## 🎯 立即行动（今天）

### 1. 调试发牌问题 ⏰ 30分钟

**步骤**:
1. 打开 3 个浏览器标签页
2. 分别登录 3 个用户
3. 都进入同一房间
4. 打开所有控制台
5. 依次点击准备
6. 查看前端和后端日志
7. 确认问题根源

**预期结果**:
- 找到为什么 `全部准备=false`
- 确认是否需要修改后端

**如果需要修改后端**:
- 按照 `BACKEND_MODIFICATION_PLAN.md` 修改
- 只修改 1 行代码：`player.ready = true`
- 重启后端测试

---

### 2. 完成游戏房间核心事件监听 ⏰ 1小时

**参考**: `frontend/public/room/js/room-simple.js` 第 210-228 行

**需要确保监听的事件**:

#### 已监听 ✅
- [x] `join_game_success` - 加入游戏成功
- [x] `game_state_restored` - 恢复游戏状态
- [x] `player_joined` - 玩家加入
- [x] `player_left` - 玩家离开
- [x] `player_ready` - 玩家准备
- [x] `game_started` - 游戏开始
- [x] `cards_dealt` - 发牌
- [x] `bidding_start` - 开始叫地主
- [x] `bid_result` - 叫地主结果
- [x] `landlord_determined` - 地主确定
- [x] `game_state_updated` - 游戏状态更新
- [x] `turn_to_play` - 轮到出牌
- [x] `cards_played` - 出牌
- [x] `player_passed` - 玩家不出
- [x] `game_ended` - 游戏结束

#### 待添加 ⏳
- [ ] `deal_cards_all` - 房间广播发牌（frontend 有，spa 没有）
- [ ] `turn_changed` - 回合改变
- [ ] `new_round_started` - 新回合开始
- [ ] `game_over` - 游戏结束（另一个事件）
- [ ] `message_received` - 聊天消息

**行动**:
```typescript
// 在 GameRoom/index.tsx 中添加缺失的事件监听
socket.on('deal_cards_all', handleDealCardsAll)
socket.on('turn_changed', handleTurnChanged)
socket.on('new_round_started', handleNewRoundStarted)
socket.on('game_over', handleGameOver)
socket.on('message_received', handleMessageReceived)
```

---

### 3. 实现发牌逻辑 ⏰ 1小时

**参考**: `frontend/public/room/js/room-simple.js` 第 690-730 行

**需要实现**:

#### handleDealCardsAll（房间广播版本）
```typescript
const handleDealCardsAll = (data: any) => {
  console.log('🎯 [发牌事件-广播] 收到数据:', data)
  
  // 找到当前玩家的牌
  const myCards = data.players.find((p: any) => 
    p.playerId === user?.id || p.playerId === user?.name
  )
  
  if (myCards && myCards.cards && myCards.cards.length > 0) {
    // 更新手牌
    dispatch(startGame({ myCards: myCards.cards }))
    
    // 更新所有玩家的牌数
    if (data.players) {
      const players = data.players.map((p: any) => ({
        ...p,
        cardCount: p.cards?.length || 0,
        isReady: true
      }))
      dispatch(updatePlayers(players))
    }
    
    Toast.show({ content: '发牌完成，开始叫地主', icon: 'success' })
  }
}
```

#### handleCardsDealt（个人发牌版本）
```typescript
const handleCardsDealt = (data: any) => {
  console.log('🎴 收到手牌:', data)
  
  if (data.cards) {
    dispatch(startGame({ myCards: data.cards }))
    Toast.show({ content: '发牌完成，开始叫地主', icon: 'success' })
  }
}
```

**行动**:
1. 在 GameRoom/index.tsx 中实现这两个函数
2. 参考 frontend 的逻辑，不要自己发挥
3. 测试发牌功能

---

### 4. 实现叫地主逻辑 ⏰ 1.5小时

**参考**: `frontend/public/room/js/room-simple.js` 第 732-820 行

**需要实现**:

#### UI 组件
```typescript
// 叫地主按钮区域
{gameState.gameStatus === 'bidding' && gameState.isMyTurn && (
  <div className="bidding-actions">
    <Button onClick={() => handleBid(0)}>不叫</Button>
    <Button onClick={() => handleBid(1)}>1分</Button>
    <Button onClick={() => handleBid(2)}>2分</Button>
    <Button onClick={() => handleBid(3)}>3分</Button>
  </div>
)}
```

#### 事件处理
```typescript
// 开始叫地主
const handleBiddingStart = (data: any) => {
  console.log('🎯 开始叫地主:', data)
  // 更新游戏状态为叫地主阶段
  // 显示叫地主按钮
}

// 叫地主结果
const handleBidResult = (data: any) => {
  console.log('📢 叫地主结果:', data)
  // 显示谁叫了几分
  // 更新当前回合
}

// 地主确定
const handleLandlordDetermined = (data: any) => {
  console.log('👑 地主确定:', data)
  // 设置地主
  // 显示底牌
  // 开始出牌阶段
}

// 发送叫地主
const handleBid = (bidValue: number) => {
  socket.emit('bid', {
    roomId,
    userId: user.id,
    bidValue
  })
}
```

**行动**:
1. 实现叫地主 UI
2. 实现事件处理函数
3. 参考 frontend 的逻辑
4. 测试叫地主流程

---

## 📅 本周计划

### 今天（2025-11-03）
- [x] 调试发牌问题
- [ ] 添加缺失的事件监听
- [ ] 实现发牌逻辑
- [ ] 实现叫地主逻辑

### 明天（2025-11-04）
- [ ] 实现出牌逻辑
- [ ] 实现牌型判断
- [ ] 实现提示功能
- [ ] 测试完整游戏流程

### 后天（2025-11-05）
- [ ] 实现游戏结算
- [ ] 实现聊天功能
- [ ] 移动端适配优化
- [ ] 完整测试

---

## 🎯 Phase 2 完成标准

### 功能完整性
- [ ] 三个玩家可以完整玩一局游戏
- [ ] 准备 → 发牌 → 叫地主 → 出牌 → 结算
- [ ] 所有游戏规则正确
- [ ] 断线重连正常

### 用户体验
- [ ] 操作流畅，无卡顿
- [ ] 提示信息清晰
- [ ] 移动端触摸友好
- [ ] 动画效果自然

### 代码质量
- [ ] 严格参考 frontend 逻辑
- [ ] 不自己发挥
- [ ] TypeScript 类型完整
- [ ] 注释清晰

---

## 📚 参考文件清单

### Frontend (MPA) - 只读参考
- `frontend/public/room/js/room-simple.js` - **核心逻辑**（必读）
- `frontend/public/room/js/game-logic.js` - 游戏规则
- `frontend/public/room/js/ui-manager.js` - UI 管理
- `frontend/public/room/js/card-utils.js` - 扑克牌工具

### Frontend-SPA - 需要修改
- `src/pages/GameRoom/index.tsx` - 游戏房间主文件
- `src/store/slices/gameSlice.ts` - 游戏状态管理
- `src/pages/GameRoom/style.css` - 样式文件

---

## ⚠️ 重要原则

### 1. 严格参考 frontend
```
✅ DO: 查看 frontend 代码，理解逻辑，复制到 spa
❌ DON'T: 自己想象功能，自己发挥
```

### 2. 不修改后端
```
✅ DO: 记录需要修改的地方到 BACKEND_MODIFICATION_PLAN.md
❌ DON'T: 直接修改后端代码
```

### 3. 保持功能一致
```
✅ DO: 游戏规则、操作流程与 frontend 完全一致
❌ DON'T: 改变游戏规则或流程
```

### 4. 渐进式开发
```
✅ DO: 一个功能一个功能实现，充分测试
❌ DON'T: 一次性实现所有功能
```

---

## 🚀 开始行动

### 第一步：调试发牌问题
```bash
# 1. 启动后端
cd backend
npm run dev:watch

# 2. 启动前端
cd frontend-spa
npm run dev

# 3. 打开 3 个浏览器标签页测试
```

### 第二步：查看日志
- 前端控制台
- 后端终端
- 确认问题根源

### 第三步：修复问题
- 如果是后端问题：修改 1 行代码
- 如果是前端问题：继续调试

### 第四步：继续迁移
- 按照本文档的计划
- 一步一步实现
- 参考 frontend 代码

---

**准备好了吗？让我们开始吧！** 🎮
