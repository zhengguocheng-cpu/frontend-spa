/**
 * SettlementPanel - 游戏结算面板组件
 * 显示游戏结算信息和操作按钮
 */

import { Button } from 'antd-mobile'
import type { SettlementPlayerScore } from '@/store/slices/gameSlice'
import './style.css'

export interface SettlementPanelProps {
  visible: boolean
  landlordWin: boolean
  playerScores: SettlementPlayerScore[]
  currentUserId?: string | number
  onPlayAgain: () => void
  onLeaveRoom: () => void
}

export function SettlementPanel(props: SettlementPanelProps) {
  const { visible, landlordWin, playerScores, currentUserId, onPlayAgain, onLeaveRoom } = props

  if (!visible) {
    return null
  }

  return (
    <div className="settlement-overlay">
      <div className="settlement-root">
        <div className="settlement-layout">
          <div className="settlement-panel">
            {/* 结算标题 */}
            <div className="settlement-header">
              <div className={`settlement-result-badge ${landlordWin ? 'landlord-win' : 'farmer-win'}`}>
                {landlordWin ? '地主胜利' : '农民胜利'}
              </div>
            </div>

            {/* 玩家得分列表 */}
            {playerScores && playerScores.length > 0 && (
              <div className="players-score">
                <h3 className="section-title">本局得分</h3>
                <div className="players-score-list">
                  {playerScores.map((ps) => {
                    const isWinner = ps.isWinner
                    const isMe = ps.playerId === currentUserId
                    const scoreValue = ps.finalScore > 0 ? `+${ps.finalScore}` : ps.finalScore
                    const roleLabel = ps.role === 'landlord' ? '地主' : '农民'
                    
                    return (
                      <div
                        key={ps.playerId}
                        className={`player-score-row ${isWinner ? 'winner' : ''} ${isMe ? 'me' : ''}`}
                      >
                        <div className="player-info">
                          <span className="player-name">
                            {ps.playerName}（{roleLabel}）
                          </span>
                        </div>
                        <span className={`player-score-value ${ps.finalScore >= 0 ? 'positive' : 'negative'}`}>
                          {scoreValue}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="settlement-actions">
              <Button color="primary" onClick={onPlayAgain}>
                再来一局
              </Button>
              <Button color="default" onClick={onLeaveRoom}>
                返回大厅
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
