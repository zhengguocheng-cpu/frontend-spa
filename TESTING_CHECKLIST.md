# Phase 4.2.1 重构功能测试清单

## 🎯 测试目标

验证 **useGameUI Hook** 替换后，所有游戏功能是否正常运行。

## 📋 测试清单

### 1. 基础功能测试

#### 1.1 进入房间 ✓
- [ ] 成功进入游戏房间
- [ ] 玩家信息正确显示
- [ ] Socket 连接成功
- [ ] 没有控制台错误

#### 1.2 聊天功能 ⭐ 重点
**涉及的重构**：`addChatMessage`, `updateChatInput`, `clearChatInput`

- [ ] 打开聊天面板（点击聊天按钮）
- [ ] 输入聊天内容
- [ ] 发送聊天消息
- [ ] 接收其他玩家的聊天消息
- [ ] 系统消息正确显示（如"玩家加入"）
- [ ] Enter 键发送消息
- [ ] 发送后输入框自动清空

**测试方法**：
1. 打开聊天
2. 输入 "测试消息"
3. 按 Enter 或点击"发送"
4. 检查消息是否显示在聊天列表中

---

### 2. 游戏流程测试

#### 2.1 准备阶段
- [ ] 点击"准备"按钮
- [ ] 准备状态正确显示
- [ ] 三名玩家准备后自动开始游戏

#### 2.2 发牌阶段 ⭐ 重点
**涉及的重构**：`startDealingAnimation`, `stopDealingAnimation`

- [ ] 发牌动画正常播放
- [ ] 手牌正确显示
- [ ] 发牌动画结束后可以操作手牌
- [ ] 系统消息："发牌完成，进入抢地主阶段"

**注意**：检查是否有 `setIsDealingAnimation is not defined` 错误

#### 2.3 抢地主阶段 ⭐ 重点
**涉及的重构**：`openBiddingUI`, `closeBiddingUI`

- [ ] 抢地主 UI 正确显示
- [ ] 倒计时正常运行
- [ ] 点击"抢地主"按钮
- [ ] UI 正确关闭
- [ ] 系统消息显示抢地主结果
- [ ] 地主确定后，UI 正确关闭
- [ ] 地主标识（金色边框 + 👑）正确显示

**测试方法**：
1. 等待轮到自己抢地主
2. 观察 UI 是否正确显示
3. 点击"抢地主"或"不抢"
4. 检查 UI 是否正确关闭

#### 2.4 出牌阶段 ⭐ 重点
**涉及的重构**：`setTurnState`, `clearAllPassedPlayers`

- [ ] 轮到自己时，系统消息："轮到你出牌了"
- [ ] 可以选择手牌
- [ ] 点击"出牌"按钮成功出牌
- [ ] 点击"不出"按钮（如果允许）
- [ ] 出牌后，"不出"标记正确清除
- [ ] 轮到其他玩家时，显示："轮到 XXX 出牌..."
- [ ] 出牌倒计时正常运行

**测试方法**：
1. 等待轮到自己
2. 选择几张牌
3. 点击"出牌"
4. 观察是否正常出牌

#### 2.5 拖拽选牌 ⭐ 重点
**涉及的重构**：`startDragSelect`, `stopDragSelect`

- [ ] 按住鼠标拖拽可以批量选牌
- [ ] 拖拽选中的牌正确高亮
- [ ] 拖拽取消选中的牌正确恢复
- [ ] 松开鼠标后拖拽状态正确清除

**测试方法**：
1. 按住鼠标在手牌区域拖动
2. 观察牌的选中状态变化
3. 松开鼠标
4. 检查是否有 `setIsDragSelecting is not defined` 错误

#### 2.6 游戏结束 ⭐ 重点
**涉及的重构**：`openSettlement`, `closeSettlement`

- [ ] 游戏结束后，结算面板自动显示
- [ ] 结算信息正确显示（获胜方、积分等）
- [ ] 系统消息："本局结束：XXX（地主/农民）获胜"
- [ ] 点击"再来一局"按钮
- [ ] 结算面板正确关闭
- [ ] 点击"返回大厅"按钮
- [ ] 正确返回大厅

**测试方法**：
1. 等待游戏结束
2. 观察结算面板是否自动显示
3. 点击"再来一局"或"返回大厅"

---

### 3. 特殊场景测试

