/**
 * GameActions - 游戏操作按钮组件
 * 出牌/提示/不出按钮区域
 */

export interface GameActionsProps {
  visible: boolean
  canPass: boolean
  turnTimer: number
  playPending: boolean
  onPass: () => void
  onHint: () => void
  onPlayCards: () => void
}

export function GameActions(props: GameActionsProps) {
  const { visible, canPass, turnTimer, playPending, onPass, onHint, onPlayCards } = props

  if (!visible) {
    return null
  }

  return (
    <div className="game-actions" id="gameActions">
      <div className="game-buttons">
        {/* 不出按钮 */}
        {canPass && (
          <button
            type="button"
            className="btn-pass"
            onClick={onPass}
          >
            不出
          </button>
        )}
        
        {/* 倒计时显示 */}
        {turnTimer > 0 && (
          <div className="turn-timer">{turnTimer}</div>
        )}
        
        {/* 提示按钮 */}
        <button
          type="button"
          className="btn-hint"
          onClick={onHint}
        >
          提示
        </button>
        
        {/* 出牌按钮 */}
        <button
          type="button"
          className="btn-play"
          onClick={onPlayCards}
          disabled={playPending}
        >
          出牌
        </button>
      </div>
    </div>
  )
}
