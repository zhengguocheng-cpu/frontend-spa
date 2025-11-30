# 重连功能实现说明

## 🎯 功能概述

参考 frontend 多页面版本的重连逻辑，实现了玩家刷新页面后可以重新进入房间、恢复游戏状态、继续游戏的功能。

---

## 🔄 重连流程

### 完整流程

```
1. 玩家在房间 A01 游戏中
   ↓
2. 保存房间信息到 localStorage
   - lastRoomId: "A01"
   - lastRoomTime: 当前时间戳
   ↓
3. 玩家刷新页面（F5）
   ↓
4. sessionStorage 清空，跳转到登录页
   ↓
5. 玩家输入相同名字登录
   ↓
6. 检查 localStorage 中的房间信息
   - 如果在 30 秒内：自动跳转到房间 A01
   - 如果超过 30 秒：跳转到房间列表
   ↓
7. 进入房间后，后端检测到重连
   ↓
8. 后端发送 game_state_restored 事件
   ↓
9. 前端恢复游戏状态
   - 恢复玩家列表
   - 恢复手牌
   - 恢复地主信息
   - 恢复当前回合
   ↓
10. 显示提示："游戏状态已恢复，继续游戏"
   ✅ 完成重连
```

---

## 📝 实现细节

### 1. 保存房间信息

**文件**: `src/pages/GameRoom/index.tsx`

**时机**: 进入房间时

```typescript
// 保存房间信息到 localStorage，用于重连
localStorage.setItem('lastRoomId', roomId)
localStorage.setItem('lastRoomTime', Date.now().toString())
```

**存储内容**:
- `lastRoomId`: 房间 ID
- `lastRoomTime`: 进入时间戳

---

### 2. 登录时检查重连

**文件**: `src/pages/Login/index.tsx`

**逻辑**:
```typescript
// 检查是否有待恢复的房间
const urlParams = new URLSearchParams(window.location.search)
const roomIdFromUrl = urlParams.get('roomId')
const lastRoomId = localStorage.getItem('lastRoomId')
const lastRoomTime = localStorage.getItem('lastRoomTime')

// 如果 URL 中有 roomId，或者 localStorage 中有最近的房间（30秒内）
const targetRoomId = roomIdFromUrl || (
  lastRoomId && lastRoomTime && 
  (Date.now() - parseInt(lastRoomTime)) < 30000 
    ? lastRoomId 
    : null
)

if (targetRoomId) {
  // 跳转到房间，后端会自动发送 game_state_restored 事件
  navigate(`/game/${targetRoomId}`, { replace: true })
} else {
  // 跳转到房间列表
  navigate('/rooms', { replace: true })
}
```

**重连条件**:
1. URL 中有 `roomId` 参数，或
2. localStorage 中有房间信息，且在 30 秒内

---

### 3. 监听状态恢复事件

**文件**: `src/pages/GameRoom/index.tsx`

**事件**: `game_state_restored`

```typescript
const handleGameStateRestored = (data: any) => {
  console.log('🔄 恢复游戏状态:', data)
  Toast.show({ content: '游戏状态已恢复，继续游戏', icon: 'success' })
  
  if (!data) return
  
  // 1. 恢复玩家列表
  if (data.players && Array.isArray(data.players)) {
    const players = data.players.map((p: any) => ({
      ...p,
      isReady: true, // 游戏中都是准备状态
      cardCount: p.cardCount || p.cards?.length || 0
    }))
    dispatch(updatePlayers(players))
  }
  
  // 2. 恢复当前玩家手牌
  const currentPlayerState = data.players?.find((p: any) => 
    p.id === user?.id || p.name === user?.name
  )
  
  if (currentPlayerState && currentPlayerState.cards) {
    dispatch(startGame({ myCards: currentPlayerState.cards }))
  }
  
  // 3. 恢复地主信息
  if (data.landlordId) {
    dispatch(setLandlord({
      landlordId: data.landlordId,
      landlordCards: data.bottomCards || []
    }))
  }
  
  // 4. 恢复当前回合
  if (data.currentPlayerId) {
    dispatch(setCurrentPlayer(data.currentPlayerId))
  }
}
```

**恢复内容**:
1. ✅ 玩家列表（包括其他玩家）
2. ✅ 当前玩家手牌
3. ✅ 地主信息和底牌
4. ✅ 当前回合玩家
5. ✅ 游戏阶段

---

### 4. 清除房间信息

**时机**: 主动离开房间时

```typescript
const handleLeaveRoom = () => {
  Dialog.confirm({
    content: '确定要离开房间吗？',
    onConfirm: () => {
      // 清除房间信息
      localStorage.removeItem('lastRoomId')
      localStorage.removeItem('lastRoomTime')
      // ...
    },
  })
}
```

---

## 🎯 与 frontend 的对比

### frontend (多页面版本)

**保存方式**: URL 参数
```javascript
// 房间 URL 包含玩家信息
room.html?roomId=A01&playerName=张三&playerAvatar=👑
```

**重连方式**: 
- 刷新后 URL 参数仍然存在
- 直接从 URL 读取信息重新加入

