# 单 Socket 会话管理修复

## 🎯 问题描述

**原问题**：
- 使用 localStorage 存储用户信息，导致多个无痕标签页登录时使用同一个用户名
- userId 默认使用 userName，没有真正的唯一标识
- 无法区分同一用户的不同会话

**目标**：
- 每个浏览器标签页/窗口都是独立的会话
- 使用唯一的 sessionId 标识每个连接
- 防止重复登录问题

---

## ✅ 前端已完成的修改

### 1. Socket 管理器 (`src/services/socket.ts`)

#### 修改内容：

**添加 sessionId 字段**
```typescript
private sessionId: string | null = null // 会话标识，每次登录生成
```

**生成唯一会话 ID**
```typescript
private ensureUser(options?: ConnectOptions) {
  if (options?.userName) {
    // 生成唯一的会话 ID（时间戳 + 随机字符串）
    this.sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    this.userName = options.userName
    // userId 使用 sessionId 作为唯一标识
    this.userId = options.userId ?? this.sessionId
    this.playerAvatar = options.playerAvatar ?? this.playerAvatar ?? '👑'
    
    // 仅存储当前会话信息，不用于自动登录
    sessionStorage.setItem('sessionId', this.sessionId)
    sessionStorage.setItem('userName', options.userName)
    sessionStorage.setItem('playerAvatar', this.playerAvatar)
  } else {
    // SPA 架构不应该自动从缓存恢复用户，必须重新登录
    throw new Error('缺少用户信息，请重新登录')
  }
}
```

**传递 sessionId 到后端**
```typescript
this.socket = io(baseUrl, {
  auth: {
    userId: this.userId, // 使用 sessionId 作为唯一标识
    userName: this.userName,
    sessionId: this.sessionId, // 传递会话 ID
    htmlName: options?.htmlName ?? 'spa',
    pageNavigationToken,
  },
  // ...
})
```

**清除会话时使用 sessionStorage**
```typescript
clearAuth() {
  // 清除会话存储
  sessionStorage.removeItem('sessionId')
  sessionStorage.removeItem('userName')
  sessionStorage.removeItem('playerAvatar')
  this.currentRoomId = null
  this.userId = null
  this.userName = null
  this.sessionId = null
  this.playerAvatar = null
  this.disconnect()
}
```

### 2. 认证上下文 (`src/context/AuthContext.tsx`)

#### 修改内容：

**移除自动登录逻辑**
```typescript
// SPA 架构不使用自动登录，每次打开页面都需要重新登录
function getStoredUser(): AuthUser | null {
  return null
}
```

**移除自动重连 useEffect**
```typescript
// SPA 架构不需要自动重连，用户必须手动登录
// useEffect 已移除
```

---

## ⏳ 后端待修改（下一阶段）

### 1. 用户管理器 (`backend/src/services/user/userManager.ts`)

**需要修改的逻辑**：

```typescript
// 当前问题：使用 userName 作为唯一标识
public authenticateUser(userName: string, socketId: string, htmlName?: string): Player

// 应该改为：使用 userId (sessionId) 作为唯一标识
public authenticateUser(userId: string, userName: string, socketId: string, htmlName?: string): Player
```

**关键改动**：
1. 使用 `userId` (实际是 sessionId) 作为 Player 的唯一 ID
2. 允许同一 `userName` 有多个不同的 `userId` (会话)
3. 修改用户查找逻辑：`findUserById(userId)` 而不是 `findUserByName(userName)`
4. 移除基于 `userName` 的重复登录检查

### 2. 认证中间件 (`backend/src/middleware/AuthMiddleware.ts`)

**需要修改的逻辑**：

```typescript
// 当前：
socket.userId = result.user.name;
socket.userName = result.user.name;

// 应该改为：
socket.userId = auth.userId; // sessionId
socket.userName = auth.userName;
```

### 3. 房间管理器

**需要检查**：
- 玩家加入房间时，使用 `userId` 而不是 `userName`
- 玩家离开房间时，使用 `userId` 查找
- 房间内玩家列表，使用 `userId` 作为键

---

## 🔄 工作流程对比

### 修改前（有问题）

```
用户打开标签页 1
  ↓
登录 "玩家A"
  ↓
localStorage 存储 userName="玩家A"
  ↓
用户打开标签页 2（无痕模式）
  ↓
自动从 localStorage 读取 userName="玩家A"
  ↓
❌ 两个标签页使用同一个用户名
```

### 修改后（正确）

```
用户打开标签页 1
  ↓
登录 "玩家A"
  ↓
生成 sessionId_1 = "1730000000000_abc123"
userId = sessionId_1
  ↓
sessionStorage 存储（仅当前标签页）
  ↓
用户打开标签页 2（无痕模式）
  ↓
没有缓存，必须重新登录
  ↓
登录 "玩家A"（可以使用相同用户名）
  ↓
生成 sessionId_2 = "1730000001000_xyz789"
userId = sessionId_2
  ↓
✅ 两个标签页有不同的 userId，互不干扰
```

---

## 📊 数据结构变化

