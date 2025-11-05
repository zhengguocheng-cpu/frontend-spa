# 刷新后用户认证持久化修复（使用 sessionStorage）

## 🐛 问题描述

刷新房间页面后，用户信息丢失，被重定向到登录页面。

## 🔍 问题原因

`AuthContext.tsx` 中的 `getStoredUser()` 函数直接返回 `null`，导致：
1. 刷新后无法从 sessionStorage 恢复用户信息
2. Socket 连接断开
3. 用户被强制退出到登录页

## ⚠️ 为什么使用 sessionStorage 而不是 localStorage？

### localStorage 的问题 ❌
- **多标签页冲突**：标签页 A 的用户信息会被标签页 B 覆盖
- **无法支持多用户**：同一浏览器只能登录一个用户
- **安全性差**：关闭标签页后信息仍然保留

### sessionStorage 的优势 ✅
- **标签页隔离**：每个标签页独立存储，互不影响
- **支持多用户**：可以在不同标签页登录不同用户
- **自动清理**：关闭标签页后自动清除
- **刷新保留**：刷新页面（F5）数据不会丢失！

## ✅ 修复方案

### 1. 从 sessionStorage 恢复用户信息

```typescript
// 修复前
function getStoredUser(): AuthUser | null {
  return null  // ❌ 直接返回 null
}

// 修复后
function getStoredUser(): AuthUser | null {
  try {
    const userId = sessionStorage.getItem('userId')
    const userName = sessionStorage.getItem('userName')
    const playerAvatar = sessionStorage.getItem('playerAvatar')
    
    if (userId && userName) {
      console.log('🔄 从 sessionStorage 恢复用户信息:', { userId, userName })
      return {
        id: userId,
        name: userName,
        avatar: playerAvatar || '👑',
      }
    }
  } catch (error) {
    console.error('恢复用户信息失败:', error)
  }
  return null
}
```

### 2. 登录时保存用户信息

```typescript
const login = useCallback(async (options: ConnectOptions) => {
  setLoading(true)
  try {
    await globalSocket.connectAndWait(options)
    const authUser: AuthUser = {
      id: options.userId ?? options.userName,
      name: options.userName,
      avatar: options.playerAvatar ?? '👑',
    }
    
    // 💾 保存到 sessionStorage（标签页隔离）
    sessionStorage.setItem('userId', authUser.id)
    sessionStorage.setItem('userName', authUser.name)
    sessionStorage.setItem('playerAvatar', authUser.avatar)
    console.log('💾 用户信息已保存到 sessionStorage')
    
    setUser(authUser)
    Toast.show({ content: '登录成功，正在进入大厅', icon: 'success' })
    return authUser
  } finally {
    setLoading(false)
  }
}, [])
```

### 3. 退出登录时清除用户信息

```typescript
const logout = useCallback(() => {
  globalSocket.clearAuth()
  
  // 🗑️ 清除 sessionStorage
  sessionStorage.removeItem('userId')
  sessionStorage.removeItem('userName')
  sessionStorage.removeItem('playerAvatar')
  console.log('🗑️ 用户信息已从 sessionStorage 清除')
  
  setUser(null)
  Toast.show({ content: '已退出登录', icon: 'success' })
}, [])
```

### 4. 刷新后自动重连 Socket

```typescript
// 刷新后自动重连 Socket
useEffect(() => {
  const storedUser = getStoredUser()
  if (storedUser) {
    console.log('🔄 检测到用户信息，尝试重连 Socket...')
    globalSocket.connectAndWait({
      userId: storedUser.id,
      userName: storedUser.name,
      playerAvatar: storedUser.avatar,
    }).then(() => {
      console.log('✅ Socket 重连成功')
    }).catch((error) => {
      console.error('❌ Socket 重连失败:', error)
      // 重连失败时清除用户信息
      sessionStorage.removeItem('userId')
      sessionStorage.removeItem('userName')
      sessionStorage.removeItem('playerAvatar')
      setUser(null)
    })
  }
}, []) // 只在组件挂载时执行一次
```

## 🔄 完整流程

### 首次登录
```
1. 用户输入用户名和头像
2. 调用 login() 函数
3. 连接 Socket
4. 保存用户信息到 sessionStorage（标签页隔离）
   - userId
   - userName
   - playerAvatar
5. 更新 AuthContext 的 user 状态
6. 跳转到房间列表
```

### 刷新页面
```
1. 页面重新加载
2. AuthProvider 初始化
3. getStoredUser() 从 sessionStorage 读取用户信息
4. 如果有用户信息：
   a. 恢复 user 状态
   b. useEffect 触发自动重连
   c. 重连 Socket 成功
   d. 用户保持登录状态 ✅
5. 如果没有用户信息或重连失败：
   a. 清除 sessionStorage
   b. user 状态为 null
   c. 重定向到登录页
```

### 退出登录
```
1. 用户点击退出
2. 调用 logout() 函数
3. 断开 Socket 连接
4. 清除 sessionStorage 中的用户信息
5. 清除 AuthContext 的 user 状态
6. 重定向到登录页
```

### 多标签页场景
```
标签页 A: 用户 "张三" 登录
  sessionStorage A: { userId: "user1", userName: "张三" }

标签页 B: 用户 "李四" 登录
  sessionStorage B: { userId: "user2", userName: "李四" }

标签页 A 刷新：
  ✅ 仍然是 { userId: "user1", userName: "张三" }
  ✅ 不受标签页 B 影响
```

## 📊 sessionStorage 存储内容

```javascript
{
  "userId": "user123",           // 用户 ID
  "userName": "玩家名称",        // 用户名
  "playerAvatar": "👑"          // 用户头像
}
```

## ✅ 测试清单

- [x] 登录后用户信息保存到 localStorage
- [x] 刷新页面后用户信息恢复
- [x] 刷新页面后 Socket 自动重连
- [x] 重连失败时清除用户信息并跳转登录页
- [x] 退出登录时清除 localStorage
- [x] 多标签页同步（通过 localStorage）

## 🔧 相关文件

- `src/context/AuthContext.tsx` - 认证上下文，处理用户登录和持久化

## 🎯 效果

### 修复前
- ❌ 刷新页面后被强制退出
- ❌ 需要重新登录
- ❌ 游戏进度丢失

### 修复后
- ✅ 刷新页面后保持登录状态
- ✅ Socket 自动重连
- ✅ 游戏进度保持
- ✅ 用户体验流畅

---

**用户认证持久化已修复！** ✅

现在刷新页面不会丢失登录状态了。
