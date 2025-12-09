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

  if (!visible || cards.length === 0) {
    return null
  }

  return (
    <div className="bottom-cards-display">
      <div className="bottom-info-bar">
        {/* 底牌卡牌列表 */}
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
      {/* 底牌基数/倍数展示区域 */}
      <div className="bottom-meta compact">
        <span>基数: {baseScore}</span>
        <span>倍数: {multiplier}</span>
      </div>
    </div>
  )
}
