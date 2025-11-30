# 断线重连设计方案

## 🎯 需求分析

### 场景描述

**当前行为**（修复后）：
```
用户在房间 A01 刷新
  ↓
跳转到登录页
  ↓
用户输入相同名字登录
  ↓
跳转到房间列表
  ❌ 无法恢复到原房间
```

**期望行为**：
```
用户在房间 A01 刷新
  ↓
跳转到登录页
  ↓
用户输入相同名字登录
  ↓
检测到该用户在房间 A01
  ↓
自动恢复到房间 A01
  ✅ 恢复游戏状态
  ✅ 通知其他玩家（玩家重新连接）
```

---

## 🏗️ 技术方案

### 方案 1: 后端保存房间状态（推荐）

#### 后端改动

**1. 保存玩家的房间信息**

```typescript
// backend/src/services/user/userManager.ts
interface Player {
  id: string
  name: string
  currentRoomId?: string  // 添加：当前所在房间
  lastActiveTime?: Date   // 添加：最后活跃时间
  // ...
}
```

**2. 断线时不立即移除玩家**

```typescript
// 玩家断线时，标记为离线但保留房间信息
onDisconnect(socket) {
  const player = this.findPlayer(socket.userId)
  if (player) {
    player.isOnline = false
    player.lastActiveTime = new Date()
    // 不立即从房间移除，给予重连时间（如 30 秒）
  }
}
```

**3. 重连时恢复状态**

```typescript
// 玩家重新连接时
onReconnect(socket, userId) {
  const player = this.findPlayer(userId)
  if (player && player.currentRoomId) {
    // 检查是否在重连时间窗口内（如 30 秒）
    const timeSinceDisconnect = Date.now() - player.lastActiveTime
    if (timeSinceDisconnect < 30000) {
      // 恢复到原房间
      player.isOnline = true
      socket.emit('reconnect_success', {
        roomId: player.currentRoomId,
        gameState: this.getRoomState(player.currentRoomId)
      })
      // 通知其他玩家
      this.broadcastToRoom(player.currentRoomId, 'player_reconnected', {
        playerId: player.id,
        playerName: player.name
      })
    } else {
      // 超时，清除房间信息
      player.currentRoomId = null
    }
  }
}
```

#### 前端改动

**1. 监听重连事件**

```typescript
// src/pages/Login/index.tsx
const handleSubmit = async () => {
  const authUser = await login({
    userName: username.trim(),
    playerAvatar: avatar,
    htmlName: 'login',
  })
  
  // 登录成功后，检查是否有待恢复的房间
  const socket = globalSocket.getSocket()
  
  // 等待服务器响应
  socket.once('reconnect_success', (data) => {
    console.log('🔄 检测到断线重连，恢复到房间:', data.roomId)
    Toast.show({ content: '正在恢复游戏...', icon: 'loading' })
    
    // 恢复游戏状态
    dispatch(restoreGameState(data.gameState))
    
    // 跳转到房间
    navigate(`/game/${data.roomId}`, { replace: true })
  })
  
  // 如果 1 秒内没有收到重连响应，跳转到房间列表
  setTimeout(() => {
    socket.off('reconnect_success')
    navigate('/rooms', { replace: true })
  }, 1000)
}
```

**2. 处理重连通知**

```typescript
// src/pages/GameRoom/index.tsx
useEffect(() => {
  const socket = globalSocket.getSocket()
  
  // 监听其他玩家重连
  socket.on('player_reconnected', (data) => {
    console.log('🔄 玩家重新连接:', data.playerName)
    Toast.show({ 
      content: `${data.playerName} 重新连接`, 
      icon: 'success' 
    })
    // 更新玩家在线状态
    dispatch(updatePlayerStatus({ 
      playerId: data.playerId, 
      isOnline: true 
    }))
  })
  
  return () => {
    socket.off('player_reconnected')
  }
}, [])
```

---

### 方案 2: 前端保存房间信息（简单但不可靠）

#### 使用 localStorage 保存

```typescript
// 进入房间时保存
localStorage.setItem('lastRoomId', roomId)
localStorage.setItem('lastRoomTime', Date.now().toString())

// 登录后检查
const lastRoomId = localStorage.getItem('lastRoomId')
const lastRoomTime = localStorage.getItem('lastRoomTime')

if (lastRoomId && lastRoomTime) {
  const timeSince = Date.now() - parseInt(lastRoomTime)
  if (timeSince < 30000) { // 30 秒内
    navigate(`/game/${lastRoomId}`)
  }
}
```

