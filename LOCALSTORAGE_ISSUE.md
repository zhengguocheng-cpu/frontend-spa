# localStorage 跨标签页共享问题

## 🐛 问题描述

### 现象
1. 用户 A 在标签页 1 登录，进入游戏大厅，选择 A01 房间
2. 用户 B 在标签页 2 登录
3. **问题**: 用户 B 登录后直接进入了 A01 房间，而不是游戏大厅

### 影响
- 用户 B 无法选择自己想要的房间
- 用户 B 可能进入了不想进入的房间
- 多用户测试时会互相干扰

---

## 🔍 根本原因分析

### localStorage 的特性

**关键点**: `localStorage` 是**同源共享**的！

```
同一个浏览器 + 同一个域名 = 共享 localStorage
```

**具体表现**:
- 标签页 1 和标签页 2 使用相同的 `localStorage`
- 标签页 1 写入 `lastRoomId = "A01"`
- 标签页 2 读取到的也是 `lastRoomId = "A01"`

---

## 📊 问题流程

### 标签页 1（用户 A）

```
1. 用户 A 登录
   ↓
2. 跳转到游戏大厅 /rooms
   ↓
3. 选择 A01 房间
   ↓
4. 进入房间 /game/A01
   ↓
5. 执行代码：
   localStorage.setItem('lastRoomId', 'A01')
   localStorage.setItem('lastRoomTime', Date.now())
   ✅ localStorage 中保存了 A01
```

### 标签页 2（用户 B）

```
1. 用户 B 登录
   ↓
2. 执行登录逻辑：
   const lastRoomId = localStorage.getItem('lastRoomId')
   // 读取到 'A01'（来自标签页 1！）
   ↓
3. 检查时间：
   const lastRoomTime = localStorage.getItem('lastRoomTime')
   // 时间在 30 秒内
   ↓
4. 判断：
   if (targetRoomId) {  // 'A01'
     navigate(`/game/${targetRoomId}`)
   }
   ↓
5. ❌ 直接跳转到 A01 房间
   而不是游戏大厅！
```

---

## 🎯 问题代码定位

### 1. 保存房间信息

**文件**: `src/pages/GameRoom/index.tsx` (第 91-92 行)

```typescript
// 保存房间信息到 localStorage，用于重连
localStorage.setItem('lastRoomId', roomId)
localStorage.setItem('lastRoomTime', Date.now().toString())
```

**问题**: 
- 所有标签页共享同一个 localStorage
- 标签页 1 保存的房间信息会影响标签页 2

### 2. 读取房间信息

**文件**: `src/pages/Login/index.tsx` (第 38-47 行)

```typescript
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
  navigate(`/game/${targetRoomId}`, { replace: true })
}
```

**问题**:
- 读取的是全局共享的 localStorage
- 无法区分是哪个用户的房间信息

---

## ✅ 解决方案

### 方案 1: 使用 sessionStorage（推荐）✅

**原理**: `sessionStorage` 是**标签页隔离**的

```typescript
// 每个标签页有独立的 sessionStorage
标签页 1: sessionStorage.setItem('lastRoomId', 'A01')
标签页 2: sessionStorage.getItem('lastRoomId')  // null
```

**修改**:

#### 修改 1: GameRoom/index.tsx

```typescript
// 修改前
localStorage.setItem('lastRoomId', roomId)
localStorage.setItem('lastRoomTime', Date.now().toString())

// 修改后
sessionStorage.setItem('lastRoomId', roomId)
sessionStorage.setItem('lastRoomTime', Date.now().toString())
```

#### 修改 2: Login/index.tsx

```typescript
// 修改前
const lastRoomId = localStorage.getItem('lastRoomId')
const lastRoomTime = localStorage.getItem('lastRoomTime')

// 修改后
const lastRoomId = sessionStorage.getItem('lastRoomId')
const lastRoomTime = sessionStorage.getItem('lastRoomTime')
```

#### 修改 3: GameRoom/index.tsx (离开房间)

```typescript
// 修改前
localStorage.removeItem('lastRoomId')
localStorage.removeItem('lastRoomTime')

// 修改后
sessionStorage.removeItem('lastRoomId')
sessionStorage.removeItem('lastRoomTime')
```

**优点**:
- ✅ 标签页隔离，互不影响
- ✅ 关闭标签页自动清除
- ✅ 不需要额外的用户标识

**缺点**:
- ⚠️ 刷新后仍然有效（这是我们想要的）
- ⚠️ 关闭标签页后数据丢失（这也是我们想要的）

---

### 方案 2: localStorage + 用户标识

**原理**: 在 key 中加入用户标识

```typescript
// 标签页 1（用户 A）
localStorage.setItem('lastRoomId_userA', 'A01')

// 标签页 2（用户 B）
localStorage.getItem('lastRoomId_userB')  // null
```

