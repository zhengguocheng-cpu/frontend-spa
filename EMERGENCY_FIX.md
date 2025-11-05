# 紧急修复 - CORS 和无限循环问题

## 🔴 问题诊断

### 问题 1: 无限循环（已修复 ✅）
**现象**：Maximum update depth exceeded

**原因**：
```typescript
// ❌ 错误：每次 user 变化都会触发导航
useEffect(() => {
  if (user) {
    navigate('/rooms', { replace: true })
  }
}, [user, navigate]) // user 变化 → 导航 → 组件重渲染 → user 变化 → 无限循环
```

**修复**：
```typescript
// ✅ 正确：只在组件挂载时检查一次
useEffect(() => {
  if (user) {
    navigate('/rooms', { replace: true })
  }
}, []) // 只执行一次
```

---

### 问题 2: CORS 错误（需要后端配置）
**现象**：
```
Access to XMLHttpRequest at 'http://localhost:5000/socket.io/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**原因**：
- 前端运行在 `localhost:5173`
- 后端运行在 `localhost:3000` 或 `localhost:5000`
- 后端没有正确配置 CORS

**需要检查**：
1. 后端是否在运行？
2. 后端端口是多少？
3. 后端 CORS 配置是否正确？

---

## 🔧 修复步骤

### Step 1: 确认后端运行状态

**检查后端是否运行**：
```bash
# 在另一个终端
cd e:/windsurf_prj/doudizhu/backend
npm run dev
```

**预期输出**：
```
Server is running on port 3000
Socket.IO server is running
```

---

### Step 2: 检查后端 CORS 配置

**文件**：`backend/src/app.ts` 或 `backend/src/index.ts`

**应该有类似配置**：
```typescript
import cors from 'cors'

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}))

// Socket.IO CORS
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  }
})
```

---

### Step 3: 修改 Socket 连接 URL

**检查**：`frontend-spa/src/services/socket.ts`

**当前配置**：
```typescript
const baseUrl =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'  // ← 确认这个端口
    : window.location.origin
```

**如果后端在 5000 端口**：
```typescript
const baseUrl =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000'  // ← 改成 5000
    : window.location.origin
```

---

## 🧪 测试步骤

### 1. 清除浏览器缓存
- 按 `Ctrl + Shift + Delete`
- 选择"缓存的图片和文件"
- 点击"清除数据"

### 2. 硬刷新页面
- 按 `Ctrl + Shift + R`（Windows）
- 或 `Cmd + Shift + R`（Mac）

### 3. 重新测试登录
1. 访问 `http://localhost:5173/login`
2. 输入用户名
3. 点击登录
4. 观察是否还有无限循环

---

## 📊 预期结果

### 如果后端未运行
**现象**：
- Socket 连接失败
- 页面显示"未连接"
- 无法获取房间列表

**解决方案**：
```bash
# 启动后端
cd e:/windsurf_prj/doudizhu/backend
npm run dev
```

### 如果后端运行但 CORS 错误
**现象**：
- 控制台显示 CORS 错误
- Socket 无法连接

**解决方案**：
1. 检查后端 CORS 配置
2. 添加前端 URL 到允许列表
3. 重启后端服务器

### 如果一切正常
**现象**：
- ✅ 登录成功
- ✅ 跳转到房间列表
- ✅ Socket 连接成功
- ✅ 显示"已连接"状态
- ✅ 可以看到房间列表（或空列表）

---

## 🎯 快速诊断

### 检查清单

**前端**：
- [ ] 开发服务器运行在 5173
- [ ] 无编译错误
- [ ] Login 页面无限循环已修复

**后端**：
- [ ] 后端服务器正在运行
- [ ] 端口是 3000 或 5000
- [ ] CORS 配置包含 localhost:5173

**网络**：
- [ ] 浏览器控制台无 CORS 错误
- [ ] WebSocket 连接成功
- [ ] 只有 1 个 Socket 连接

---

## 💡 临时解决方案

### 如果无法修复 CORS

**方案 A：使用代理**

在 `vite.config.ts` 中添加：
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
```

**方案 B：禁用浏览器 CORS 检查（仅开发）**

启动 Chrome 时添加参数：
```bash
chrome.exe --disable-web-security --user-data-dir="C:/temp/chrome"
```

⚠️ **警告**：仅用于开发，不要用于生产环境！

---

## 📝 下一步

1. **立即执行**：
   - 清除浏览器缓存
   - 硬刷新页面
   - 测试登录功能

2. **如果还有问题**：
   - 截图控制台错误
   - 检查后端是否运行
   - 检查后端日志

3. **如果测试通过**：
   - 继续修复其他页面
   - 添加更多功能

---

现在请：
1. 清除浏览器缓存
2. 硬刷新页面（Ctrl + Shift + R）
3. 重新测试登录

如果还有问题，告诉我具体的错误信息！
