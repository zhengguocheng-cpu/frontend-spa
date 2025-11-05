# 叫地主逻辑修复

## 🐛 问题

1. **叫地主方式不对**：原来使用 1,2,3 分，现在改为 frontend 方式（叫/不叫）
2. **轮流叫地主不工作**：玩家1 叫了地主后，其他玩家没有显示叫地主按钮和倒计时

## ✅ 解决方案

### 1. 修改叫地主参数：从分数改为 boolean

**修改前**：
```typescript
// 使用分数
handleBid(1) // 叫 1 分
handleBid(0) // 不叫
```

**修改后**：
```typescript
// 使用 boolean
handleBid(true)  // 抢地主
handleBid(false) // 不抢
```

### 2. 处理 `bid_result` 事件中的 `nextBidderId`

**关键逻辑**（照抄 frontend）：

```typescript
const handleBidResult = (data: any) => {
  // 1. 显示叫地主结果
  const bidText = data.bid ? '抢' : '不抢'
  Toast.show({ content: `${data.userName} 选择：${bidText}` })
  
  // 2. 隐藏当前玩家的叫地主按钮
  setShowBiddingUI(false)
  clearInterval(biddingTimerRef.current)
  
  // 3. 如果有下一个玩家，延迟后显示叫地主按钮
  if (data.nextBidderId) {
    setTimeout(() => {
      if (data.nextBidderId === user.id) {
        // 轮到我了！
        setShowBiddingUI(true)
        setBiddingTimer(15)
        // 开始倒计时...
      }
    }, 1000) // 1秒延迟
  }
}
```

### 3. 使用 `useRef` 管理倒计时定时器

```typescript
const biddingTimerRef = useRef<NodeJS.Timeout | null>(null)

// 清理定时器
if (biddingTimerRef.current) {
  clearInterval(biddingTimerRef.current)
  biddingTimerRef.current = null
}
```

## 📝 修改内容

### 1. 导入 `useRef`
```typescript
import { useEffect, useState, useRef } from 'react'
```

### 2. 添加 `biddingTimerRef`
```typescript
const biddingTimerRef = useRef<NodeJS.Timeout | null>(null)
```

### 3. 修改 `handleBid` 函数
```typescript
const handleBid = (bid: boolean) => {
  // 隐藏 UI
  setShowBiddingUI(false)
  if (biddingTimerRef.current) {
    clearInterval(biddingTimerRef.current)
    biddingTimerRef.current = null
  }
  
  // 发送到服务器
  socket.emit('bid', {
    roomId,
    userId: user.id || user.name,
    bid: bid, // true = 抢，false = 不抢
  })
  
  const bidText = bid ? '抢地主' : '不抢'
  Toast.show({ content: `您选择：${bidText}` })
}
```

### 4. 修改 `handleBidResult` 函数
```typescript
const handleBidResult = (data: any) => {
  // 显示结果
  const bidText = data.bid ? '抢' : '不抢'
  Toast.show({ content: `${data.userName} 选择：${bidText}` })
  
  // 隐藏当前 UI
  setShowBiddingUI(false)
  if (biddingTimerRef.current) {
    clearInterval(biddingTimerRef.current)
    biddingTimerRef.current = null
  }
  
  // 处理下一个玩家
  if (data.nextBidderId) {
    setTimeout(() => {
      if (data.nextBidderId === (user?.id || user?.name)) {
        // 轮到我了
        setShowBiddingUI(true)
        setBiddingTimer(15)
        
        // 开始倒计时
        biddingTimerRef.current = setInterval(() => {
          setBiddingTimer(prev => {
            if (prev <= 1) {
              clearInterval(biddingTimerRef.current!)
              biddingTimerRef.current = null
              handleBid(false) // 自动不抢
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }, 1000)
  }
}
```

### 5. 修改按钮调用
```typescript
// 抢地主按钮
<Button onClick={() => handleBid(true)}>抢地主</Button>

// 不抢按钮
<Button onClick={() => handleBid(false)}>不抢</Button>
```

## 🔄 完整流程

### 1. 第一个玩家叫地主
```
1. 收到 bidding_start 事件
2. 显示叫地主 UI
3. 开始 15 秒倒计时
4. 玩家点击"抢地主"或"不抢"
5. 发送 bid 事件到服务器
```

### 2. 其他玩家收到结果
```
1. 收到 bid_result 事件
2. 显示"玩家X 选择：抢/不抢"
3. 检查 nextBidderId
4. 如果是自己，1秒后显示叫地主 UI
5. 开始新的 15 秒倒计时
```

### 3. 所有玩家叫完
```
1. 收到 bid_result 事件，nextBidderId 为 null
2. 收到 landlord_determined 事件
3. 显示地主和底牌
```

## 🎯 关键点

### 1. `nextBidderId` 是关键
- 后端在 `bid_result` 中发送 `nextBidderId`
- 前端根据 `nextBidderId` 判断是否轮到自己
- 如果 `nextBidderId === null`，说明叫地主结束

### 2. 使用 `useRef` 而不是 `useState`
- 定时器需要在多个函数中访问和清理
- `useRef` 不会触发重新渲染
- 可以在清理函数中访问最新值

### 3. 延迟 1 秒显示
- 给玩家时间看到上一个玩家的选择
- 避免 UI 切换太快

### 4. 自动不抢
- 倒计时结束后自动调用 `handleBid(false)`
- 确保游戏继续进行

## 📊 数据格式

### `bidding_start` 事件
```typescript
{
  firstBidderName: string,  // 第一个叫地主的玩家
  firstBidderId: string     // 第一个叫地主的玩家 ID
}
```

### `bid` 事件（发送）
```typescript
{
  roomId: string,
  userId: string,
  bid: boolean  // true = 抢，false = 不抢
}
```

### `bid_result` 事件（接收）
```typescript
{
  userId: string,
  userName: string,
  bid: boolean,           // true = 抢，false = 不抢
  nextBidderId: string | null  // 下一个叫地主的玩家 ID
}
```

### `landlord_determined` 事件
```typescript
{
  landlordId: string,
  landlordName: string,
  bottomCards: string[]  // 底牌
}
```

## ✅ 测试清单

- [ ] 第一个玩家能看到叫地主 UI
- [ ] 第一个玩家叫地主后，第二个玩家能看到 UI
- [ ] 第二个玩家叫地主后，第三个玩家能看到 UI
- [ ] 倒计时正常工作（15 秒）
- [ ] 倒计时结束自动选择"不抢"
- [ ] 所有玩家叫完后，显示地主和底牌
- [ ] 按钮文字正确："抢地主" 和 "不抢"
- [ ] Toast 提示正确："XXX 选择：抢/不抢"

## 🎉 完成

现在叫地主逻辑应该完全正常了！每个玩家都能轮流叫地主，倒计时正常工作。

---

**参考文件**：
- `frontend/public/room/js/room-simple.js` 第 754-890 行
- `backend/src/services/socket/GameFlowHandler.ts` 第 200-222 行
