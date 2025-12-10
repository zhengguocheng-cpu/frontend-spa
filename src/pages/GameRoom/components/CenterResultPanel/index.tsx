/**
 * CenterResultPanel - 中央结算结果面板
 */

interface CenterResultPanelProps {
  visible: boolean
  landlordWin: boolean
  autoReplayCountdown: number | null
  onReplay: () => void
  onBackToLobby: () => void
}

export function CenterResultPanel(props: CenterResultPanelProps) {
  const { visible, landlordWin, autoReplayCountdown, onReplay, onBackToLobby } = props

  if (!visible) return null

  return (
    <div className="center-area">
      <div className={`center-result-banner ${landlordWin ? 'landlord' : 'farmer'}`}>
        {landlordWin ? '地主胜利' : '农民获胜'}
      </div>
      <div className="settlement-inline-actions">
        <button type="button" className="btn-replay" onClick={onReplay}>
          再来一局
        </button>
        <button type="button" className="btn-back-lobby" onClick={onBackToLobby}>
          {autoReplayCountdown != null ? `返回大厅（${autoReplayCountdown}秒）` : '返回大厅'}
        </button>
      </div>
    </div>
  )
}
