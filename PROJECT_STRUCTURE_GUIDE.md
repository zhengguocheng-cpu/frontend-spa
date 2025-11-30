# Frontend-SPA 项目结构详解

> 斗地主游戏前端单页应用（SPA）完整学习指南

## 📚 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [启动流程](#启动流程)
5. [架构设计](#架构设计)
6. [核心模块详解](#核心模块详解)

---

## 项目概述

### 项目定位

这是一个**斗地主游戏的单页应用（SPA）前端**，采用现代化的 React 技术栈，实现了：
- ✅ 用户登录/注册
- ✅ 房间列表浏览
- ✅ 游戏房间（完整游戏流程）
- ✅ 实时 Socket 通信
- ✅ 状态持久化
- ✅ 断线重连

### 与 frontend 的区别

| 特性 | frontend（多页面） | frontend-spa（单页面） |
|------|-------------------|----------------------|
| 架构 | 多个独立 HTML 页面 | React SPA |
| 路由 | 浏览器原生跳转 | React Router |
| 状态管理 | 全局变量 + localStorage | Redux Toolkit |
| Socket | 每个页面独立连接 | 全局单例共享 |
| 组件化 | 无 | React 组件 |
| 类型安全 | 无 | TypeScript |

---

## 技术栈

### 核心框架

```json
{
  "react": "^18.3.1",              // UI 框架
  "react-dom": "^18.3.1",          // DOM 渲染
  "react-router-dom": "^7.9.5",    // 路由管理
  "typescript": "~5.9.3",          // 类型系统
  "vite": "^7.1.7"                 // 构建工具
}
```

### 状态管理

```json
{
  "@reduxjs/toolkit": "^2.9.2",    // Redux 状态管理
  "react-redux": "^9.2.0"          // React-Redux 绑定
}
```

### UI 组件库

```json
{
  "antd": "^5.28.0",               // PC 端组件库
  "antd-mobile": "^5.41.1",        // 移动端组件库
  "@ant-design/icons": "^6.1.0"    // 图标库
}
```

### 通信

```json
{
  "socket.io-client": "^4.8.1",    // WebSocket 客户端
  "axios": "^1.13.1"               // HTTP 客户端
}
```

---

## 项目结构

```
frontend-spa/
├── src/
│   ├── pages/                 # 页面组件
│   │   ├── Home/             # 首页
│   │   ├── Login/            # 登录页
│   │   ├── RoomList/         # 房间列表
│   │   └── GameRoom/         # 游戏房间（核心）
│   │
│   ├── components/           # 公共组件
│   │   ├── layout/          # 布局组件
│   │   └── RequireAuth/     # 路由守卫
│   │
│   ├── context/             # React Context
│   │   └── AuthContext.tsx  # 认证上下文
│   │
│   ├── store/               # Redux 状态管理
│   │   ├── index.ts         # Store 配置
│   │   └── slices/          # 状态切片
│   │       ├── gameSlice.ts # 游戏状态
│   │       └── roomSlice.ts # 房间状态
│   │
│   ├── services/            # 服务层
│   │   └── socket.ts        # Socket 全局单例
│   │
│   ├── router/              # 路由配置
│   │   └── index.tsx        # 路由定义
│   │
│   ├── hooks/               # 自定义 Hooks
│   ├── types/               # TypeScript 类型
│   ├── App.tsx              # 根组件
│   └── main.tsx             # 应用入口
│
├── index.html               # HTML 模板
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
└── vite.config.ts           # Vite 配置
```

---

## 启动流程

### 1. 应用启动链路

```
index.html
    ↓
main.tsx (ReactDOM.createRoot)
    ↓
App.tsx (根组件)
    ↓
Provider 嵌套层
    ↓
Router (路由系统)
    ↓
页面组件
```

### 2. main.tsx (入口文件)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**作用**：
- 使用 `ReactDOM.createRoot` 创建 React 18 根节点
- 渲染 `<App />` 组件到 `#root` 元素
- `<React.StrictMode>` 开启严格模式检查

### 3. App.tsx (根组件)

```tsx
function App() {
  return (
    <Provider store={store}>           {/* Redux 状态管理 */}
      <ConfigProvider locale={zhCN}>   {/* UI 组件库配置 */}
        <AuthProvider>                 {/* 认证上下文 */}
          <Router />                   {/* 路由系统 */}
        </AuthProvider>
      </ConfigProvider>
    </Provider>
  )
}
```

**Provider 嵌套顺序**：
1. `<Provider store={store}>` - Redux 全局状态
2. `<ConfigProvider locale={zhCN}>` - UI 组件库中文配置
3. `<AuthProvider>` - 用户认证状态
4. `<Router />` - 路由系统

### 4. Router (路由配置)

```tsx
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/rooms', element: <RequireAuth><RoomList /></RequireAuth> },
  { path: '/game/:roomId', element: <RequireAuth><GameRoom /></RequireAuth> },
])
```

**特点**：
- 使用 `createBrowserRouter` 创建路由
- 使用 `<RequireAuth>` 保护需要登录的页面
- 使用 `lazy()` 实现代码分割和懒加载

---

## 架构设计

### 1. 整体架构图

```
┌─────────────────────────────────────────────┐
│           React Application                 │
│                                             │
│  ┌─────────────┐  ┌──────────────┐        │
│  │   Router    │  │  AuthContext │        │
│  └─────────────┘  └──────────────┘        │
│                                             │
│  ┌───────────────────────────────────┐    │
│  │      Redux Store (全局状态)        │    │
│  │  ┌──────────┐  ┌──────────┐      │    │
│  │  │gameSlice │  │roomSlice │      │    │
│  │  └──────────┘  └──────────┘      │    │
│  └───────────────────────────────────┘    │
│                                             │
│  ┌───────────────────────────────────┐    │
│  │    GlobalSocket (Socket 单例)     │    │
│  │    - 全局唯一连接                  │    │
│  │    - 事件监听管理                  │    │
│  │    - 自动重连                      │    │
│  └───────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                    ↕ WebSocket
┌─────────────────────────────────────────────┐
│           Backend Server                    │
│    Socket.IO Server + 游戏逻辑              │
└─────────────────────────────────────────────┘
```

### 2. 分层架构

```
展示层 (Presentation)
  ↓ Pages + Components
状态管理层 (State)
  ↓ Redux + Context
服务层 (Service)
  ↓ GlobalSocket + API
通信层 (Network)
  ↓ WebSocket + HTTP
```

### 3. 核心设计模式

#### 单例模式 - GlobalSocket

```typescript
class GlobalSocketManager {
  private static instance: GlobalSocketManager | null = null
  
  static getInstance() {
    if (!GlobalSocketManager.instance) {
      GlobalSocketManager.instance = new GlobalSocketManager()
    }
    return GlobalSocketManager.instance
  }
}

export const globalSocket = GlobalSocketManager.getInstance()
```

**优点**：
- 全局唯一 Socket 连接
- 避免多个页面创建多个连接
- 统一管理连接状态

#### 观察者模式 - 状态订阅

```typescript
subscribeStatus(listener: StatusListener) {
  this.statusListeners.add(listener)
  return () => this.statusListeners.delete(listener)
}

private notifyStatus() {
  this.statusListeners.forEach(listener => listener(this.getStatus()))
}
```

#### 高阶组件 - RequireAuth

```tsx
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" />
  
  return <>{children}</>
}
```

---

## 核心模块详解

### 1. 认证模块 (AuthContext)

**功能**：
- 管理用户登录状态
- 持久化用户信息 (sessionStorage)
- 自动重连 Socket
- 提供登录/登出方法

**核心代码**：

```tsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  
  const login = async (options) => {
    const result = await globalSocket.connect(options)
    sessionStorage.setItem('userId', result.userId)
    sessionStorage.setItem('userName', result.userName)
    setUser(result)
  }
  
  const logout = () => {
    globalSocket.disconnect()
    sessionStorage.clear()
    setUser(null)
  }
  
  return <AuthContext.Provider value={{ user, login, logout }}>
    {children}
  </AuthContext.Provider>
}
```

### 2. Socket 模块 (GlobalSocket)

**功能**：
- 全局单例 Socket 连接
- 自动重连机制
- 事件监听管理
- 房间管理

**核心方法**：

```typescript
class GlobalSocketManager {
  // 连接
  async connect(options: ConnectOptions)
  
  // 断开
  disconnect()
  
  // 重连
  async reconnect(options: ConnectOptions)
  
  // 加入房间
  async joinRoom(roomId: string)
  
  // 离开房间
  async leaveRoom()
  
  // 监听事件
  on(event: string, handler: Function)
  
  // 移除监听
  off(event: string, handler?: Function)
  
  // 发送事件
  emit(event: string, data?: any)
}
```

**重连机制**：

```typescript
private setupReconnection() {
  this.socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') return
    this.attemptReconnect()
  })
  
  this.socket.on('reconnect', () => {
    this.reconnectAttempts = 0
    this.isReconnecting = false
  })
}
```

### 3. 状态管理 (Redux)

#### gameSlice (游戏状态)

```typescript
interface GameState {
  gameStatus: 'waiting' | 'bidding' | 'playing' | 'ended'
  players: Player[]
  myCards: string[]
  selectedCards: string[]
  landlordId: string | null
  landlordCards: string[]
  currentPlayer: string | null
  lastPlayedCards: PlayedCards | null
}

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    initGame,              // 初始化游戏
    updatePlayers,         // 更新玩家列表
    startGame,             // 开始游戏
    setLandlord,           // 设置地主
    toggleCardSelection,   // 切换卡牌选中
    playCards,             // 出牌
    endGame,               // 结束游戏
  },
})
```

#### roomSlice (房间状态)

```typescript
interface RoomState {
  rooms: RoomSummary[]
  currentRoom: string | null
  loading: boolean
}

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setRooms,          // 设置房间列表
    addRoom,           // 添加房间
    updateRoom,        // 更新房间
    setCurrentRoom,    // 设置当前房间
  },
})
```

---

## 数据流转

### 1. 用户登录流程

```
用户输入用户名
    ↓
点击登录
    ↓
login() 方法
    ↓
globalSocket.connect()
    ↓
发送 'connect_with_name'
    ↓
后端返回用户信息
    ↓
保存到 sessionStorage
    ↓
更新 AuthContext
    ↓
跳转到房间列表
```

### 2. 加入房间流程

```
点击房间卡片
    ↓
navigate(`/game/${roomId}`)
    ↓
GameRoom 组件挂载
    ↓
globalSocket.joinRoom(roomId)
    ↓
发送 'join_game'
    ↓
后端广播 'player_joined'
    ↓
更新 Redux gameSlice
    ↓
渲染游戏界面
```

### 3. 游戏流程

```
等待玩家 (waiting)
    ↓
所有玩家准备
    ↓
发牌 (dealing)
    ↓
叫地主 (bidding)
    ↓
确定地主
    ↓
出牌阶段 (playing)
    ↓
游戏结束 (ended)
    ↓
显示结算
```

---

## 开发指南

### 启动项目

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 项目规范

1. **组件命名**：PascalCase (如 `GameRoom.tsx`)
2. **文件命名**：camelCase (如 `gameSlice.ts`)
3. **CSS 命名**：kebab-case (如 `.game-room`)
4. **类型定义**：使用 TypeScript 接口

### 调试技巧

1. **查看 Redux 状态**：安装 Redux DevTools
2. **查看 Socket 事件**：在 `socket.ts` 中添加日志
3. **查看网络请求**：使用浏览器开发者工具

---

**文档完成！** 🎉

这份文档涵盖了项目的核心结构、启动流程、架构设计和核心模块，适合小白学习和理解整个项目。
