/**
 * 游戏房间日志模块
 * 支持日志等级控制
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class GameLogger {
  private level: LogLevel = LogLevel.INFO

  constructor() {
    // 从配置读取日志等级
    const savedLevel = localStorage.getItem('game_log_level')
    if (savedLevel) {
      this.level = parseInt(savedLevel) as LogLevel
    }
  }

  setLevel(level: LogLevel) {
    this.level = level
    localStorage.setItem('game_log_level', level.toString())
  }

  getLevel(): LogLevel {
    return this.level
  }

  debug(tag: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${tag}]`, ...args)
    }
  }

  info(tag: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${tag}]`, ...args)
    }
  }

  warn(tag: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${tag}]`, ...args)
    }
  }

  error(tag: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${tag}]`, ...args)
    }
  }

  // 便捷方法：按模块分类
  socket(...args: any[]) {
    this.debug('Socket', ...args)
  }

  room(...args: any[]) {
    this.info('Room', ...args)
  }

  game(...args: any[]) {
    this.info('Game', ...args)
  }

  play(...args: any[]) {
    this.debug('Play', ...args)
  }

  bid(...args: any[]) {
    this.debug('Bid', ...args)
  }

  hint(...args: any[]) {
    this.debug('Hint', ...args)
  }
}

// 导出单例
export const logger = new GameLogger()

// 开发环境下可以在控制台调整日志级别
if (typeof window !== 'undefined') {
  ;(window as any).setGameLogLevel = (level: LogLevel) => {
    logger.setLevel(level)
    console.log(`日志级别已设置为: ${LogLevel[level]}`)
  }
  ;(window as any).LogLevel = LogLevel
}
