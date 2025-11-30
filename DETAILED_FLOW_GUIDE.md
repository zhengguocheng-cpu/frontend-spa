# Frontend-SPA 详细流程指南

> 从代码层面深入理解每个功能的实现细节

## 📚 目录

1. [页面流程详解](#页面流程详解)
2. [Socket 事件详解](#socket-事件详解)
3. [游戏完整流程](#游戏完整流程)
4. [关键代码解析](#关键代码解析)

---

## 页面流程详解

### 1. 首页 (Home)

**路径**: `/`

**功能**:
- 展示游戏介绍
- 提供登录/注册入口

**代码位置**: `src/pages/Home/index.tsx`

**关键代码**:

```tsx
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 如果已登录，直接跳转到房间列表
  useEffect(() => {
    if (user) {
      navigate('/rooms')
    }
  }, [user, navigate])

  return (
    <div className="home-container">
      <h1>斗地主</h1>
      <Button onClick={() => navigate('/login')}>登录</Button>
      <Button onClick={() => navigate('/register')}>注册</Button>
    </div>
  )
}
```

---

### 2. 登录页 (Login)

**路径**: `/login`

**功能**:
- 用户输入用户名
- 连接 Socket 服务器
- 保存用户信息
- 跳转到房间列表

**代码位置**: `src/pages/Login/index.tsx`

**完整流程**:

```tsx
export default function Login() {
  const [userName, setUserName] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!userName.trim()) {
      Toast.show('请输入用户名')
      return
    }

    try {
      // 1. 调用 AuthContext 的 login 方法
      await login({ userName })
      
      // 2. 登录成功，跳转到房间列表
      Toast.show({ icon: 'success', content: '登录成功' })
      navigate('/rooms')
    } catch (error) {
      Toast.show({ icon: 'fail', content: '登录失败' })
    }
  }

  return (
    <div className="login-container">
      <Input
        placeholder="请输入用户名"
        value={userName}
        onChange={setUserName}
      />
      <Button onClick={handleLogin}>登录</Button>
    </div>
  )
}
```

**背后发生的事情**:

1. **AuthContext.login()**:
```tsx
const login = async (options: ConnectOptions) => {
  setLoading(true)
  try {
    // 连接 Socket
    const result = await globalSocket.connect(options)
    
    // 创建用户对象
    const authUser = {
      id: result.userId,
      name: result.userName,
      avatar: result.playerAvatar || '👑',
    }
    
    // 保存到 sessionStorage
    sessionStorage.setItem('userId', authUser.id)
    sessionStorage.setItem('userName', authUser.name)
    sessionStorage.setItem('playerAvatar', authUser.avatar)
    
    // 更新状态
    setUser(authUser)
    return authUser
  } finally {
    setLoading(false)
  }
}
```

2. **globalSocket.connect()**:
```typescript
async connect(options: ConnectOptions) {
  // 生成唯一会话 ID
  this.sessionId = `${Date.now()}_${Math.random()}`
  this.userName = options.userName
  this.userId = options.userId || this.sessionId
  
  // 创建 Socket 连接
  this.socket = io('http://localhost:3000', {
    auth: {
      userName: this.userName,
      userId: this.userId,
    },
  })
  
  // 等待连接成功
  return new Promise((resolve, reject) => {
    this.socket!.on('connect_success', (data) => {
      this.isConnected = true
      resolve(data)
    })
    
    this.socket!.on('connect_error', (error) => {
      reject(error)
    })
  })
}
```

3. **后端处理**:
```typescript
// backend/src/services/socket/AuthHandler.ts
socket.on('connection', (socket) => {
  const { userName, userId } = socket.handshake.auth
  
  // 保存用户信息
  socket.data.userName = userName
  socket.data.userId = userId
  
  // 发送连接成功事件
  socket.emit('connect_success', {
    userId,
    userName,
    socketId: socket.id,
  })
})
```

---

### 3. 房间列表页 (RoomList)

**路径**: `/rooms`

**功能**:
- 显示所有房间
- 创建新房间
- 加入房间
- 实时更新房间状态

**代码位置**: `src/pages/RoomList/index.tsx`

**核心代码**:

```tsx
export default function RoomList() {
  const dispatch = useAppDispatch()
  const rooms = useAppSelector((state) => state.room.rooms)
  const navigate = useNavigate()

  // 1. 组件挂载时获取房间列表
  useEffect(() => {
    globalSocket.emit('get_rooms')
    
    // 监听房间列表更新
    const handleRoomList = (roomList: RoomSummary[]) => {
      dispatch(setRooms(roomList))
    }
    
    globalSocket.on('room_list', handleRoomList)
    
    return () => {
      globalSocket.off('room_list', handleRoomList)
    }
  }, [dispatch])

  // 2. 创建房间
  const handleCreateRoom = (roomName: string) => {
    globalSocket.emit('create_room', { roomName })
    
    // 监听房间创建成功
    globalSocket.once('room_created', (data) => {
      Toast.show('房间创建成功')
      navigate(`/game/${data.roomId}`)
    })
  }

  // 3. 加入房间
  const handleJoinRoom = (roomId: string) => {
    navigate(`/game/${roomId}`)
  }

  return (
    <div className="room-list-container">
      <Button onClick={() => setShowCreateModal(true)}>
        创建房间
      </Button>
      
      <div className="room-grid">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onJoin={() => handleJoinRoom(room.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

**房间卡片组件**:

```tsx
function RoomCard({ room, onJoin }) {
  return (
    <div className="room-card">
      <h3>{room.name}</h3>
      <p>玩家: {room.players}/{room.maxPlayers}</p>
      <Button
        onClick={onJoin}
        disabled={room.players >= room.maxPlayers}
      >
        {room.players >= room.maxPlayers ? '房间已满' : '加入'}
      </Button>
    </div>
  )
}
```

---

### 4. 游戏房间页 (GameRoom)

**路径**: `/game/:roomId`

**功能**:
- 显示游戏桌面
- 显示玩家信息
- 准备/开始游戏
- 叫地主
- 出牌
- 游戏结算

**代码位置**: `src/pages/GameRoom/index.tsx`

这是整个项目最复杂的页面，包含完整的游戏流程。

#### 组件挂载流程

```tsx
export default function GameRoom() {
  const { roomId } = useParams()
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const gameState = useAppSelector((state) => state.game)

  // 1. 组件挂载时加入房间
  useEffect(() => {
    if (!roomId || !user) return

    const joinRoom = async () => {
      try {
        await globalSocket.joinRoom(roomId)
        console.log('✅ 成功加入房间:', roomId)
      } catch (error) {
        console.error('❌ 加入房间失败:', error)
        Toast.show('加入房间失败')
        navigate('/rooms')
      }
    }

    joinRoom()

    // 2. 组件卸载时离开房间
    return () => {
      globalSocket.leaveRoom()
    }
  }, [roomId, user])

  // 3. 监听游戏事件
  useEffect(() => {
    // 玩家加入
    globalSocket.on('player_joined', handlePlayerJoined)
    
    // 玩家离开
    globalSocket.on('player_left', handlePlayerLeft)
    
    // 玩家准备
    globalSocket.on('player_ready', handlePlayerReady)
    
    // 游戏开始
    globalSocket.on('game_start', handleGameStart)
    
    // 发牌
    globalSocket.on('deal_cards', handleDealCards)
    
    // 叫地主开始
    globalSocket.on('bidding_start', handleBiddingStart)
    
    // 玩家叫地主
    globalSocket.on('bid_made', handleBidMade)
    
    // 地主确定
    globalSocket.on('landlord_determined', handleLandlordDetermined)
    
    // 轮到出牌
    globalSocket.on('turn_to_play', handleTurnToPlay)
    
    // 玩家出牌
    globalSocket.on('cards_played', handleCardsPlayed)
    
    // 玩家不出
    globalSocket.on('player_passed', handlePlayerPassed)
    
    // 游戏结束
    globalSocket.on('game_over', handleGameOver)

    return () => {
      // 清理所有监听
      globalSocket.off('player_joined')
      globalSocket.off('player_left')
      // ... 其他事件
    }
  }, [])
}
```

---

## Socket 事件详解

### 1. 连接相关事件

#### connect_with_name (客户端 → 服务端)

```typescript
globalSocket.emit('connect_with_name', {
  userName: 'player1',
  userId: 'xxx',
})
```

#### connect_success (服务端 → 客户端)

```typescript
globalSocket.on('connect_success', (data) => {
  console.log('连接成功:', data)
  // data: { userId, userName, socketId }
})
```

### 2. 房间相关事件

#### get_rooms (客户端 → 服务端)

```typescript
globalSocket.emit('get_rooms')
```

#### room_list (服务端 → 客户端)

```typescript
globalSocket.on('room_list', (rooms) => {
  // rooms: RoomSummary[]
  dispatch(setRooms(rooms))
})
```

#### create_room (客户端 → 服务端)

```typescript
globalSocket.emit('create_room', {
  roomName: '房间1',
})
```

#### room_created (服务端 → 客户端)

```typescript
globalSocket.on('room_created', (data) => {
  // data: { roomId, roomName }
  navigate(`/game/${data.roomId}`)
})
```

#### join_game (客户端 → 服务端)

```typescript
globalSocket.emit('join_game', {
  roomId: 'xxx',
  playerName: 'player1',
  playerAvatar: '👑',
})
```

#### player_joined (服务端 → 所有房间玩家)

```typescript
globalSocket.on('player_joined', (data) => {
  // data: { player, players }
  dispatch(updatePlayers(data.players))
})
```

### 3. 游戏流程事件

#### ready (客户端 → 服务端)

```typescript
globalSocket.emit('ready')
```

#### player_ready (服务端 → 所有房间玩家)

```typescript
globalSocket.on('player_ready', (data) => {
  // data: { playerId, playerName }
  dispatch(updatePlayerStatus({
    playerId: data.playerId,
    status: 'ready',
  }))
})
```

#### game_start (服务端 → 所有房间玩家)

```typescript
globalSocket.on('game_start', () => {
  dispatch(startGame())
  Toast.show('游戏开始！')
})
```

#### deal_cards (服务端 → 每个玩家)

```typescript
globalSocket.on('deal_cards', (data) => {
  // data: { cards, landlordCards }
  dispatch(initGame({
    myCards: data.cards,
    landlordCards: data.landlordCards,
  }))
})
```

#### bidding_start (服务端 → 所有房间玩家)

```typescript
globalSocket.on('bidding_start', (data) => {
  // data: { currentPlayer, timeLimit }
  setShowBiddingUI(true)
  setBiddingTimer(data.timeLimit)
})
```

#### bid (客户端 → 服务端)

```typescript
globalSocket.emit('bid', {
  bid: 1, // 0=不叫, 1=叫地主, 2=抢地主, 3=不抢
})
```

#### bid_made (服务端 → 所有房间玩家)

```typescript
globalSocket.on('bid_made', (data) => {
  // data: { playerId, playerName, bid }
  dispatch(addBid({
    playerId: data.playerId,
    bid: data.bid,
  }))
})
```

#### landlord_determined (服务端 → 所有房间玩家)

```typescript
globalSocket.on('landlord_determined', (data) => {
  // data: { landlordId, landlordCards }
  dispatch(setLandlord({
    landlordId: data.landlordId,
    landlordCards: data.landlordCards,
  }))
  setShowBiddingUI(false)
})
```

#### turn_to_play (服务端 → 所有房间玩家)

```typescript
globalSocket.on('turn_to_play', (data) => {
  // data: { playerId, isFirst, timeLimit }
  if (data.playerId === user.id) {
    setIsMyTurn(true)
    setCanPass(!data.isFirst)
    setTurnTimer(data.timeLimit)
  }
})
```

#### play_cards (客户端 → 服务端)

```typescript
globalSocket.emit('play_cards', {
  cards: ['♠3', '♥3', '♦3'],
})
```

#### cards_played (服务端 → 所有房间玩家)

```typescript
globalSocket.on('cards_played', (data) => {
  // data: { playerId, cards, cardsLeft }
  dispatch(playCardsAction({
    playerId: data.playerId,
    cards: data.cards,
  }))
})
```

#### pass (客户端 → 服务端)

```typescript
globalSocket.emit('pass')
```

#### player_passed (服务端 → 所有房间玩家)

```typescript
globalSocket.on('player_passed', (data) => {
  // data: { playerId, playerName }
  dispatch(passAction({ playerId: data.playerId }))
})
```

#### game_over (服务端 → 所有房间玩家)

```typescript
globalSocket.on('game_over', (data) => {
  // data: { winner, scores, isLandlordWin }
  dispatch(endGame({
    winner: data.winner,
    scores: data.scores,
  }))
  setShowSettlement(true)
})
```

---

## 游戏完整流程

### 阶段 1: 等待玩家 (waiting)

```
玩家 A 创建房间
    ↓
玩家 B 加入房间
    ↓
玩家 C 加入房间
    ↓
所有玩家点击"准备"
    ↓
后端检测到 3 人都准备
    ↓
广播 'game_start' 事件
```

### 阶段 2: 发牌 (dealing)

```
后端洗牌
    ↓
给每个玩家发 17 张牌
    ↓
留 3 张底牌
    ↓
发送 'deal_cards' 事件给每个玩家
    ↓
前端接收并显示手牌
    ↓
广播 'bidding_start' 事件
```

### 阶段 3: 叫地主 (bidding)

```
玩家 A 轮到叫地主
    ↓
玩家 A 选择"叫地主"或"不叫"
    ↓
发送 'bid' 事件
    ↓
后端广播 'bid_made' 事件
    ↓
轮到玩家 B
    ↓
... (重复直到确定地主)
    ↓
后端确定地主
    ↓
广播 'landlord_determined' 事件
    ↓
地主获得 3 张底牌
```

### 阶段 4: 出牌 (playing)

```
地主先出牌
    ↓
后端发送 'turn_to_play' 事件
    ↓
地主选择要出的牌
    ↓
点击"出牌"按钮
    ↓
发送 'play_cards' 事件
    ↓
后端验证牌型
    ↓
广播 'cards_played' 事件
    ↓
轮到下一个玩家
    ↓
玩家选择"出牌"或"不出"
    ↓
... (重复直到有人出完牌)
```

### 阶段 5: 游戏结束 (ended)

```
某个玩家出完所有牌
    ↓
后端计算分数
    ↓
广播 'game_over' 事件
    ↓
前端显示结算界面
    ↓
玩家点击"再来一局"
    ↓
重置游戏状态
    ↓
回到等待阶段
```

---

## 关键代码解析

### 1. 手牌动态遮挡计算

**问题**: 手牌数量不同时，如何自动调整卡牌间距？

**解决方案**: 根据容器宽度和牌数动态计算 `margin-left`

```typescript
useEffect(() => {
  const calculateCardOverlap = () => {
    const handSection = document.querySelector('.player-hand-section')
    const cards = document.querySelectorAll('.player-hand .card')
    
    if (!handSection || cards.length === 0) return
    
    const containerWidth = handSection.clientWidth  // 容器宽度
    const n = cards.length                          // 牌数
    const cardWidth = cards[0].clientWidth          // 单张牌宽度
    
    // 计算每张牌露出的宽度
    const visibleWidth = (containerWidth - cardWidth) / (n - 1)
    
    // 计算遮挡宽度（负数表示向左偏移）
    let overlap = visibleWidth - cardWidth
    
    // 限制遮挡范围
    const minOverlap = -cardWidth * 0.8  // 最多遮挡 80%
    const maxOverlap = -cardWidth * 0.2  // 最少遮挡 20%
    overlap = Math.max(minOverlap, Math.min(maxOverlap, overlap))
    
    // 应用到所有牌
    cards.forEach((card, index) => {
      if (index === 0) {
        (card as HTMLElement).style.marginLeft = '0'
      } else {
        (card as HTMLElement).style.marginLeft = `${overlap}px`
      }
    })
  }
  
  calculateCardOverlap()
  window.addEventListener('resize', calculateCardOverlap)
  
  return () => {
    window.removeEventListener('resize', calculateCardOverlap)
  }
}, [myCards])
```

### 2. 玩家位置计算（逆时针排列）

**问题**: 如何将 3 个玩家按逆时针排列在桌面上？

**解决方案**: 根据当前玩家索引计算其他玩家位置

```typescript
const getPlayerPositions = () => {
  if (!players || players.length === 0 || !user) {
    return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
  }

  // 找到当前玩家的索引
  const myIndex = players.findIndex(p => p.id === user.id)
  
  if (myIndex === -1) {
    return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
  }

  // 当前玩家（底部）
  const currentPlayer = players[myIndex]

  // 左侧玩家（逆时针下一位）
  const leftPlayer = players.length >= 2 
    ? players[(myIndex + 1) % players.length] 
    : null

  // 右侧玩家（逆时针再下一位）
  const rightPlayer = players.length >= 3 
    ? players[(myIndex + 2) % players.length] 
    : null

  return { leftPlayer, rightPlayer, currentPlayer }
}
```

**布局示例**:

```
        rightPlayer (上方右侧)
              
              
leftPlayer                    (桌面中心)
(上方左侧)
              
              
        currentPlayer (底部中间)
```

### 3. 卡牌选中逻辑

**问题**: 如何实现点击卡牌选中/取消选中？

**解决方案**: 使用 Redux 管理选中状态

```typescript
// Redux Slice
toggleCardSelection: (state, action: PayloadAction<string>) => {
  const card = action.payload
  const index = state.selectedCards.indexOf(card)
  
  if (index > -1) {
    // 已选中，取消选中
    state.selectedCards.splice(index, 1)
  } else {
    // 未选中，添加到选中列表
    state.selectedCards.push(card)
  }
}

// 组件中使用
const handleCardClick = (card: string) => {
  if (!isMyTurn) return  // 不是我的回合，不能选牌
  
  dispatch(toggleCardSelection(card))
}

// 渲染
<div
  className={`card ${selectedCards.includes(card) ? 'selected' : ''}`}
  onClick={() => handleCardClick(card)}
>
  {card}
</div>
```

**CSS 样式**:

```css
.card {
  transition: transform 0.2s;
}

.card.selected {
  transform: translateY(-25px);  /* 向上移动 */
}
```

### 4. 倒计时逻辑

**问题**: 如何实现出牌倒计时？

**解决方案**: 使用 `setInterval` 和 `useRef`

```typescript
const [turnTimer, setTurnTimer] = useState(0)
const turnTimerRef = useRef<NodeJS.Timeout | null>(null)

// 开始倒计时
const startTurnTimer = (seconds: number) => {
  setTurnTimer(seconds)
  
  // 清除旧的定时器
  if (turnTimerRef.current) {
    clearInterval(turnTimerRef.current)
  }
  
  // 创建新的定时器
  turnTimerRef.current = setInterval(() => {
    setTurnTimer((prev) => {
      if (prev <= 1) {
        // 时间到，自动不出
        clearInterval(turnTimerRef.current!)
        handlePass()
        return 0
      }
      return prev - 1
    })
  }, 1000)
}

// 清理定时器
useEffect(() => {
  return () => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
    }
  }
}, [])
```

---

**文档完成！** 🎉

这份详细流程指南涵盖了项目的每个页面、Socket 事件和关键代码实现，适合深入学习和理解项目细节。
