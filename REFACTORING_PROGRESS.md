# GameRoom 重构进度文档

## 📋 重构策略

由于 `GameRoom/index.tsx` 文件过大（3157行），我们采用**渐进式重构策略**：

### 方案A：框架重构（激进）
创建全新的简化版本 `index.refactored.tsx`，从零开始使用新 Hooks 和组件。

**优点**：
- 代码结构清晰，从 3157行 → 约 500行
- 充分利用所有新模块
- 易于理解和维护

**缺点**：
- 需要大量时间完成
- 迁移过程中可能引入 Bug
- 需要完整的功能测试

**当前状态**：已创建框架版本 ✅

### 方案B：渐进式重构（稳健）⭐ 推荐
在原文件基础上，逐步替换功能模块。

**优点**：
- 风险低，每次改动可测试
- 可以随时回退
- 逐步积累改进

**缺点**：
- 重构周期较长
- 需要多次提交

## 🎯 当前进度

### Phase 4.1: 准备阶段 ✅
- ✅ 备份原始文件 `index.backup.tsx`
- ✅ 创建框架版本 `index.refactored.tsx`（约400行）
- ✅ 验证新 Hooks 和组件可用性

### Phase 4.2: 渐进式迁移计划

#### 步骤 1: 替换简单的 UI 状态（低风险）
```typescript
// 原代码
const [chatVisible, setChatVisible] = useState(false)
const [chatMessage, setChatMessage] = useState('')
const [chatMessages, setChatMessages] = useState([])

// 重构后
const { chatVisible, chatMessage, chatMessages, toggleChat, updateChatInput, addChatMessage } = useGameUI()
```

**预期收益**：减少 50+ 行

#### 步骤 2: 替换 ChatPanel 组件（低风险）
```typescript
// 原代码（约60行）
<aside className={`chat-sidebar ${chatVisible ? 'visible' : 'hidden'}`}>
  {/* 聊天UI代码 */}
</aside>

// 重构后（1行）
<ChatPanel visible={chatVisible} messages={chatMessages} ... />
```

**预期收益**：减少 60+ 行

#### 步骤 3: 替换定时器逻辑（中风险）
```typescript
// 原代码（约80行）
const [biddingTimer, setBiddingTimer] = useState(0)
const biddingTimerRef = useRef<NodeJS.Timeout | null>(null)
// ... 定时器设置和清理代码

// 重构后（1行）
const { biddingTimer, startBiddingTimer, stopBiddingTimer } = useGameTimer()
```

**预期收益**：减少 80+ 行

#### 步骤 4: 替换 BiddingControls 组件（低风险）
```typescript
// 原代码（约30行）
{gameStatus === 'bidding' && showBiddingUI && (
  <div className="bidding-actions">
    {/* 抢地主UI代码 */}
  </div>
)}

// 重构后（1行）
<BiddingControls visible={showBiddingUI} timer={biddingTimer} onBid={handleBid} />
```

**预期收益**：减少 30+ 行

#### 步骤 5: 部分替换 Socket 事件监听（高风险）
Socket 事件处理非常复杂，建议**分批迁移**：

第一批（低耦合事件）：
- `message_received` → useGameSocket
- `player_joined/left` → useGameSocket

第二批（中等耦合）：
- 抢地主相关事件
- 定时器相关事件

第三批（高耦合）：
- 出牌事件
- 游戏状态恢复

**预期收益**：减少 200+ 行，但需谨慎测试

#### 步骤 6: 替换 PlayerArea 组件（中风险）
左右两家玩家信息展示使用新组件。

**预期收益**：减少 150+ 行

## 📊 预期成果

| 步骤 | 减少行数 | 风险等级 | 测试难度 |
|------|----------|----------|----------|
| 步骤 1 | ~50 | 低 | 简单 |
| 步骤 2 | ~60 | 低 | 简单 |
| 步骤 3 | ~80 | 中 | 中等 |
| 步骤 4 | ~30 | 低 | 简单 |
| 步骤 5 | ~200 | 高 | 复杂 |
| 步骤 6 | ~150 | 中 | 中等 |
| **总计** | **~570** | - | - |

**重构后预计**：3157行 → 约 2600行（第一轮）→ 约 1500行（完全重构）

## 🚀 推荐实施计划

### 本次会话（Phase 4.2）
1. ✅ 步骤 1: 替换简单 UI 状态
2. ✅ 步骤 2: 替换 ChatPanel 组件
3. ✅ 步骤 3: 替换定时器逻辑
4. ✅ 步骤 4: 替换 BiddingControls 组件

**预期**：3157行 → 约 2950行，减少约 200行

### 下次会话（Phase 4.3）
5. 部分替换 Socket 事件（第一批）
6. 替换 PlayerArea 组件

**预期**：2950行 → 约 2500行

### 后续会话（Phase 4.4+）
7. 继续替换 Socket 事件（第二、三批）
8. 提取手牌显示组件
9. 提取结算界面组件
10. 最终整理和优化

**最终目标**：< 1500行（减少 50%+）

## ⚠️ 注意事项

1. **每步都要测试**：确保游戏功能正常
2. **频繁提交**：每完成一个步骤就提交，方便回滚
3. **保留备份**：`index.backup.tsx` 作为安全网
4. **逐步推进**：不要试图一次性完成所有重构

## 📝 测试检查清单

每次重构后需要测试：

- [ ] 进入房间正常
- [ ] 玩家准备功能
- [ ] 发牌功能
- [ ] 抢地主流程
- [ ] 出牌功能
- [ ] 不出功能
- [ ] 游戏结算
- [ ] 聊天功能
- [ ] 再来一局
- [ ] 离开房间

## 🎯 下一步行动

**建议先执行低风险的步骤 1-4**，预计可减少 200+ 行代码，且不影响核心功能。

是否继续执行渐进式重构的步骤 1-4？
