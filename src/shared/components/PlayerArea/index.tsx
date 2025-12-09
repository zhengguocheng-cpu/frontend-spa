/**
 * PlayerArea - 玩家信息展示组件
 * 通用的玩家区域组件，支持多种棋牌游戏
 */

import React from 'react'
import type { Player } from '@/types/game'
import './style.css'

export interface PlayerAreaProps {
  player: Player | null
  position: 'left' | 'right' | 'bottom'
  
  // 状态标识
  isCurrentTurn?: boolean
  isLandlord?: boolean
  isReady?: boolean
  
  // 游戏状态
  gameStatus?: 'waiting' | 'playing' | 'finished'
  cardCount?: number
  score?: number
  
  // 结算信息
  settlementScore?: number
  
  // 定时器
  turnTimer?: number
  
  // 自定义渲染
  renderAvatar?: (avatar?: string) => React.ReactNode
  renderPlayedCards?: () => React.ReactNode
  
  // 样式
  className?: string
}

export function PlayerArea(props: PlayerAreaProps) {
  const {
    player,
    position,
    isCurrentTurn = false,
    isLandlord = false,
    isReady = false,
    gameStatus = 'waiting',
    cardCount = 0,
    score = 0,
    settlementScore,
    turnTimer,
    renderAvatar,
    renderPlayedCards,
    className = '',
  } = props

  if (!player) {
    return null
  }

  // 格式化金币显示
  const formatCoins = (coins: number) => {
    if (coins >= 10000) {
      return `${(coins / 10000).toFixed(1)}万`
    }
    return coins
  }

  // 默认头像渲染
  const defaultRenderAvatar = (avatar?: string) => {
    const raw = (avatar || '').trim()
    if (!raw) {
      return '😀'
    }
    // 如果是 emoji，直接显示
    if (raw.length <= 2) {
      return raw
    }
    // 如果是 URL，显示图片
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return <img src={raw} alt="avatar" className="avatar-img" />
    }
    // 默认显示文本首字符
    return raw.charAt(0)
  }

  const avatarNode = renderAvatar ? renderAvatar(player.avatar) : defaultRenderAvatar(player.avatar)

  return (
    <div className={`player-area player-area-${position} ${isCurrentTurn ? 'turn-active' : ''} ${className}`}>
      {/* 玩家角标（剩余牌数 + 金币） */}
      <div className="player-badge">
        {gameStatus !== 'waiting' && cardCount > 0 && (
          <span className="cards-left">{Math.max(0, cardCount)}</span>
        )}
        <span className="coins">
          <span className="coin-icon">金</span>
          {formatCoins(score)}
        </span>
      </div>

      {/* 玩家信息 */}
      <div className={`player-info ${isLandlord ? 'landlord' : ''}`}>
        {isLandlord && (
          <div className="landlord-badge" title="地主">👑</div>
        )}
        <div className="player-avatar">{avatarNode}</div>
        <div className="player-name">{player.name}</div>
        
        {gameStatus === 'waiting' && (
          <div className="player-status">
            {isReady ? '已准备' : '未准备'}
          </div>
        )}
      </div>

      {/* 结算分数 */}
      {gameStatus === 'finished' && settlementScore !== undefined && (
        <div className={`result-score ${settlementScore >= 0 ? 'win' : 'lose'}`}>
          {settlementScore > 0 ? `+${settlementScore}` : settlementScore}
        </div>
      )}

      {/* 出牌区域 */}
      <div className="played-cards-area">
        {/* 倒计时 */}
        {isCurrentTurn && turnTimer && turnTimer > 0 && (
          <div className="area-turn-timer">{turnTimer}</div>
        )}
        
        {/* 自定义出牌内容 */}
        {renderPlayedCards && renderPlayedCards()}
      </div>
    </div>
  )
}
