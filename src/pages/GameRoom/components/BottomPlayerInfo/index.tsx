/**
 * BottomPlayerInfo - 底部当前玩家信息展示
 */

interface BottomPlayerInfoProps {
  player: any | null
  isLandlord: boolean
  isTurn: boolean
  coinValue: number
  finalScore?: number
  gameStatus: string
  renderPlayerAvatar: (avatar: string | undefined) => JSX.Element
}

export function BottomPlayerInfo(props: BottomPlayerInfoProps) {
  const { player, isLandlord, isTurn, coinValue, finalScore, gameStatus, renderPlayerAvatar } =
    props

  if (!player) return null

  return (
    <div className={`current-player-info ${isTurn ? 'turn-active' : ''}`}>
      <div className="player-avatar-container">
        {isLandlord && (
          <div className="landlord-badge" title="地主">
            👑
          </div>
        )}
        <div className="player-avatar">{renderPlayerAvatar(player.avatar)}</div>
      </div>
      <div className="player-info-below">
        <div className="player-coins">
          <span className="player-coins-icon" aria-hidden="true" />
          <span className="player-coins-text">
            {coinValue >= 10000 ? `${(coinValue / 10000).toFixed(1)}万` : coinValue.toLocaleString()}
          </span>
        </div>
      </div>
      {gameStatus === 'finished' && finalScore !== undefined && (
        <div className={`result-score-bottom ${finalScore >= 0 ? 'win' : 'lose'}`}>
          {finalScore > 0 ? `+${finalScore}` : finalScore}
        </div>
      )}
    </div>
  )
}
