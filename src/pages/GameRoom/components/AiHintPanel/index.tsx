/**
 * AiHintPanel - AI 出牌提示面板组件
 * 显示 AI 出牌分析和历史记录
 */

export interface AiHintRecord {
  id: number
  timestamp: string
  cards: string[]
  isPass: boolean
  analysis?: string
  winRate?: number
  reason?: string
}

export interface AiHintPanelProps {
  visible: boolean
  history: AiHintRecord[]
  onClose: () => void
  onClear: () => void
}

export function AiHintPanel(props: AiHintPanelProps) {
  const { visible, history, onClose, onClear } = props

  if (!visible) {
    return null
  }

  return (
    <>
      {/* 遮罩层 */}
      <div className="ai-panel-overlay" onClick={onClose} />
      
      {/* AI 面板 */}
      <aside className="ai-panel">
        {/* 头部 */}
        <div className="ai-panel-header">
          <h3>AI 出牌分析</h3>
          <div className="ai-panel-actions">
            {history.length > 0 && (
              <button 
                className="ai-clear-btn"
                onClick={onClear}
                title="清空出牌记录"
              >
                清空
              </button>
            )}
            <button 
              className="ai-close-btn"
              onClick={onClose}
              title="关闭 AI 面板"
            >
              关闭
            </button>
          </div>
        </div>
        
        {/* 内容区 */}
        <div className="ai-panel-content">
          {history.length === 0 ? (
            // 空状态
            <div className="ai-empty-state">
              <div className="ai-empty-icon">🤖</div>
              <p>暂无 AI 出牌记录</p>
              <p className="ai-empty-hint">打完一手牌后点击提示，这里会显示 AI 的分析结果</p>
            </div>
          ) : (
            // 历史记录列表
            <div className="ai-history-list">
              {history.map((record) => (
                <div key={record.id} className="ai-hint-card">
                  {/* 记录头部 */}
                  <div className="ai-hint-header">
                    <span className="ai-hint-number">#{record.id}</span>
                    <span className="ai-hint-time">{record.timestamp}</span>
                  </div>
                  
                  {/* 分析内容 */}
                  {record.analysis && (
                    <div className="ai-hint-section">
                      <div className="ai-section-title">分析内容</div>
                      <div className="ai-section-content">{record.analysis}</div>
                    </div>
                  )}
                  
                  {/* 胜率估计 */}
                  {typeof record.winRate === 'number' && (
                    <div className="ai-hint-section">
                      <div className="ai-section-title">胜率估计</div>
                      <div className="ai-winrate-bar">
                        <div 
                          className="ai-winrate-fill"
                          style={{ width: `${record.winRate}%` }}
                        />
                        <span className="ai-winrate-text">{record.winRate}%</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 出牌记录 */}
                  <div className="ai-hint-section">
                    <div className="ai-section-title">最近出牌记录</div>
                    <div className="ai-section-content">
                      {record.isPass ? (
                        <span className="ai-pass-tag">不出 (PASS)</span>
                      ) : (
                        <div className="ai-cards-display">
                          {record.cards.map((card, idx) => (
                            <span key={idx} className="ai-mini-card">{card}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 理由说明 */}
                  {record.reason && (
                    <div className="ai-hint-footer">
                      <span className="ai-reason-label">理由</span>
                      <span className="ai-reason-text">{record.reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
