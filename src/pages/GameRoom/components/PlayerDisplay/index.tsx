/**
 * PlayerDisplay - 玩家显示组件
 */

import { motion } from 'framer-motion'

interface Player {
  id: string | number
  name: string
  avatar?: string
  cardCount: number
  score?: number
  isReady?: boolean
}

interface LastPlayed {
  cards: string[]
  playerId: string | number
}

interface PlayerDisplayProps {
  position: 'left' | 'right'
  player: Player
  gameStatus: 'waiting' | 'bidding' | 'playing' | 'finished'
  isLandlord: boolean
  isTurn: boolean
  turnTimer?: number
  lastPlayed?: LastPlayed
  isPassed: boolean
  finalScore?: number
  remainingCards?: string[]
  parseCard: (cardStr: string) => { rank: string; suit: string; isJoker?: 'big' | 'small' | null }
  renderPlayerAvatar: (avatar?: string) => React.ReactNode
}

export function PlayerDisplay(props: PlayerDisplayProps) {
  const {
    position,
    player,
    gameStatus,
    isLandlord,
    isTurn,
    turnTimer,
    lastPlayed,
    isPassed,
    finalScore,
    remainingCards,
    parseCard,
    renderPlayerAvatar
  } = props

  return (
    <div className={`player-slot ${position} ${isTurn ? 'turn-active' : ''}`}>
      {/* 玩家角标（剩余牌数 + 金币） */}
      <div className="player-badge">
        {gameStatus !== 'waiting' && (
          <span className="cards-left">{Math.max(0, player.cardCount || 0)}</span>
        )}
        <span className="coins">
          <span className="coin-icon">金</span>
          {(player.score ?? 0) >= 10000
            ? `${((player.score ?? 0) / 10000).toFixed(1)}万`
            : (player.score ?? 0)}
        </span>
      </div>

      {/* 玩家信息 */}
      <div className={`player-info ${isLandlord ? 'landlord' : ''}`}>
        {isLandlord && (
          <div className="landlord-badge" title="地主">👑</div>
        )}
        <div className="player-avatar">{renderPlayerAvatar(player.avatar)}</div>
        <div className="player-name">{player.name}</div>
        {gameStatus === 'waiting' && (
          <div className="player-status">
            {player.isReady ? '已准备' : '未准备'}
          </div>
        )}
      </div>

      {/* 结算分数 */}
      {gameStatus === 'finished' && typeof finalScore === 'number' && (
        <div className={`result-score ${finalScore >= 0 ? 'win' : 'lose'}`}>
          {finalScore > 0 ? `+${finalScore}` : finalScore}
        </div>
      )}

      {/* 出牌区域 */}
      <div className="played-cards-area">
        {/* 倒计时 */}
        {isTurn && turnTimer && turnTimer > 0 && (
          <div className="area-turn-timer">{turnTimer}</div>
        )}

        {/* 游戏结束时显示剩余牌 */}
        {gameStatus === 'finished' && remainingCards && remainingCards.length > 0 ? (
          <div className="played-cards-container remaining-cards">
            {remainingCards.map((cardStr, index) => {
              const { rank, suit, isJoker } = parseCard(cardStr)
              const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
              return (
                <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
                  <div
                    className={`card-value ${isJoker ? 'joker-text' : ''}`}
                    style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                  >
                    {rank}
                  </div>
                  {!isJoker && <div className="card-suit">{suit}</div>}
                  <div className={`card-landlord-mark ${isLandlord ? 'landlord' : 'farmer'}`}>
                    {isLandlord ? '地主' : '农民'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : isPassed ? (
          <div className="pass-text">不出</div>
        ) : (
          lastPlayed && lastPlayed.playerId === player.id && (
            <div className="played-cards-container last-played">
              {lastPlayed.cards.map((cardStr, index) => {
                const { rank, suit, isJoker } = parseCard(cardStr)
                const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
                return (
                  <motion.div
                    key={index}
                    className={`card ${isRed ? 'red' : 'black'}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 0.85 }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
                    transition={{
                      delay: index * 0.03,
                      type: 'spring',
                      stiffness: 280,
                      damping: 20,
                    }}
                  >
                    <div
                      className={`card-value ${isJoker ? 'joker-text' : ''}`}
                      style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                    >
                      {rank}
                    </div>
                    {!isJoker && <div className="card-suit">{suit}</div>}
                    <div className={`card-landlord-mark ${isLandlord ? 'landlord' : 'farmer'}`}>
                      {isLandlord ? '地主' : '农民'}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
