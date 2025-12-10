/**
 * BottomPlayedCards - 底部玩家出牌展示（带动画）
 */

import { motion } from 'framer-motion'

interface BottomPlayedCardsProps {
  visible: boolean
  cards: string[]
  isLandlord: boolean
  parseCard: (card: string) => { rank: string; suit: string; isJoker?: 'big' | 'small' | null }
}

export function BottomPlayedCards(props: BottomPlayedCardsProps) {
  const { visible, cards, isLandlord, parseCard } = props

  if (!visible || cards.length === 0) return null

  return (
    <div className="played-cards-container bottom-player-played">
      {cards.map((cardStr: string, index: number) => {
        const { rank, suit, isJoker } = parseCard(cardStr)
        const isRed = suit === '♥' || suit === '♦' || isJoker === 'big'
        
        return (
          <motion.div
            key={`${cardStr}-${index}`}
            className={`card ${isRed ? 'red' : 'black'}`}
            initial={{ opacity: 0, y: -160, scale: 0.6, rotate: -6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 40, scale: 0.9, rotate: 6 }}
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
}