**修改**:

```typescript
// 保存
const userId = user.id || user.name
localStorage.setItem(`lastRoomId_${userId}`, roomId)
localStorage.setItem(`lastRoomTime_${userId}`, Date.now().toString())

// 读取
const userId = authUser.id || authUser.name
const lastRoomId = localStorage.getItem(`lastRoomId_${userId}`)
const lastRoomTime = localStorage.getItem(`lastRoomTime_${userId}`)
```

**优点**:
- ✅ 不同用户的数据隔离
- ✅ 关闭标签页后数据仍然保留

**缺点**:
- ❌ 需要在登录后才能获取 userId
- ❌ localStorage 会越来越多
- ❌ 需要手动清理

---

### 方案 3: 完全移除重连功能

**原理**: 不保存房间信息，刷新后总是回到大厅

```typescript
// 删除所有 localStorage/sessionStorage 相关代码
// 登录后总是跳转到 /rooms
navigate('/rooms', { replace: true })
```

**优点**:
- ✅ 最简单
- ✅ 没有副作用

**缺点**:
- ❌ 失去重连功能
- ❌ 用户体验下降

---

## 📊 方案对比

| 特性 | sessionStorage | localStorage + userId | 移除功能 |
|------|----------------|----------------------|----------|
| 标签页隔离 | ✅ 完全隔离 | ⚠️ 需要用户ID | ✅ 无影响 |
| 重连功能 | ✅ 支持 | ✅ 支持 | ❌ 不支持 |
| 实现复杂度 | 🟢 简单 | 🟡 中等 | 🟢 最简单 |
| 数据清理 | ✅ 自动 | ❌ 需要手动 | ✅ 无需清理 |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## 🎯 推荐实施

### 立即修改（方案 1）

将所有 `localStorage` 改为 `sessionStorage`：

#### 1. GameRoom/index.tsx

```typescript
// 第 91-92 行
sessionStorage.setItem('lastRoomId', roomId)
sessionStorage.setItem('lastRoomTime', Date.now().toString())

// 第 413-414 行
sessionStorage.removeItem('lastRoomId')
sessionStorage.removeItem('lastRoomTime')
```

#### 2. Login/index.tsx

```typescript
// 第 38-39 行
const lastRoomId = sessionStorage.getItem('lastRoomId')
const lastRoomTime = sessionStorage.getItem('lastRoomTime')
```

---

## 🧪 测试验证

### 测试场景 1: 两个标签页不同用户

**步骤**:
1. 标签页 1：用户 A 登录，进入 A01 房间
2. 标签页 2：用户 B 登录

**修复前**:
- ❌ 用户 B 直接进入 A01 房间

**修复后**:
- ✅ 用户 B 进入游戏大厅
- ✅ 用户 B 可以选择任意房间

### 测试场景 2: 同一标签页刷新

**步骤**:
1. 用户 A 登录，进入 A01 房间
2. 刷新页面
3. 重新登录（相同用户名）

**修复前**:
- ✅ 自动恢复到 A01 房间

**修复后**:
- ✅ 仍然自动恢复到 A01 房间
- ✅ 功能不受影响

### 测试场景 3: 关闭标签页后重新打开

**步骤**:
1. 用户 A 登录，进入 A01 房间
2. 关闭标签页
3. 重新打开，登录

**修复前**:
- ✅ 自动恢复到 A01 房间（localStorage 持久化）

**修复后**:
- ✅ 进入游戏大厅（sessionStorage 已清除）
- ✅ 这是更合理的行为

---

## 💡 localStorage vs sessionStorage

### localStorage

**特性**:
- 永久保存（除非手动删除）
- 同源共享（所有标签页）
- 容量：5-10MB

**适用场景**:
- 用户偏好设置
- 主题、语言等配置
- 需要跨标签页共享的数据

### sessionStorage

**特性**:
- 标签页关闭后清除
- 标签页隔离（不共享）
- 容量：5-10MB

**适用场景**:
- 临时状态
- 当前会话数据
- 需要标签页隔离的数据
- **重连信息**（推荐）

---

## 🎉 总结

### 问题根源
- localStorage 是同源共享的
- 标签页 1 保存的房间信息会影响标签页 2
- 导致用户 B 直接进入用户 A 的房间

### 解决方案
- ✅ 使用 sessionStorage 替代 localStorage
- ✅ 标签页隔离，互不影响
- ✅ 保留重连功能

### 修改内容
1. GameRoom/index.tsx: localStorage → sessionStorage
2. Login/index.tsx: localStorage → sessionStorage
3. 3 处修改，简单快速

**修改后，多标签页测试将不会互相干扰！** 🚀
