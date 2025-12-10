/**
 * BottomCards - 底牌显示组件
 */

interface BottomCardsProps {
  visible: boolean
  cards: string[]
  baseScore?: number
  multiplier?: number
  parseCard: (cardStr: string) => { rank: string; suit: string; isJoker?: 'big' | 'small' | null }
}

export function BottomCards(props: BottomCardsProps) {
  const { visible, cards, baseScore = 5000, multiplier = 1, parseCard } = props

  // 如果没有底牌数据，不显示整个组件
  if (cards.length === 0) {
    return null
  }

  return (
    <div className="bottom-cards-display">
      {/* 底牌卡牌列表 - 根据visible状态控制显示 */}
      {visible && (
        <div className="bottom-info-bar">
          <div className="bottom-cards-container">
            {cards.map((cardStr, index) => {
              const { rank, suit, isJoker } = parseCard(cardStr)
              const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'

              return (
                <div key={index} className={`bottom-card ${isRed ? 'red' : 'black'}`}>
                  <div
                    className={`card-value ${isJoker ? 'joker-text' : ''}`}
                    style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                  >
                    {rank}
                  </div>
                  {!isJoker && <div className="card-suit">{suit}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* 基数/倍数展示区域 - 始终显示 */}
      <div className="bottom-meta compact">
        <span>基数: {baseScore}</span>
        <span>倍数: {multiplier}</span>
      </div>
    </div>
  )
}
