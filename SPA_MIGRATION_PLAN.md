# 斗地主 SPA 迁移方案

## 📋 项目概述

### 目标
将 `frontend` 多页面应用 (MPA) 迁移到 `frontend-spa` 单页面应用 (SPA)，**彻底解决 Socket.IO 多次连接问题**，并优化移动端体验。

### 核心问题
1. **Socket 多次连接**：MPA 每次页面跳转都创建新连接，导致：
   - 旧连接未断开，服务器维护多个无用连接
   - 认证状态混乱，`pageNavigationToken` 机制复杂
   - 连接状态闪烁（connected → disconnected → connected）
2. **移动端布局差**：固定宽度布局在小屏幕上显示不友好
3. **状态管理混乱**：通过 URL 参数传递 `userId`、`userName`、`playerAvatar`、`roomId`

### SPA 架构优势
- ✅ **全局单一 Socket 连接**：整个应用生命周期只有一个连接
- ✅ **无页面刷新**：路由切换不会断开 Socket
- ✅ **状态集中管理**：React Context + Redux 管理全局状态
- ✅ **更好的用户体验**：页面切换流畅，无白屏
- ✅ **响应式设计**：天然支持移动端适配

---

## 🎯 迁移范围

### Frontend 页面映射

| MPA 页面 | SPA 路由 | 状态 | 优先级 |
|---------|---------|------|--------|
| `/index.html` | `/` (Home) | ✅ 已有 | P0 |
| `/login/index.html` | `/login` | ✅ 已完成 | P0 |
| `/lobby/index.html` | `/rooms` | ⏳ 需完善 | P0 |
| `/room/room.html` | `/game/:roomId` | ⏳ 需完善 | P0 |
| `/profile/index.html` | `/profile` | ⏳ 需完善 | P1 |
| `/leaderboard/index.html` | `/leaderboard` | ❌ 未创建 | P1 |
| `/settlement/index.html` | `/settlement` | ❌ 未创建 | P1 |

### 功能模块清单

#### 已完成 ✅
- [x] Socket 全局管理器 (`src/services/socket.ts`)
- [x] 用户认证系统 (`src/context/AuthContext.tsx`)
- [x] 路由配置 (`src/router/index.tsx`)
- [x] 登录页面 (`src/pages/Login/index.tsx`)
- [x] 路由守卫 (`src/components/RequireAuth`)

#### 待完成 ⏳
- [ ] 房间列表页面（大厅）
- [ ] 游戏房间页面
- [ ] 游戏核心逻辑迁移
- [ ] 排行榜页面
- [ ] 个人中心页面
- [ ] 结算页面
- [ ] 聊天系统
- [ ] 音效系统

---

## 🔧 核心技术方案

### 1. Socket 连接管理（已实现 ✅）

**关键改进**：
```typescript
// ❌ MPA 方式：每个页面都创建新连接
// login.js
this.socketManager.connect(playerName, playerName, 'login');
window.location.href = '/lobby/index.html'; // 页面跳转，连接断开

// lobby.js  
this.socketManager.connect(this.currentPlayer, this.currentPlayer, 'lobby'); // 又创建新连接

// ✅ SPA 方式：全局单例，只连接一次
// 登录时连接
await globalSocket.connectAndWait({ userName, playerAvatar });

// 其他页面直接使用，无需重新连接
const socket = globalSocket.getSocket();
```

**实现细节**：
- 单例模式：`GlobalSocketManager.getInstance()`
- 自动重连：断线后自动恢复，无需手动处理
- 状态订阅：组件可监听连接状态变化
- 房间恢复：重连后自动重新加入房间

### 2. 认证流程简化

**MPA 复杂流程**：
```javascript
// 1. 登录页：连接 + 认证
socketManager.connect(userName) 
  → emit('authenticate')
  → 等待 'authenticated'
  → 生成 pageNavigationToken
  → 跳转 /lobby

// 2. 大厅页：重新连接 + 验证 token
socketManager.connect(userName)
  → 传递 pageNavigationToken
  → 后端验证 token
  → 允许连接

// 3. 房间页：又重新连接
socketManager.connect(userName)
  → 又要验证
  → ...
```