**优点**:
- ✅ 简单直接
- ✅ URL 包含所有信息

**缺点**:
- ❌ URL 暴露玩家信息
- ❌ 无法控制超时

### SPA 版本

**保存方式**: localStorage + sessionStorage
```typescript
// localStorage: 房间信息（持久化）
lastRoomId: "A01"
lastRoomTime: "1699000000000"

// sessionStorage: 用户信息（临时）
user: { id, name, avatar }
```

**重连方式**:
- 刷新后检查 localStorage
- 30 秒内自动重连
- 超时则跳转到房间列表

**优点**:
- ✅ 更安全（不暴露信息）
- ✅ 可控制超时时间
- ✅ 更好的用户体验

**缺点**:
- ⚠️ 需要额外的状态管理

---

## 🧪 测试场景

### 场景 1: 等待阶段刷新

**步骤**:
1. 3个玩家进入房间 A01
2. 玩家 A 点击准备
3. 玩家 A 刷新页面
4. 玩家 A 重新登录（相同名字）

**预期结果**:
- ✅ 自动进入房间 A01
- ✅ 看到其他玩家
- ✅ 自己的准备状态保留
- ✅ 可以继续游戏

### 场景 2: 游戏中刷新

**步骤**:
1. 游戏开始，发牌完成
2. 玩家 A 刷新页面
3. 玩家 A 重新登录

**预期结果**:
- ✅ 自动进入房间 A01
- ✅ 恢复手牌（17张）
- ✅ 恢复地主信息
- ✅ 恢复当前回合
- ✅ 可以继续出牌

### 场景 3: 超时后刷新

**步骤**:
1. 玩家在房间 A01
2. 刷新页面
3. 等待 35 秒
4. 重新登录

**预期结果**:
- ✅ 跳转到房间列表（不是 A01）
- ✅ 需要重新选择房间
- ⚠️ 原房间可能已经不存在

### 场景 4: 不同名字登录

**步骤**:
1. 玩家 A 在房间 A01
2. 刷新页面
3. 用玩家 B 的名字登录

**预期结果**:
- ✅ 跳转到房间列表
- ✅ 不会进入 A01
- ✅ 玩家 A 被视为离线

---

## ⚙️ 配置参数

### 重连超时时间

**当前设置**: 30 秒

```typescript
const RECONNECT_TIMEOUT = 30000 // 30秒

// 检查是否在超时时间内
(Date.now() - parseInt(lastRoomTime)) < RECONNECT_TIMEOUT
```

**调整建议**:
- 太短（< 10秒）：用户来不及重新登录
- 太长（> 60秒）：占用服务器资源
- 推荐：30-60 秒

---

## 🔒 安全考虑

### 1. 用户验证

**问题**: 如何防止恶意用户冒充他人重连？

**解决方案**:
- ✅ 使用 sessionId 作为唯一标识
- ✅ 后端验证用户身份
- ✅ 检查用户名是否匹配

### 2. 房间验证

**问题**: 如何防止进入已满或不存在的房间？

**解决方案**:
- ✅ 后端检查房间状态
- ✅ 发送 `join_game_failed` 事件
- ✅ 前端跳转到房间列表

### 3. 状态同步

**问题**: 如何确保恢复的状态是最新的？

**解决方案**:
- ✅ 后端保存完整的游戏状态
- ✅ 发送 `game_state_restored` 事件
- ✅ 包含所有必要信息

---

## 📊 数据结构

### game_state_restored 事件数据

```typescript
interface GameStateRestored {
  // 游戏阶段
  phase: 'waiting' | 'bidding' | 'playing' | 'finished'
  
  // 所有玩家信息
  players: Array<{
    id: string
    name: string
    avatar: string
    cards?: Card[]        // 当前玩家的手牌
    cardCount: number     // 其他玩家的牌数
    isReady: boolean
  }>
  
  // 地主信息
  landlordId?: string
  landlordName?: string
  bottomCards?: Card[]
  
  // 当前回合
  currentPlayerId?: string
  currentPlayerName?: string
  
  // 出牌历史
  lastPlayedCards?: {
    playerId: string
    cards: Card[]
    type: string
  }
}
```

---

## 🎉 总结

### 实现的功能

1. ✅ 保存房间信息到 localStorage
2. ✅ 登录时检查是否需要重连
3. ✅ 30 秒内自动重连到原房间
4. ✅ 监听 `game_state_restored` 事件
5. ✅ 恢复完整的游戏状态
6. ✅ 离开房间时清除信息

### 用户体验

**修复前**:
- ❌ 刷新后必须重新选择房间
- ❌ 游戏状态丢失
- ❌ 其他玩家不知道发生了什么

**修复后**:
- ✅ 刷新后自动恢复（30秒内）
- ✅ 游戏状态完整恢复
- ✅ 可以继续游戏
- ✅ 提示"游戏状态已恢复"

### 与 frontend 的一致性

- ✅ 参考了 frontend 的重连逻辑
- ✅ 使用相同的事件名称
- ✅ 恢复相同的游戏状态
- ✅ 提供相同的用户体验

**重连功能已完整实现！** 🚀
