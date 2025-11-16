import { io, Socket } from 'socket.io-client'

export interface SocketStatus {
  connected: boolean
  reconnecting: boolean
  attempts: number
  socketId: string | null
}

export interface RoomSummary {
  id: string
  name: string
  players: number | any[] // 可能是数量或玩家数组
  maxPlayers: number
  playerList?: any[] // 玩家列表（如果有）
}

export interface JoinGamePayload {
  roomId: string
  userId?: string
  playerName?: string
  playerAvatar?: string
}

export interface ConnectOptions {
  userName: string
  userId?: string
  htmlName?: string
  playerAvatar?: string
}

type StatusListener = (status: SocketStatus) => void

class GlobalSocketManager {
  private static instance: GlobalSocketManager | null = null

  private socket: Socket | null = null
  private isConnected = false
  private userName: string | null = null
  private userId: string | null = null
  private sessionId: string | null = null // 会话标识，每次登录生成
  private playerAvatar: string | null = null
  private currentRoomId: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private isReconnecting = false
  private statusListeners = new Set<StatusListener>()

  private constructor() {}

  static getInstance() {
    if (!GlobalSocketManager.instance) {
      GlobalSocketManager.instance = new GlobalSocketManager()
    }
    return GlobalSocketManager.instance
  }

  getStatus(): SocketStatus {
    return {
      connected: this.isConnected,
      reconnecting: this.isReconnecting,
      attempts: this.reconnectAttempts,
      socketId: this.socket?.id ?? null,
    }
  }

  subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener)
    // 订阅时立即推送一次当前状态，方便 UI 立刻显示
    listener(this.getStatus())
    return () => this.statusListeners.delete(listener)
  }

  private notifyStatus() {
    const status = this.getStatus()
    this.statusListeners.forEach((listener) => listener(status))
  }

  private ensureUser(options?: ConnectOptions) {
    if (options?.userName) {
      // 生成唯一的会话 ID（时间戳 + 随机字符串）
      this.sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      this.userName = options.userName
      // userId 使用 userName 作为唯一标识
      this.userId =  options.userName
      this.playerAvatar = options.playerAvatar ?? this.playerAvatar ?? '👑'
      
      // 仅存储当前会话信息，不用于自动登录
      sessionStorage.setItem('sessionId', this.sessionId)
      sessionStorage.setItem('userId', this.userId)  // 保存 userId
      sessionStorage.setItem('userName', options.userName)
      sessionStorage.setItem('playerAvatar', this.playerAvatar)
    } else {
      // SPA 架构不应该自动从缓存恢复用户，必须重新登录
      throw new Error('缺少用户信息，请重新登录')
    }
  }

  connect(options?: ConnectOptions) {
    this.ensureUser(options)

    // SPA 架构：如果已有连接，直接返回（不重复连接）
    if (this.socket && this.socket.connected) {
      console.log('🔄 Socket 已连接，复用现有连接')
      return this.socket
    }

    // 如果有旧连接但未连接，清理后重新连接
    if (this.socket) {
      console.log('🔄 清理旧的 Socket 连接')
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }

    const baseUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin

    const pageNavigationToken = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    this.socket = io(baseUrl, {
      path: '/api/socket.io',
      auth: {
        userId: this.userId, // 使用 sessionId 作为唯一标识
        userName: this.userName,
        sessionId: this.sessionId, // 传递会话 ID
        htmlName: options?.htmlName ?? 'spa',
        pageNavigationToken,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
    })

    this.setupGlobalListeners()
    return this.socket
  }

  async connectAndWait(options: ConnectOptions) {
    const socket = this.connect(options)

    if (socket.connected) {
      return socket
    }

    return new Promise<Socket>((resolve, reject) => {
      const handleConnect = () => {
        cleanup()
        resolve(socket)
      }

      const handleError = (error: Error) => {
        cleanup()
        reject(error)
      }

      const handleAuthFailed = (data: { message?: string }) => {
        cleanup()
        reject(new Error(data.message ?? '认证失败'))
      }

      const cleanup = () => {
        socket.off('connect', handleConnect)
        socket.off('connect_error', handleError)
        socket.off('auth_failed', handleAuthFailed)
      }

      socket.once('connect', handleConnect)
      socket.once('connect_error', handleError)
      socket.once('auth_failed', handleAuthFailed)
    })
  }

  private setupGlobalListeners() {
    const socket = this.socket
    if (!socket) {
      return
    }

    socket.on('connect', () => {
      this.isConnected = true
      this.isReconnecting = false
      this.reconnectAttempts = 0
      this.notifyStatus()
    })

    socket.on('disconnect', () => {
      this.isConnected = false
      this.isReconnecting = false
      this.reconnectAttempts = 0
      this.socket = null
      this.notifyStatus()
    })

    socket.on('reconnect', () => {
      this.isConnected = true
      this.isReconnecting = false
      this.reconnectAttempts = 0
      this.notifyStatus()
      if (this.currentRoomId) {
        setTimeout(() => this.rejoinRoom(this.currentRoomId!), 500)
      }
    })

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.isReconnecting = true
      this.reconnectAttempts = attemptNumber
      this.notifyStatus()
    })

    socket.on('reconnect_failed', () => {
      this.isReconnecting = false
      this.notifyStatus()
    })
  }

  async requestRoomList(): Promise<RoomSummary[]> {
    const socket = this.socket
    if (!socket) {
      throw new Error('Socket 未连接')
    }

    return new Promise<RoomSummary[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('rooms_list', handleRooms)
        reject(new Error('获取房间列表超时'))
      }, 5000)

      const handleRooms = (data: { success: boolean; rooms?: RoomSummary[]; error?: string }) => {
        clearTimeout(timeout)
        socket.off('rooms_list', handleRooms)
        if (data.success && data.rooms) {
          resolve(data.rooms)
        } else {
          reject(new Error(data.error ?? '获取房间列表失败'))
        }
      }

      socket.once('rooms_list', handleRooms)
      socket.emit('get_rooms_list')
    })
  }

  joinGame(payload: JoinGamePayload, withAck = false) {
    const socket = this.socket
    if (!socket || !this.isConnected) {
      throw new Error('Socket 未连接')
    }

    const userId = payload.userId ?? this.userId
    const playerName = payload.playerName ?? this.userName
    const playerAvatar = payload.playerAvatar ?? this.playerAvatar ?? '👑'

    const join = () => {
      socket.emit('join_game', {
        roomId: payload.roomId,
        userId,
        playerName,
        playerAvatar,
      })
      this.currentRoomId = payload.roomId
    }

    if (!withAck) {
      join()
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('join_game_success', handleSuccess)
        socket.off('join_game_failed', handleFailed)
        reject(new Error('加入房间超时'))
      }, 5000)

      const cleanup = () => {
        clearTimeout(timeout)
        socket.off('join_game_success', handleSuccess)
        socket.off('join_game_failed', handleFailed)
      }

      const handleSuccess = (data: { room: { id: string } }) => {
        cleanup()
        this.currentRoomId = data.room?.id ?? payload.roomId
        resolve()
      }

      const handleFailed = (data: { message?: string }) => {
        cleanup()
        reject(new Error(data.message ?? '加入房间失败'))
      }

      socket.once('join_game_success', handleSuccess)
      socket.once('join_game_failed', handleFailed)
      join()
    })
  }

  rejoinRoom(roomId: string) {
    if (!this.socket || !this.isConnected) {
      return
    }
    this.joinGame({ roomId })
  }

  leaveGame(roomId: string) {
    if (!this.socket || !this.isConnected) {
      return
    }
    this.socket.emit('leave_game', {
      roomId,
      userId: this.userId,
    })
    this.currentRoomId = null
  }

  getSocket() {
    return this.socket
  }

  getUser() {
    if (!this.userName || !this.userId) {
      return null
    }
    return {
      id: this.userId,
      name: this.userName,
      avatar: this.playerAvatar ?? '👑',
    }
  }

  clearAuth() {
    // 清除会话存储
    sessionStorage.removeItem('sessionId')
    sessionStorage.removeItem('userId')  // 清除 userId
    sessionStorage.removeItem('userName')
    sessionStorage.removeItem('playerAvatar')
    this.currentRoomId = null
    this.userId = null
    this.userName = null
    this.sessionId = null
    this.playerAvatar = null
    this.disconnect()
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
    this.isReconnecting = false
    this.reconnectAttempts = 0
    this.notifyStatus()
  }
}

export const globalSocket = GlobalSocketManager.getInstance()