### 前端 Socket 认证数据

**修改前**：
```typescript
{
  userId: "玩家A",        // 使用用户名
  userName: "玩家A",
  htmlName: "spa"
}
```

**修改后**：
```typescript
{
  userId: "1730000000000_abc123",  // 唯一的 sessionId
  userName: "玩家A",
  sessionId: "1730000000000_abc123",
  htmlName: "spa"
}
```

### 后端 Player 数据结构（待修改）

**当前**：
```typescript
{
  id: "玩家A",           // 使用用户名作为 ID
  name: "玩家A",
  userId: "玩家A",
  socketId: "socket_123"
}
```

**应该改为**：
```typescript
{
  id: "1730000000000_abc123",  // 使用 sessionId 作为 ID
  name: "玩家A",
  userId: "1730000000000_abc123",
  sessionId: "1730000000000_abc123",
  socketId: "socket_123"
}
```

---

## 🎯 优势

### 1. 真正的单 Socket 架构
- 每个标签页/窗口都是独立的 Socket 连接
- 不会因为缓存导致多个标签页共享用户

### 2. 支持多设备/多标签页
- 同一用户可以在多个设备登录
- 每个设备/标签页都有独立的会话

### 3. 安全性提升
- sessionStorage 仅在当前标签页有效
- 关闭标签页后会话自动清除
- 无法通过缓存伪造其他用户

### 4. 便于调试
- 每个会话都有唯一的 sessionId
- 可以在日志中追踪特定会话
- 便于排查问题

---

## 🧪 测试场景

### 场景 1: 正常登录
1. 打开标签页 1
2. 登录 "玩家A"
3. 检查 sessionStorage 中的 sessionId
4. ✅ 应该能正常进入游戏

### 场景 2: 多标签页登录
1. 打开标签页 1，登录 "玩家A"
2. 打开标签页 2，登录 "玩家B"
3. 检查两个标签页的 sessionId
4. ✅ 应该是不同的 sessionId
5. ✅ 两个玩家可以同时在线

### 场景 3: 同名用户登录（待后端支持）
1. 打开标签页 1，登录 "玩家A"
2. 打开标签页 2，登录 "玩家A"（相同用户名）
3. ✅ 应该允许登录（不同 sessionId）
4. ✅ 两个会话互不干扰

### 场景 4: 刷新页面
1. 登录后刷新页面
2. ✅ 应该跳转到登录页（不自动登录）
3. 用户需要重新输入用户名登录

### 场景 5: 无痕模式
1. 打开无痕窗口
2. 登录任意用户名
3. ✅ 应该能正常登录
4. ✅ 不会受到其他窗口的影响

---

## 📝 下一阶段工作清单

### 后端修改（优先级：高）

- [ ] 修改 `UserManager.authenticateUser()` 方法
  - [ ] 参数改为 `(userId, userName, socketId, htmlName)`
  - [ ] 使用 `userId` 作为 Player 的唯一 ID
  - [ ] 允许同一 `userName` 有多个会话
  
- [ ] 修改 `AuthMiddleware.handleAuthFromConnection()` 方法
  - [ ] 从 `auth.sessionId` 获取唯一标识
  - [ ] 传递 `userName` 和 `userId` 到 `authenticateUser`
  
- [ ] 修改用户查找逻辑
  - [ ] `findUserById(userId)` 使用 sessionId 查找
  - [ ] 保留 `findUserByName(userName)` 用于显示
  
- [ ] 修改房间管理逻辑
  - [ ] 玩家加入/离开使用 `userId`
  - [ ] 房间内玩家列表使用 `userId` 作为键

### 测试（优先级：中）

- [ ] 单元测试：sessionId 生成唯一性
- [ ] 集成测试：多标签页登录
- [ ] 集成测试：同名用户登录
- [ ] 端到端测试：完整游戏流程

### 文档（优先级：低）

- [ ] 更新 API 文档
- [ ] 更新架构设计文档
- [ ] 添加会话管理说明

---

## 🔍 注意事项

### 1. 向后兼容性
- 后端修改需要考虑旧版本客户端
- 可能需要同时支持 `userName` 和 `sessionId` 两种模式

### 2. 数据迁移
- 现有用户数据可能需要迁移
- 需要处理旧的 `userName` 作为 ID 的数据

### 3. 性能考虑
- sessionId 是字符串，比数字 ID 占用更多空间
- 需要评估对性能的影响

### 4. 调试信息
- 日志中需要同时显示 `userId` (sessionId) 和 `userName`
- 便于追踪和调试

---

## 🎉 总结

前端修改已完成，实现了：
- ✅ 每次登录生成唯一的 sessionId
- ✅ 使用 sessionStorage 而不是 localStorage
- ✅ 移除自动登录逻辑
- ✅ 每个标签页都是独立会话

下一阶段需要修改后端，使其能够：
- 基于 sessionId 而不是 userName 管理用户
- 允许同一用户名有多个会话
- 正确处理会话的创建和销毁

这样就能真正实现单 Socket 架构，解决重复登录问题！