#### 3.1 断线重连
**涉及的重构**：`openBiddingUI`, `closeBiddingUI`

- [ ] 刷新页面（模拟断线重连）
- [ ] 游戏状态正确恢复
- [ ] 如果在抢地主阶段，UI 正确显示/隐藏
- [ ] 如果轮到自己，倒计时正确恢复

#### 3.2 快速流程
- [ ] 快速准备 → 发牌 → 抢地主 → 出牌
- [ ] 没有 UI 状态错乱
- [ ] 没有控制台错误

#### 3.3 多局游戏
- [ ] 完成第一局游戏
- [ ] 点击"再来一局"
- [ ] 第二局游戏流程正常
- [ ] UI 状态正确重置

---

## 🐛 已知问题检查

根据之前的 lint 错误，重点检查：

### ❌ 可能的错误点

1. **setIsDealingAnimation is not defined** (Line 1016)
   - ✅ 已修复：改为 `startDealingAnimation()` / `stopDealingAnimation()`
   - 测试：观察发牌动画

2. **setShowBiddingUI is not defined** 
   - ✅ 已修复：改为 `openBiddingUI()` / `closeBiddingUI()`
   - 测试：观察抢地主 UI

3. **setShowSettlement is not defined**
   - ✅ 已修复：改为 `openSettlement()` / `closeSettlement()`
   - 测试：观察结算面板

4. **setIsMyTurn / setCanPass is not defined**
   - ✅ 已修复：改为 `setTurnState(isMyTurn, canPass)`
   - 测试：观察出牌流程

5. **setIsDragSelecting / setDragSelectMode is not defined**
   - ✅ 已修复：改为 `startDragSelect()` / `stopDragSelect()`
   - 测试：拖拽选牌

---

## 📊 测试结果记录

### 控制台检查

打开浏览器开发者工具（F12），检查：

#### 预期正常的日志
```
[GameRoom] 初始化游戏房间
[Socket] 连接成功
[Player] player_joined 事件
[Game] game_started 事件
[Bidding] bidding_start 事件
[Turn] turn_to_play 事件
```

#### ❌ 不应出现的错误
```
❌ setShowBiddingUI is not defined
❌ setIsDealingAnimation is not defined
❌ setShowSettlement is not defined
❌ setIsMyTurn is not defined
❌ setIsDragSelecting is not defined
❌ addChatMessage is not defined
```

---

## ✅ 测试通过标准

### 必须满足：
1. ✅ 没有任何 JavaScript 错误
2. ✅ 所有 UI 状态正确显示/隐藏
3. ✅ 聊天功能完全正常
4. ✅ 抢地主 UI 正确显示和关闭
5. ✅ 结算面板正确显示和关闭
6. ✅ 拖拽选牌功能正常
7. ✅ 完整游戏流程可以正常进行

### 加分项：
- ✅ 性能无明显下降
- ✅ 动画流畅
- ✅ UI 响应迅速

---

## 🚨 如果发现问题

### 问题报告格式：

```
### 问题描述
[简要描述问题]

### 复现步骤
1. 步骤1
2. 步骤2
3. 步骤3

### 预期行为
[应该发生什么]

### 实际行为
[实际发生了什么]

### 控制台错误
[粘贴错误信息]

### 截图
[如果有的话]
```

---

## 📝 测试建议

### 测试顺序（推荐）

1. **快速验证**（5分钟）
   - 进入房间
   - 打开聊天，发送消息
   - 准备游戏
   - 观察抢地主 UI

2. **完整流程**（10-15分钟）
   - 完整进行一局游戏
   - 测试所有按钮和交互
   - 检查控制台错误

3. **压力测试**（5分钟）
   - 快速点击各种按钮
   - 刷新页面测试重连
   - 连续进行多局游戏

---

## 🎉 测试完成后

如果测试通过，可以继续：
- ✅ Phase 4.2.2: 替换 ChatPanel 组件
- ✅ Phase 4.2.3: 替换定时器逻辑
- ✅ Phase 4.2.4: 替换 BiddingControls 组件

如果发现问题，需要：
- ❌ 记录问题详情
- ❌ 修复错误
- ❌ 重新测试

---

**开始测试时间**：_________

**测试完成时间**：_________

**测试结果**：□ 通过 □ 失败

**备注**：