**缺点**：
- ❌ 房间可能已经不存在
- ❌ 其他玩家可能已经离开
- ❌ 游戏状态无法恢复
- ❌ 不可靠

---

## 📊 推荐方案对比

| 特性 | 方案 1（后端） | 方案 2（前端） |
|------|---------------|---------------|
| 可靠性 | ✅ 高 | ❌ 低 |
| 状态恢复 | ✅ 完整 | ❌ 不完整 |
| 通知其他玩家 | ✅ 支持 | ❌ 不支持 |
| 实现复杂度 | 🟡 中等 | 🟢 简单 |
| 服务器压力 | 🟡 略增 | 🟢 无 |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐ |

---

## 🔄 完整流程设计

### 正常游戏流程

```
1. 用户登录（玩家 A）
   ↓
2. 进入房间 R01
   后端记录：Player A -> Room R01
   ↓
3. 游戏进行中
   后端保存游戏状态
   ↓
4. 用户正常离开
   后端清除：Player A -> null
```

### 断线重连流程

```
1. 用户在房间 R01（玩家 A）
   后端记录：Player A -> Room R01
   ↓
2. 用户刷新/断线
   后端标记：Player A.isOnline = false
   后端保留：Player A -> Room R01（30秒）
   ↓
3. 通知其他玩家
   广播：player_disconnected { playerId: A }
   ↓
4. 用户重新登录（相同名字）
   后端检测：Player A 在 Room R01
   后端检查：断线时间 < 30秒
   ↓
5. 恢复连接
   后端标记：Player A.isOnline = true
   后端发送：reconnect_success { roomId, gameState }
   ↓
6. 前端恢复
   跳转到房间 R01
   恢复游戏状态
   ↓
7. 通知其他玩家
   广播：player_reconnected { playerId: A }
   显示："玩家 A 重新连接"
```

### 超时流程

```
1. 用户断线
   后端标记：Player A.isOnline = false
   后端保留：Player A -> Room R01
   ↓
2. 等待 30 秒
   ↓
3. 超时
   后端清除：Player A -> null
   后端移除：Player A from Room R01
   ↓
4. 通知其他玩家
   广播：player_left { playerId: A }
   显示："玩家 A 离开房间"
```

---

## 🎯 实现步骤

### 阶段 1: 后端基础（优先级：高）

- [ ] 1.1 Player 添加 `currentRoomId` 和 `lastActiveTime` 字段
- [ ] 1.2 进入房间时保存 `currentRoomId`
- [ ] 1.3 断线时标记 `isOnline = false`，保留房间信息
- [ ] 1.4 定时清理超时的断线玩家（30秒）
- [ ] 1.5 登录时检查是否有待恢复的房间

### 阶段 2: 后端事件（优先级：高）

- [ ] 2.1 添加 `reconnect_success` 事件
- [ ] 2.2 添加 `player_disconnected` 事件
- [ ] 2.3 添加 `player_reconnected` 事件
- [ ] 2.4 发送完整的游戏状态

### 阶段 3: 前端监听（优先级：高）

- [ ] 3.1 登录后监听 `reconnect_success`
- [ ] 3.2 收到事件后恢复游戏状态
- [ ] 3.3 自动跳转到房间
- [ ] 3.4 显示恢复提示

### 阶段 4: 前端通知（优先级：中）

- [ ] 4.1 监听 `player_disconnected`
- [ ] 4.2 监听 `player_reconnected`
- [ ] 4.3 更新玩家在线状态
- [ ] 4.4 显示断线/重连提示

### 阶段 5: 优化（优先级：低）

- [ ] 5.1 添加重连动画
- [ ] 5.2 添加倒计时显示
- [ ] 5.3 优化网络状态检测
- [ ] 5.4 添加手动重连按钮

---

## 📝 代码示例

### 后端：保存房间信息