**SPA 简化流程**：
```typescript
// 1. 登录一次，全局有效
await login({ userName, playerAvatar });

// 2. 其他页面直接使用
const { user } = useAuth(); // user 始终可用
const socket = globalSocket.getSocket(); // socket 始终连接
```

### 3. 状态管理方案

**MPA 状态传递**：
```javascript
// 通过 URL 参数传递
const params = new URLSearchParams({
  playerName: encodeURIComponent(this.currentPlayer),
  playerAvatar: encodeURIComponent(this.playerAvatar),
  roomId: roomId
});
window.location.href = `/room/room.html?${params.toString()}`;

// 接收页面解析
const params = new URLSearchParams(window.location.search);
const playerName = decodeURIComponent(params.get('playerName'));
```

**SPA 状态管理**：
```typescript
// 1. 全局状态（用户信息）
const { user } = useAuth(); // { id, name, avatar }

// 2. 路由参数（房间 ID）
const { roomId } = useParams();

// 3. Redux 状态（游戏状态）
const gameState = useSelector(state => state.game);
```

---

## 📱 移动端优化方案

### 问题分析

**Frontend MPA 移动端问题**：
1. 固定宽度布局，小屏幕显示不全
2. 按钮过小，触摸困难
3. 扑克牌显示过密集
4. 横向滚动体验差

### 响应式设计原则

```typescript
// 1. 使用 Ant Design 栅格系统
<Row gutter={[16, 16]}>
  <Col xs={24} sm={12} md={8} lg={6}>
    {/* 手机全宽，平板半宽，桌面1/3宽 */}
  </Col>
</Row>

// 2. 使用相对单位
const styles = {
  fontSize: 'clamp(14px, 2vw, 18px)', // 自适应字体
  padding: 'clamp(10px, 2vw, 20px)',  // 自适应间距
};

// 3. 媒体查询
const isMobile = window.innerWidth < 768;
```

### 游戏房间移动端布局

```
┌─────────────────────────┐
│  房间信息 + 返回按钮      │ ← 顶部固定
├─────────────────────────┤
│                         │
│   对手玩家区域           │ ← 上方玩家
│   (头像 + 手牌数)        │
│                         │
├─────────────────────────┤
│                         │
│   游戏区域               │ ← 中央出牌区
│   (已出的牌)            │
│                         │
├─────────────────────────┤
│                         │
│   我的手牌               │ ← 可滑动选择
│   (横向滚动)            │
│                         │
├─────────────────────────┤
│ [出牌] [不要] [提示]     │ ← 底部操作栏
└─────────────────────────┘
```

---

## 🚀 迁移实施步骤

### Phase 1: 房间列表页（大厅）- 本周

**目标**：完成房间列表功能，替代 `lobby/index.html`

**任务清单**：
- [ ] 创建房间列表 UI（响应式卡片布局）
- [ ] 实现获取房间列表功能
- [ ] 实现创建房间功能
- [ ] 实现加入房间功能
- [ ] 实现房间实时更新
- [ ] 添加加载状态和错误处理
- [ ] 移动端适配测试

**参考文件**：
- `frontend/public/lobby/js/lobby.js` (业务逻辑)
- `frontend/public/lobby/index.html` (UI 结构)
- `frontend/public/lobby/css/lobby.css` (样式参考)

### Phase 2: 游戏房间页 - 下周

**目标**：完成游戏核心功能

**任务清单**：
- [ ] 创建游戏房间 UI
- [ ] 迁移游戏逻辑（出牌、判断、提示）
- [ ] 实现玩家状态同步
- [ ] 实现聊天功能
- [ ] 实现音效系统
- [ ] 断线重连游戏状态恢复
- [ ] 移动端手势操作

**参考文件**：
- `frontend/public/room/js/room-simple.js` (核心逻辑)
- `frontend/public/room/js/game-logic.js` (游戏规则)
- `frontend/public/room/js/ui-manager.js` (UI 管理)

### Phase 3: 辅助页面

**任务清单**：
- [ ] 排行榜页面
- [ ] 个人中心页面
- [ ] 游戏结算页面
- [ ] 反馈页面

### Phase 4: 优化与测试

**任务清单**：
- [ ] 性能优化（代码分割、懒加载）
- [ ] 移动端真机测试
- [ ] Socket 连接稳定性测试
- [ ] 多人游戏压力测试
- [ ] 用户体验优化

