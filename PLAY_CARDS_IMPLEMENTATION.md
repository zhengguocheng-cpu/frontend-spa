# 出牌逻辑实现总结

## ✅ 已完成功能

### 1. 出牌按钮 UI
- ✅ 提示按钮
- ✅ 出牌按钮
- ✅ 不出按钮（根据 canPass 动态显示）
- ✅ 只在轮到自己时显示

### 2. 回合倒计时
- ✅ 30 秒倒计时
- ✅ 红色数字，脉冲动画
- ✅ 倒计时结束自动不出
- ✅ 使用 `useRef` 管理定时器

### 3. 事件监听

#### `turn_to_play` 事件
```typescript
const handleTurnToPlay = (data: any) => {
  if (data.playerId === user.id) {
    // 轮到我出牌
    setIsMyTurn(true)
    
    // 判断是否可以不出
    const canPassNow = !data.isFirstPlay && lastPlayedCards !== null
    setCanPass(canPassNow)
    
    // 开始 30 秒倒计时
    setTurnTimer(30)
    // ...
  } else {
    // 不是我的回合
    setIsMyTurn(false)
  }
}
```

#### `cards_played` 事件
```typescript
const handleCardsPlayed = (data: any) => {
  // 更新 Redux 状态
  dispatch(playCardsAction({
    playerId: data.playerId,
    playerName: data.playerName,
    cards: data.cards,
    type: data.cardType,
  }))
  
  // 停止倒计时
  clearInterval(turnTimerRef.current)
  
  // 显示出牌消息
  Toast.show({ content: `${data.playerName} 出了 ${cardTypeDesc}` })
}
```

#### `player_passed` 事件
```typescript
const handlePlayerPassed = (data: any) => {
  dispatch(passAction(data.playerId))
  Toast.show({ content: `${data.playerName} 不出` })
}
```

### 4. 上家出牌显示
- ✅ 桌面中央显示
- ✅ 使用 `parseCard` 解析卡牌
- ✅ 显示红/黑花色和 JOKER
- ✅ 卡牌重叠显示
- ✅ 玩家名称标签

## 📋 待实现功能

### 1. 出牌和不出功能（最重要）

需要实现 `handlePlayCards` 和 `handlePass` 函数：

```typescript
// 出牌
const handlePlayCards = () => {
  const socket = globalSocket.getSocket()
  if (!socket || !roomId || !user) return
  
  if (selectedCards.length === 0) {
    Toast.show({ content: '请选择要出的牌', icon: 'fail' })
    return
  }
  
  // 发送出牌请求
  socket.emit('play_cards', {
    roomId,
    userId: user.id,
    cards: selectedCards
  })
  
  console.log('🎴 发送出牌:', selectedCards)
}

// 不出
const handlePass = () => {
  const socket = globalSocket.getSocket()
  if (!socket || !roomId || !user) return
  
  // 发送不出请求
  socket.emit('pass', {
    roomId,
    userId: user.id
  })
  
  console.log('⏭️ 发送不出')
}
```

### 2. 提示功能（可选）

```typescript
const handleHint = () => {
  // TODO: 实现提示逻辑
  // 可以调用后端接口获取提示
  // 或者在前端实现简单的牌型检测
  Toast.show({ content: '提示功能开发中', icon: 'fail' })
}
```

### 3. 牌型检测（可选）

可以在前端实现简单的牌型检测，或者完全依赖后端验证。

### 4. 游戏结束和结算

需要监听 `game_over` 事件并显示结算界面。

## 🎯 下一步行动

1. **实现 `handlePlayCards` 和 `handlePass`** ✅ 最重要
2. 测试出牌流程
3. 实现游戏结束和结算
4. 添加提示功能（可选）
5. 优化动画效果

## 📝 关键代码位置

### 状态管理
```typescript
// 出牌相关状态
const [isMyTurn, setIsMyTurn] = useState(false)
const [canPass, setCanPass] = useState(false)
const [turnTimer, setTurnTimer] = useState(0)
const turnTimerRef = useRef<NodeJS.Timeout | null>(null)
```

### 事件监听
```typescript
socket.on('turn_to_play', handleTurnToPlay)
socket.on('cards_played', handleCardsPlayed)
socket.on('player_passed', handlePlayerPassed)
```

### UI 组件
```tsx
{gameStatus === 'playing' && isMyTurn && (
  <div className="game-actions">
    {turnTimer > 0 && <div className="turn-timer">⏰ {turnTimer}秒</div>}
    <div className="game-buttons">
      <Button onClick={handleHint}>提示</Button>
      <Button onClick={handlePlayCards}>出牌</Button>
      {canPass && <Button onClick={handlePass}>不出</Button>}
    </div>
  </div>
)}
```

## 🎨 样式文件

### `game.css`
- `.game-actions` - 出牌按钮容器
- `.turn-timer` - 倒计时样式
- `.game-buttons` - 按钮组
- `.played-cards-area` - 上家出牌区域
- `.played-cards-container` - 出牌卡牌容器

## 🔧 参考文件

- `frontend/public/room/js/room-simple.js` 第 948-1100 行
- `frontend/public/room/css/room.css` 出牌相关样式
- `backend/src/services/socket/CardPlayHandler.ts` 后端出牌逻辑

## ✨ 完成后的效果

1. ✅ 轮到自己时显示出牌按钮
2. ✅ 30 秒倒计时，红色脉冲动画
3. ✅ 可以选择手牌
4. ✅ 点击"出牌"发送到服务器
5. ✅ 点击"不出"跳过回合
6. ✅ 上家出的牌显示在桌面中央
7. ✅ 倒计时结束自动不出

---

**现在需要实现 `handlePlayCards` 和 `handlePass` 函数！** 🚀
