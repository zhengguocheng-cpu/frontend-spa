/**
 * Voice and Sound Helper Functions
 */

import { parseCard, getSpokenRankFromCard } from './helpers'

export function getPlayVoiceText(pattern: any, cards: string[]): string | null {
  const typeRaw = (pattern?.type || pattern?.TYPE || '').toString().toLowerCase()
  const cardList: string[] =
    Array.isArray(pattern?.cards) && pattern.cards.length > 0
      ? pattern.cards
      : Array.isArray(cards)
      ? cards
      : []

  if (!cardList.length) {
    return null
  }

  switch (typeRaw) {
    case 'single': {
      return getSpokenRankFromCard(cardList[0])
    }
    case 'pair': {
      const text = getSpokenRankFromCard(cardList[0])
      return text ? `对${text}` : null
    }
    default: {
      return null
    }
  }
}