---

## 💡 优化建议

### 1. Socket 连接优化

**建议**：添加连接状态指示器
```typescript
// 在顶部导航栏显示连接状态
const ConnectionStatus = () => {
  const [status, setStatus] = useState(globalSocket.getStatus());
  
  useEffect(() => {
    return globalSocket.subscribeStatus(setStatus);
  }, []);
  
  return (
    <Badge 
      status={status.connected ? 'success' : 'error'} 
      text={status.connected ? '已连接' : '连接中...'}
    />
  );
};
```

### 2. 游戏状态持久化

**建议**：使用 Redux Persist 保存游戏状态
```typescript
// 用户刷新页面后，游戏状态不丢失
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

const persistConfig = {
  key: 'game',
  storage,
  whitelist: ['currentRoom', 'gameState'] // 只持久化部分状态
};
```

### 3. 错误边界

**建议**：添加全局错误边界，防止崩溃
```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### 4. 离线提示

**建议**：检测网络状态，提示用户
```typescript
useEffect(() => {
  const handleOffline = () => message.warning('网络已断开');
  const handleOnline = () => message.success('网络已恢复');
  
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  
  return () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
  };
}, []);
```

### 5. 性能监控

**建议**：添加性能监控
```typescript
// 监控 Socket 事件处理时间
socket.on('game_update', (data) => {
  const start = performance.now();
  handleGameUpdate(data);
  const duration = performance.now() - start;
  if (duration > 100) {
    console.warn(`游戏更新处理耗时: ${duration}ms`);
  }
});
```

---

## 🧪 测试计划

### 1. Socket 连接测试（最重要）

**测试目标**：确保全局只有一个 Socket 连接

**测试步骤**：
1. 打开浏览器开发者工具 → Network → WS (WebSocket)
2. 登录系统
3. 在各个页面间切换（大厅 → 房间 → 个人中心 → 排行榜）
4. **预期结果**：始终只有 **1 个** WebSocket 连接

**验证点**：
- ✅ 页面切换时，连接不断开
- ✅ 无新的连接创建
- ✅ 连接状态始终为 `connected`
- ✅ Socket ID 保持不变

### 2. 断线重连测试

**测试步骤**：
1. 进入游戏房间
2. 断开网络（飞行模式或关闭 WiFi）
3. 等待 5 秒
4. 恢复网络

**预期结果**：
- ✅ 显示"正在重连..."提示
- ✅ 自动重连成功
- ✅ 游戏状态恢复
- ✅ 自动重新加入房间

### 3. 移动端适配测试

**测试设备**：
- iPhone SE (375px)
- iPhone 14 (390px)
- iPad (768px)
- Android 手机

**测试项**：
- [ ] 布局不错位
- [ ] 按钮可点击（最小 44x44px）
- [ ] 文字清晰可读
- [ ] 横竖屏切换正常
- [ ] 触摸操作流畅

### 4. 多人游戏测试

**测试步骤**：
1. 打开 3 个浏览器标签页
2. 分别登录 3 个不同用户
3. 创建房间并开始游戏
4. 测试完整游戏流程

**验证点**：
- ✅ 玩家状态同步
- ✅ 出牌动作实时更新
- ✅ 游戏结算正确
- ✅ 无状态冲突

---

## ⚠️ 重要注意事项

### 1. 不要修改 frontend 文件夹
```
❌ 禁止：修改 frontend/ 下的任何文件
✅ 允许：查看 frontend/ 作为参考
✅ 允许：复制逻辑到 frontend-spa/
```

### 2. 保持功能一致性
- 游戏规则不变
- 操作流程不变
- 只改架构和 UI

### 3. Socket 连接检查
每次提交代码前，必须检查：
```bash
# 打开浏览器控制台，运行：
console.log('Socket 连接数:', 
  performance.getEntriesByType('resource')
    .filter(r => r.name.includes('socket.io')).length
);
# 必须输出：1
```

### 4. 渐进式迁移
- 一个页面一个页面迁移
- 每个页面迁移后充分测试
- 确保旧功能正常后再迁移新功能

---

## 📊 进度追踪

### 当前状态
```
总体进度: ████░░░░░░ 40%

