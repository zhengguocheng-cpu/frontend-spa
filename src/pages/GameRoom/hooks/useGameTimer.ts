/**
 * useGameTimer Hook
 * 统一管理游戏中的所有定时器（抢地主倒计时、出牌倒计时等）
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface GameTimerState {
  // 抢地主倒计时
  biddingTimer: number
  isBiddingTimerActive: boolean
  
  // 出牌倒计时
  turnTimer: number
  isTurnTimerActive: boolean
}

export function useGameTimer() {
  // ==================== 抢地主定时器 ====================
  const [biddingTimer, setBiddingTimer] = useState(0)
  const biddingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startBiddingTimer = useCallback((seconds: number = 10) => {
    console.log(`[Timer] 启动抢地主倒计时: ${seconds}秒`)
    
    // 清理旧定时器
    if (biddingTimerRef.current) {
      clearInterval(biddingTimerRef.current)
    }
    
    setBiddingTimer(seconds)
    
    biddingTimerRef.current = setInterval(() => {
      setBiddingTimer((prev) => {
        if (prev <= 1) {
          if (biddingTimerRef.current) {
            clearInterval(biddingTimerRef.current)
            biddingTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopBiddingTimer = useCallback(() => {
    console.log('[Timer] 停止抢地主倒计时')
    if (biddingTimerRef.current) {
      clearInterval(biddingTimerRef.current)
      biddingTimerRef.current = null
    }
    setBiddingTimer(0)
  }, [])

  // ==================== 出牌定时器 ====================
  const [turnTimer, setTurnTimer] = useState(0)
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startTurnTimer = useCallback((seconds: number = 30) => {
    console.log(`[Timer] 启动出牌倒计时: ${seconds}秒`)
    
    // 清理旧定时器
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
    }
    
    setTurnTimer(seconds)
    
    turnTimerRef.current = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current)
            turnTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopTurnTimer = useCallback(() => {
    console.log('[Timer] 停止出牌倒计时')
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    setTurnTimer(0)
  }, [])

  const resetTurnTimer = useCallback((seconds: number = 30) => {
    console.log(`[Timer] 重置出牌倒计时: ${seconds}秒`)
    stopTurnTimer()
    startTurnTimer(seconds)
  }, [stopTurnTimer, startTurnTimer])

  // ==================== 自动准备定时器 ====================
  const [autoReadyCountdown, setAutoReadyCountdown] = useState<number | null>(null)
  const autoReadyTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startAutoReadyTimer = useCallback((seconds: number, onComplete: () => void) => {
    console.log(`[Timer] 启动自动准备倒计时: ${seconds}秒`)
    
    // 清理旧定时器
    if (autoReadyTimerRef.current) {
      clearTimeout(autoReadyTimerRef.current)
    }
    
    setAutoReadyCountdown(seconds)
    
    autoReadyTimerRef.current = setTimeout(() => {
      console.log('[Timer] 自动准备倒计时结束，执行回调')
      setAutoReadyCountdown(null)
      onComplete()
    }, seconds * 1000)
  }, [])

  const stopAutoReadyTimer = useCallback(() => {
    console.log('[Timer] 停止自动准备倒计时')
    if (autoReadyTimerRef.current) {
      clearTimeout(autoReadyTimerRef.current)
      autoReadyTimerRef.current = null
    }
    setAutoReadyCountdown(null)
  }, [])

  // ==================== 自动重玩定时器 ====================
  const [autoReplayCountdown, setAutoReplayCountdown] = useState<number | null>(null)
  const autoReplayTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startAutoReplayTimer = useCallback((seconds: number, onComplete: () => void) => {
    console.log(`[Timer] 启动自动重玩倒计时: ${seconds}秒`)
    
    // 清理旧定时器
    if (autoReplayTimerRef.current) {
      clearInterval(autoReplayTimerRef.current)
    }
    
    setAutoReplayCountdown(seconds)
    
    // 每秒更新倒计时显示
    autoReplayTimerRef.current = setInterval(() => {
      setAutoReplayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoReplayTimerRef.current) {
            clearInterval(autoReplayTimerRef.current)
            autoReplayTimerRef.current = null
          }
          onComplete()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopAutoReplayTimer = useCallback(() => {
    console.log('[Timer] 停止自动重玩倒计时')
    if (autoReplayTimerRef.current) {
      clearInterval(autoReplayTimerRef.current)
      autoReplayTimerRef.current = null
    }
    setAutoReplayCountdown(null)
  }, [])

  // ==================== 清理所有定时器 ====================
  const clearAllTimers = useCallback(() => {
    console.log('[Timer] 清理所有定时器')
    stopBiddingTimer()
    stopTurnTimer()
    stopAutoReadyTimer()
    stopAutoReplayTimer()
  }, [stopBiddingTimer, stopTurnTimer, stopAutoReadyTimer, stopAutoReplayTimer])

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [clearAllTimers])

  return {
    // 抢地主定时器
    biddingTimer,
    isBiddingTimerActive: biddingTimer > 0,
    startBiddingTimer,
    stopBiddingTimer,
    
    // 出牌定时器
    turnTimer,
    isTurnTimerActive: turnTimer > 0,
    startTurnTimer,
    stopTurnTimer,
    resetTurnTimer,
    
    // 自动准备定时器
    autoReadyCountdown,
    isAutoReadyActive: autoReadyCountdown !== null,
    startAutoReadyTimer,
    stopAutoReadyTimer,
    
    // 自动重玩定时器
    autoReplayCountdown,
    isAutoReplayActive: autoReplayCountdown !== null,
    startAutoReplayTimer,
    stopAutoReplayTimer,
    
    // 工具方法
    clearAllTimers,
  }
}
