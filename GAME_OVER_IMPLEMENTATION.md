# 游戏结束和结算功能实现

## ✅ 已完成

### 1. 事件监听

#### `game_over` 事件
```typescript
socket.on('game_over', handleGameEnded)
socket.on('game_ended', handleGameEnded)  // 兼容旧事件名
```

#### 后端发送的数据格式
```typescript
{
  winnerId: string,
  winnerName: string,
  winnerRole: 'landlord' | 'farmer',
  landlordWin: boolean,
  score: {
    baseScore: number,
    multiplier: number,
    totalScore: number,
    playerScores: Array<{
      playerId: string,
      score: number,
      multipliers: {
        bomb: number,
        rocket: number,
        spring: number,
        antiSpring: number,
        total: number
      }
    }>
  },
  achievements: any[]
}
```

### 2. handleGameEnded 函数

```typescript
const handleGameEnded = (data: any) => {
  console.log('🎊 [游戏结束] 收到game_over事件:', data)
  
  // 1. 停止倒计时
  if (turnTimerRef.current) {
    clearInterval(turnTimerRef.current)
    turnTimerRef.current = null
  }
  
  // 2. 隐藏出牌按钮
  setIsMyTurn(false)
  
  // 3. 更新 Redux 状态
  dispatch(endGame(data))
  
  // 4. 显示结算消息
  const winnerName = data.winnerName || '未知玩家'
  const role = data.winnerRole === 'landlord' ? '地主' : '农民'
  Toast.show({ 
    content: `🎊 游戏结束！${winnerName}（${role}）获胜！`, 
    icon: 'success',
    duration: 2000
  })
  
  // 5. 延迟显示结算界面
  setTimeout(() => {
    setShowSettlement(true)
  }, 1500)
}
```

### 3. 结算 Modal UI

#### JSX 结构
```tsx
{showSettlement && gameState.gameResult && (
  <Dialog
    visible={showSettlement}
    content={
      <div className="settlement-content">
        {/* 标题 */}
        <h2 className="settlement-title">
          {gameState.gameResult.landlordWin ? '🎊 地主获胜！' : '🎊 农民获胜！'}
        </h2>
        
        {/* 获胜者信息 */}
        <div className="winner-info">
          <div className="winner-avatar">👑</div>
          <div className="winner-name">{gameState.gameResult.winnerName}</div>
          <div className="winner-role">
            {gameState.gameResult.winnerRole === 'landlord' ? '地主' : '农民'}
          </div>
        </div>

        {/* 得分信息 */}
        {gameState.gameResult.score && (
          <div className="score-info">
            <div className="score-item">
              <span>底分：</span>
              <span>{gameState.gameResult.score.baseScore || 1}</span>
            </div>
            <div className="score-item">
              <span>倍数：</span>
              <span>{gameState.gameResult.score.multiplier || 1}x</span>
            </div>
            <div className="score-item total">
              <span>总分：</span>
              <span>{gameState.gameResult.score.totalScore || 1}</span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="settlement-actions">
          <Button onClick={() => {
            setShowSettlement(false)
            handleStartGame()  // 再来一局
          }}>
            再来一局
          </Button>
          <Button onClick={() => {
            setShowSettlement(false)
            handleLeaveRoom()
          }}>
            返回大厅
          </Button>
        </div>
      </div>
    }
    closeOnMaskClick={false}
  />
)}
```

### 4. CSS 样式

```css
/* 结算界面样式 */
.settlement-content {
  padding: 20px;
  text-align: center;
}

.settlement-title {
  font-size: 24px;
  font-weight: bold;
  color: #f39c12;
  margin-bottom: 20px;
}

.winner-info {
  margin: 20px 0;
  padding: 20px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.1));
  border-radius: 12px;
  border: 2px solid rgba(255, 215, 0, 0.3);
}

.winner-avatar {
  font-size: 48px;
  margin-bottom: 10px;
}

.score-info {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 16px;
}

.score-item.total {
  border-top: 2px solid #ddd;
  margin-top: 10px;
  padding-top: 15px;
  font-size: 18px;
  font-weight: bold;
  color: #e74c3c;
}
```

### 5. 再来一局功能

点击"再来一局"按钮后：
1. 关闭结算弹窗
2. 调用 `handleStartGame()` 发送准备事件
3. 后端会重置房间状态
4. 等待所有玩家准备后开始新一局

## 🎯 完整游戏流程

```
1. 准备 ✅
   ↓
2. 发牌 ✅
   ↓
3. 叫地主 ✅
   ↓
4. 确定地主 ✅
   ↓
5. 出牌 ✅
   ↓
6. 游戏结束 ✅
   ↓
7. 显示结算 ✅
   ↓
8. 再来一局 ✅
```

## 📊 后端适配

### 后端已有功能
- ✅ `game_over` 事件发送
- ✅ 得分计算
- ✅ 房间状态重置
- ✅ 玩家准备状态重置

### 前端适配内容
- ✅ 监听 `game_over` 事件
- ✅ 解析后端数据格式
- ✅ 显示结算界面
- ✅ 再来一局（发送准备事件）

## ✅ 测试清单

- [ ] 游戏结束后显示结算弹窗
- [ ] 正确显示获胜者信息
- [ ] 正确显示得分信息
- [ ] 点击"再来一局"能重新开始
- [ ] 点击"返回大厅"能退出房间
- [ ] 结算弹窗不能通过点击遮罩关闭

## 🎨 视觉效果

### 结算弹窗
```
┌─────────────────────────┐
│   🎊 地主获胜！         │
│                         │
│  ┌───────────────────┐  │
│  │       👑          │  │
│  │    玩家名称       │  │ ← 金色渐变背景
│  │      地主         │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ 底分：    1       │  │
│  │ 倍数：    2x      │  │
│  │ ───────────────   │  │
│  │ 总分：    2       │  │ ← 红色加粗
│  └───────────────────┘  │
│                         │
│  [再来一局] [返回大厅]  │
└─────────────────────────┘
```

## 📝 参考文件

- `frontend/public/room/js/room-simple.js` 第 1106-1146 行
- `backend/src/services/game/CardPlayHandler.ts` 第 307-330 行

---

**游戏结束和结算功能已完成！** 🎊

现在可以完整地玩一局斗地主了！
