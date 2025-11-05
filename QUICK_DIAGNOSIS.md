# 快速诊断

## 🔍 当前状态

### 已修复
- ✅ Login 页面无限循环

### 待解决
- ❌ CORS 错误
- ❌ 后端连接问题

---

## 📋 诊断步骤

### 1. 检查后端是否运行

**打开新终端**，运行：
```bash
cd e:/windsurf_prj/doudizhu/backend
npm run dev
```

**查看输出**，应该看到类似：
```
Server is running on port 3000
或
Server is running on port 5000
```

**记下端口号！**

---

### 2. 修改前端 Socket 配置

**如果后端在 3000 端口**：
- 无需修改

**如果后端在 5000 端口**：
- 需要修改 `src/services/socket.ts`
- 将 `http://localhost:3000` 改为 `http://localhost:5000`

---

### 3. 清除缓存并重试

1. **清除浏览器缓存**
   - `Ctrl + Shift + Delete`
   - 选择"缓存"
   - 清除

2. **硬刷新**
   - `Ctrl + Shift + R`

3. **重新登录**
   - 访问 `http://localhost:5173/login`
   - 输入用户名
   - 登录

---

## 🚨 如果后端未运行

**现象**：
```
net::ERR_CONNECTION_REFUSED
或
net::ERR_FAILED
```

**解决方案**：
```bash
# 启动后端
cd e:/windsurf_prj/doudizhu/backend
npm install  # 如果是第一次运行
npm run dev
```

---

## 📊 预期结果

### 成功标志
- ✅ 控制台无 CORS 错误
- ✅ WebSocket 连接成功
- ✅ 显示"已连接"状态
- ✅ 可以看到房间列表页面

### 失败标志
- ❌ CORS policy 错误
- ❌ Connection refused
- ❌ 页面白屏或错误

---

## 💬 需要你提供的信息

请告诉我：

1. **后端是否在运行？**
   - [ ] 是
   - [ ] 否

2. **后端运行在哪个端口？**
   - [ ] 3000
   - [ ] 5000
   - [ ] 其他：_____

3. **清除缓存后是否还有 CORS 错误？**
   - [ ] 是
   - [ ] 否

4. **控制台显示什么错误？**
   - 截图或复制错误信息

---

根据你的回答，我会提供具体的修复方案！
