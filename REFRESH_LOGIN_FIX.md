# 刷新页面跳转登录页问题修复

## 🐛 问题描述

刷新房间页面后，立即跳转到登录页，即使已经登录过。

## 🔍 根本原因

**Socket 和 AuthContext 保存的数据不一致！**

### Socket.ts 保存的数据
```typescript
sessionStorage.setItem('sessionId', this.sessionId)
sessionStorage.setItem('userName', options.userName)
sessionStorage.setItem('playerAvatar', this.playerAvatar)
// ❌ 没有保存 userId！
```

### AuthContext 恢复时需要的数据
```typescript
const userId = sessionStorage.getItem('userId')  // ❌ 读不到！
const userName = sessionStorage.getItem('userName')
const playerAvatar = sessionStorage.getItem('playerAvatar')

if (userId && userName) {  // ❌ userId 为 null，条件不满足
  return { id: userId, name: userName, avatar }
}
return null  // ❌ 返回 null，导致 user 为空
```

### 导致的问题链
```
1. 登录时：Socket 保存了 userName 和 playerAvatar，但没保存 userId
   sessionStorage: { userName: "张三", playerAvatar: "👑" }
   ❌ 缺少 userId

2. 刷新页面：AuthContext 尝试恢复用户信息
   读取 userId → null
   读取 userName → "张三"
   
3. 判断条件：if (userId && userName)
   ❌ userId 为 null，条件失败
   
4. 返回 null：getStoredUser() 返回 null
   
5. GameRoom 检查：if (!user) → 跳转登录页 ❌
```

## ✅ 修复方案

### 1. Socket 保存 userId

```typescript
// 修复前
sessionStorage.setItem('sessionId', this.sessionId)
sessionStorage.setItem('userName', options.userName)
sessionStorage.setItem('playerAvatar', this.playerAvatar)

// 修复后
sessionStorage.setItem('sessionId', this.sessionId)
sessionStorage.setItem('userId', this.userId)  // ✅ 添加 userId
sessionStorage.setItem('userName', options.userName)
sessionStorage.setItem('playerAvatar', this.playerAvatar)
```

### 2. Socket 清除 userId

```typescript
// 修复前
sessionStorage.removeItem('sessionId')
sessionStorage.removeItem('userName')
sessionStorage.removeItem('playerAvatar')

// 修复后
sessionStorage.removeItem('sessionId')
sessionStorage.removeItem('userId')  // ✅ 清除 userId
sessionStorage.removeItem('userName')
sessionStorage.removeItem('playerAvatar')
```

## 🔄 完整流程（修复后）

### 登录
```
1. 用户登录 "张三"
2. Socket.ensureUser() 生成 userId (sessionId)
   userId = "1730000000000_abc123"
3. 保存到 sessionStorage:
   ✅ sessionId: "1730000000000_abc123"
   ✅ userId: "1730000000000_abc123"
   ✅ userName: "张三"
   ✅ playerAvatar: "👑"
```

### 刷新页面
```
1. 页面重新加载
2. AuthContext 初始化
3. getStoredUser() 读取 sessionStorage:
   ✅ userId: "1730000000000_abc123"
   ✅ userName: "张三"
   ✅ playerAvatar: "👑"
4. 条件判断: if (userId && userName) → ✅ 通过
5. 返回用户对象: { id, name, avatar }
6. user 状态恢复 ✅
7. GameRoom 检查: if (!user) → ✅ 不跳转
8. 自动重连 Socket ✅
9. 保持登录状态 ✅
```

## 📊 sessionStorage 存储内容（修复后）

```javascript
{
  "sessionId": "1730000000000_abc123",  // 会话 ID
  "userId": "1730000000000_abc123",     // ✅ 用户 ID（新增）
  "userName": "张三",                   // 用户名
  "playerAvatar": "👑"                  // 头像
}
```

## 🎯 为什么之前没发现这个问题？

因为有两个地方都在保存用户信息：

1. **Socket.ts** - 在 `ensureUser()` 中保存
2. **AuthContext.tsx** - 在 `login()` 中保存

之前可能只测试了从 AuthContext 登录的情况，AuthContext 会保存完整的 userId。

但如果：
- 直接进入房间页面
- 或者 Socket 先初始化
- AuthContext 的保存还没执行

就会出现 userId 缺失的问题。

## ✅ 测试清单

- [x] Socket 保存 userId 到 sessionStorage
- [x] Socket 清除时也清除 userId
- [x] 登录后刷新页面不跳转登录页
- [x] 多标签页登录不同用户互不影响
- [x] 关闭标签页后 sessionStorage 自动清除

## 🔧 相关文件

- `src/services/socket.ts` - Socket 管理器
- `src/context/AuthContext.tsx` - 认证上下文
- `src/pages/GameRoom/index.tsx` - 游戏房间页面

---

**刷新跳转登录页问题已修复！** ✅

现在刷新房间页面会保持登录状态了。
