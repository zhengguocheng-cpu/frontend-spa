/**
 * TopPlayersArea - 上方左右玩家区域
 */

import { PlayerDisplay } from '../PlayerDisplay'

interface TopPlayersAreaProps {
  leftPlayer: any | null
  rightPlayer: any | null
  landlordId: string | null
  isLeftTurn: boolean
  isRightTurn: boolean
  turnTimer: number
  lastPlayedCards: any
  passedPlayers: Record<string, boolean>
  leftPlayerScore: any
  rightPlayerScore: any
  leftRemainingCards: string[] | null
  rightRemainingCards: string[] | null
  gameStatus: 'waiting' | 'bidding' | 'playing' | 'finished'
  parseCard: (card: string) => any
  renderPlayerAvatar: (avatar: string | undefined) => JSX.Element
}

export function TopPlayersArea(props: TopPlayersAreaProps) {
  const {
    leftPlayer,
    rightPlayer,
    landlordId,
    isLeftTurn,
    isRightTurn,
    turnTimer,
    lastPlayedCards,
    passedPlayers,
    leftPlayerScore,
    rightPlayerScore,
    leftRemainingCards,
    rightRemainingCards,
    gameStatus,
    parseCard,
    renderPlayerAvatar,
  } = props

  return (
    <div className="top-players">
      {leftPlayer && (
        <PlayerDisplay
          position="left"
          player={leftPlayer}
          gameStatus={gameStatus}
          isLandlord={landlordId === leftPlayer.id}
          isTurn={isLeftTurn}
          turnTimer={turnTimer}
          lastPlayed={lastPlayedCards}
          isPassed={!!passedPlayers[leftPlayer.id]}
          finalScore={leftPlayerScore?.finalScore}
          remainingCards={leftRemainingCards || undefined}
          parseCard={parseCard}
          renderPlayerAvatar={renderPlayerAvatar}
        />
      )}

      {rightPlayer && (
        <PlayerDisplay
          position="right"
          player={rightPlayer}
          gameStatus={gameStatus}
          isLandlord={landlordId === rightPlayer.id}
          isTurn={isRightTurn}
          turnTimer={turnTimer}
          lastPlayed={lastPlayedCards}
          isPassed={!!passedPlayers[rightPlayer.id]}
          finalScore={rightPlayerScore?.finalScore}
          remainingCards={rightRemainingCards || undefined}
          parseCard={parseCard}
          renderPlayerAvatar={renderPlayerAvatar}
        />
      )}
    </div>
  )
}
