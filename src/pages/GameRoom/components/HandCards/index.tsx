/**
 * HandCards - 手牌组件
 */

import { motion, AnimatePresence } from 'framer-motion'

interface HandCardsProps {
  cards: string[]
  selectedCards: string[]
  isDealingAnimation: boolean
  landlordId?: string | number
  isBottomLandlord: boolean
  parseCard: (cardStr: string) => { rank: string; suit: string; isJoker?: 'big' | 'small' | null }
  onCardPointerDown: (card: string, ev: React.PointerEvent) => void
  onCardPointerEnter: (card: string, ev: React.PointerEvent) => void
  onHandPointerUp: () => void
  onHandPointerMove: (ev: React.PointerEvent) => void
}

export function HandCards(props: HandCardsProps) {
  const {
    cards,
    selectedCards,
    isDealingAnimation,
    landlordId,
    isBottomLandlord,
    parseCard,
    onCardPointerDown,
    onCardPointerEnter,
    onHandPointerUp,
    onHandPointerMove
  } = props

  if (cards.length === 0) {
    return null
  }

  return (
    <div
      className="player-hand-section"
      onPointerUp={onHandPointerUp}
      onPointerLeave={onHandPointerUp}
      onPointerMove={onHandPointerMove}
    >
      <div className="player-hand">
        <AnimatePresence initial={false}>
          {cards.map((cardStr, index) => {
            const { rank, suit, isJoker } = parseCard(cardStr)
            const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
            const isSelected = selectedCards.some(c => c === cardStr)
            const targetY = isSelected ? -26 : 0

            return (
              <motion.div
                key={`${cardStr}-${index}`}
                data-card={cardStr}
                className={`card ${isRed ? 'red' : 'black'} ${isSelected ? 'selected' : ''}`}
                style={{ zIndex: index + 1 }}
                onPointerDown={(ev) => onCardPointerDown(cardStr, ev)}
                onPointerEnter={(ev) => onCardPointerEnter(cardStr, ev)}
                layout
                initial={isDealingAnimation ? { opacity: 0, y: -160, scale: 0.6, rotate: -6 } : false}
                animate={{ opacity: 1, y: targetY, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, y: 40, scale: 0.9, rotate: 6 }}
              >
                <div
                  className={`card-value ${isJoker ? 'joker-text' : ''}`}
                  style={isJoker ? { color: isJoker === 'big' ? '#d32f2f' : '#000' } : undefined}
                >
                  {rank}
                </div>
                {!isJoker && <div className="card-suit">{suit}</div>}
                {landlordId && (
                  <div className={`card-landlord-mark ${isBottomLandlord ? 'landlord' : 'farmer'}`}>
                    {isBottomLandlord ? '地主' : '农民'}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