✅ 基础架构   100%  (Socket + Auth + Router)
⏳ 房间列表    20%  (UI 框架已有，功能待完善)
⏳ 游戏房间    10%  (UI 框架已有，逻辑待迁移)
❌ 排行榜       0%
❌ 个人中心     0%
❌ 结算页面     0%
```

### 下一步行动
1. **立即开始**：完善房间列表页面
2. **本周目标**：完成大厅所有功能
3. **下周目标**：完成游戏房间核心逻辑

---

## 🎯 成功标准

### 技术指标
- ✅ 全局只有 1 个 Socket 连接
- ✅ 页面切换无白屏，< 100ms
- ✅ 移动端布局完美适配
- ✅ 断线重连成功率 > 95%

### 用户体验
- ✅ 操作流畅，无卡顿
- ✅ 加载状态清晰
- ✅ 错误提示友好
- ✅ 移动端触摸友好

### 代码质量
- ✅ TypeScript 类型完整
- ✅ 组件可复用
- ✅ 代码注释清晰
- ✅ 无 console.error

---

## 📚 参考资料

### 关键文件对照表

| 功能 | Frontend (MPA) | Frontend-SPA (SPA) |
|------|----------------|-------------------|
| Socket 管理 | `js/global-socket.js` | `src/services/socket.ts` ✅ |
| 用户认证 | 各页面独立处理 | `src/context/AuthContext.tsx` ✅ |
| 登录逻辑 | `login/js/login.js` | `src/pages/Login/index.tsx` ✅ |
| 大厅逻辑 | `lobby/js/lobby.js` | `src/pages/RoomList/index.tsx` ⏳ |
| 游戏逻辑 | `room/js/room-simple.js` | `src/pages/GameRoom/index.tsx` ⏳ |
| UI 管理 | `room/js/ui-manager.js` | 待创建 ❌ |
| 游戏规则 | `room/js/game-logic.js` | 待创建 ❌ |

### Socket 事件对照表

| 事件名 | 方向 | 用途 | 实现状态 |
|--------|------|------|---------|
| `authenticate` | C→S | 用户认证 | ✅ |
| `authenticated` | S→C | 认证成功 | ✅ |
| `auth_failed` | S→C | 认证失败 | ✅ |
| `get_rooms_list` | C→S | 获取房间列表 | ✅ |
| `rooms_list` | S→C | 返回房间列表 | ✅ |
| `join_game` | C→S | 加入房间 | ✅ |
| `join_game_success` | S→C | 加入成功 | ✅ |
| `join_game_failed` | S→C | 加入失败 | ✅ |
| `leave_game` | C→S | 离开房间 | ✅ |
| `player_joined` | S→C | 玩家加入 | ⏳ |
| `player_left` | S→C | 玩家离开 | ⏳ |
| `game_start` | S→C | 游戏开始 | ⏳ |
| `game_update` | S→C | 游戏状态更新 | ⏳ |
| `game_over` | S→C | 游戏结束 | ⏳ |

---

## 💬 讨论问题

在开始实施前，我们需要讨论以下问题：

### 1. UI 框架选择
**当前**：使用 Ant Design
**问题**：Ant Design 组件较重，移动端性能可能不佳
**建议**：
- 保持 Ant Design（快速开发）
- 或切换到 Ant Design Mobile（更适合移动端）
- 或使用 Tailwind CSS（更轻量）

**你的选择**：？

### 2. 游戏状态管理
**当前**：只有 AuthContext
**问题**：游戏状态复杂，需要更强大的状态管理
**建议**：
- 使用 Redux Toolkit（已安装，功能强大）
- 或使用 Zustand（更轻量）
- 或继续用 Context（简单场景够用）

**你的选择**：？

### 3. 移动端优先级
**问题**：是否需要先完成桌面版，再适配移动端？
**建议**：
- 方案 A：移动优先，从小屏幕开始设计
- 方案 B：桌面优先，后期适配移动端
- 方案 C：同步开发，响应式设计

**你的选择**：？

### 4. 音效和动画
**问题**：是否需要迁移音效和动画？
**当前**：frontend 有音效文件和动画效果
**建议**：
- 先完成核心功能，后期添加
- 或同步迁移，保持体验一致

**你的选择**：？

---

准备好开始迁移了吗？我们可以从**房间列表页面**开始！