```typescript
// backend/src/services/user/userManager.ts
export class UserManager {
  // 玩家进入房间
  public playerJoinRoom(userId: string, roomId: string) {
    const player = this.findUserById(userId)
    if (player) {
      player.currentRoomId = roomId
      player.lastActiveTime = new Date()
      console.log(`✅ 玩家 ${player.name} 进入房间 ${roomId}`)
    }
  }
  
  // 玩家断线
  public playerDisconnect(userId: string) {
    const player = this.findUserById(userId)
    if (player) {
      player.isOnline = false
      player.lastActiveTime = new Date()
      console.log(`⚠️ 玩家 ${player.name} 断线，保留房间信息 30 秒`)
      
      // 30 秒后清理
      setTimeout(() => {
        if (!player.isOnline) {
          this.cleanupDisconnectedPlayer(userId)
        }
      }, 30000)
    }
  }
  
  // 检查重连
  public checkReconnection(userId: string): { canReconnect: boolean; roomId?: string } {
    const player = this.findUserById(userId)
    if (!player || !player.currentRoomId) {
      return { canReconnect: false }
    }
    
    const timeSinceDisconnect = Date.now() - player.lastActiveTime.getTime()
    if (timeSinceDisconnect < 30000) {
      return { canReconnect: true, roomId: player.currentRoomId }
    }
    
    return { canReconnect: false }
  }
}
```

### 前端：处理重连

```typescript
// src/pages/Login/index.tsx
const handleSubmit = async () => {
  const authUser = await login({
    userName: username.trim(),
    playerAvatar: avatar,
    htmlName: 'login',
  })
  
  const socket = globalSocket.getSocket()
  let reconnectHandled = false
  
  // 监听重连成功
  const handleReconnect = (data: any) => {
    if (reconnectHandled) return
    reconnectHandled = true
    
    console.log('🔄 断线重连成功，恢复到房间:', data.roomId)
    Toast.show({ content: '正在恢复游戏...', icon: 'loading' })
    
    // 恢复游戏状态
    if (data.gameState) {
      dispatch(restoreGameState(data.gameState))
    }
    
    // 跳转到房间
    navigate(`/game/${data.roomId}`, { replace: true })
  }
  
  socket.once('reconnect_success', handleReconnect)
  
  // 1 秒后如果没有重连响应，跳转到房间列表
  setTimeout(() => {
    if (!reconnectHandled) {
      socket.off('reconnect_success', handleReconnect)
      navigate('/rooms', { replace: true })
    }
  }, 1000)
}
```

---

## ⚠️ 注意事项

### 1. 安全性

**问题**：如何防止恶意用户冒充他人重连？

**解决方案**：
- 使用 sessionId 而不是 userName 作为唯一标识
- 验证 sessionId 的有效性
- 记录 IP 地址和设备信息

### 2. 并发问题

**问题**：同一用户在多个设备登录？

**解决方案**：
- 只允许最新的连接
- 踢出旧连接
- 或者允许多设备，但使用不同的 sessionId

### 3. 游戏状态

**问题**：如何恢复游戏状态？

**解决方案**：
- 后端保存完整的游戏状态
- 包括：手牌、出牌历史、当前回合等
- 使用 Redux 的 `restoreGameState` action

### 4. 超时时间

**问题**：30 秒是否合适？

**考虑因素**：
- 太短：用户来不及重连
- 太长：占用服务器资源
- 建议：30-60 秒

---

## 🎉 总结

### 推荐实现

**优先级 1**（必须）：
1. ✅ 后端保存玩家的 `currentRoomId`
2. ✅ 断线时保留房间信息 30 秒
3. ✅ 登录时检查是否可以重连
4. ✅ 发送 `reconnect_success` 事件

**优先级 2**（重要）：
1. ✅ 前端监听重连事件
2. ✅ 自动跳转到原房间
3. ✅ 通知其他玩家（断线/重连）

**优先级 3**（优化）：
1. ⏳ 显示重连倒计时
2. ⏳ 添加手动重连按钮
3. ⏳ 优化重连动画

### 用户体验

**修复前**：
- 刷新后必须重新选择房间
- 其他玩家不知道发生了什么
- 游戏状态丢失

**修复后**：
- 相同名字登录自动恢复
- 其他玩家看到"玩家重新连接"
- 游戏状态完整恢复
- 30 秒内有效

这个方案既保证了安全性，又提供了良好的用户体验！🚀
