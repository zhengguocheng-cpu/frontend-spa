/**
 * GameRoom 辅助工具函数
 * 提取常用的工具方法，提升可测试性
 */

/**
 * 格式化时间戳
 */
export function formatTimestamp(format: 'time' | 'datetime' = 'time'): string {
  const now = new Date()
  
  if (format === 'time') {
    return now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  return now.toLocaleString('zh-CN')
}

/**
 * 获取玩家位置（左、右、底部）
 */
export function getPlayerPosition(
  playerIndex: number,
  totalPlayers: number = 3
): 'left' | 'right' | 'bottom' | 'top' {
  if (totalPlayers === 3) {
    // 3人游戏：0=左，1=右，2=底部（当前玩家）
    if (playerIndex === 0) return 'left'
    if (playerIndex === 1) return 'right'
    return 'bottom'
  }
  
  // 可扩展为4人游戏
  return 'bottom'
}

/**
 * 判断是否为当前用户
 */
export function isCurrentUser(
  playerId: string | number,
  currentUserId?: string | number,
  currentUserName?: string
): boolean {
  if (!currentUserId && !currentUserName) return false
  
  return playerId === currentUserId || playerId === currentUserName
}

/**
 * 生成唯一ID
 */
export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}

/**
 * 延迟执行（Promise 版本）
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 安全的数组访问
 */
export function safeArrayAccess<T>(arr: T[] | null | undefined, index: number): T | null {
  if (!arr || !Array.isArray(arr)) return null
  if (index < 0 || index >= arr.length) return null
  return arr[index]
}

/**
 * 调试日志（仅开发环境）
 */
export function devLog(tag: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${tag}]`, ...args)
  }
}

/**
 * 错误日志
 */
export function errorLog(tag: string, error: any): void {
  console.error(`[${tag}] Error:`, error)
}
