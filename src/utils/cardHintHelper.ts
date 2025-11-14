import type { Card } from '../store/slices/gameSlice'

// 简化版出牌提示助手
// 目前支持的牌型：单牌、对子、三张、炸弹、王炸
// 后续可以逐步扩展顺子、连对、飞机等高级牌型

export type SimplePatternType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'bomb'
  | 'straight'
  | 'pair_sequence'
  | 'triple_with_single'
  | 'triple_with_pair'
  | 'four_with_two'

export interface SimplePattern {
  type: SimplePatternType
  value: number
  length: number
}

// 牌面值映射，与后端 / 旧前端保持一致
const RANK_VALUES: Record<string, number> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
  小王: 16,
  '🃏小王': 16,
  大王: 17,
  '🃏大王': 17,
}

const getCardValue = (card: Card): number => {
  if (!card) return 0

  // 处理大小王
  if (card.includes('大王')) return RANK_VALUES['大王']
  if (card.includes('小王')) return RANK_VALUES['小王']

  // 提取数字或字母（去掉花色）
  const match = card.match(/[0-9JQKA]+/)
  if (match) {
    const rank = match[0] as keyof typeof RANK_VALUES
    return RANK_VALUES[rank] ?? 0
  }

  return 0
}

const sortCardsAsc = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => {
    const va = getCardValue(a)
    const vb = getCardValue(b)
    if (va !== vb) return va - vb
    // 花色顺序只是为了稳定排序，不影响逻辑
    const suitOrder: Record<string, number> = { '♦': 1, '♣': 2, '♥': 3, '♠': 4 }
    const sa = a.charAt(0)
    const sb = b.charAt(0)
    const sd = (suitOrder[sa] || 0) - (suitOrder[sb] || 0)
    if (sd !== 0) return sd
    return a.localeCompare(b)
  })
}

const groupByValue = (cards: Card[]): Map<number, Card[]> => {
  const map = new Map<number, Card[]>()
  for (const c of cards) {
    const v = getCardValue(c)
    const list = map.get(v) || []
    list.push(c)
    map.set(v, list)
  }
  return map
}

interface RocketInfo {
  hasRocket: boolean
  cards: Card[]
}

const detectRocketInHand = (hand: Card[]): RocketInfo => {
  let small: Card | null = null
  let big: Card | null = null

  for (const card of hand) {
    if (card.includes('小王')) small = card
    if (card.includes('大王')) big = card
  }

  if (small && big) {
    return { hasRocket: true, cards: [small, big] }
  }
  return { hasRocket: false, cards: [] }
}

const detectSimplePattern = (cards: Card[]): SimplePattern | null => {
  if (!cards || cards.length === 0) return null

  const sorted = sortCardsAsc(cards)
  const values = sorted.map(getCardValue)
  const length = sorted.length

  if (length === 1) {
    return { type: 'single', value: values[0], length }
  }

  const first = values[0]
  const allSame = values.every((v) => v === first)

  if (length === 2 && allSame) {
    return { type: 'pair', value: first, length }
  }

  if (length === 3 && allSame) {
    return { type: 'triple', value: first, length }
  }

  // 三带一
  if (length === 4) {
    const groups = groupByValue(sorted)
    const entries = Array.from(groups.entries())
    if (entries.length === 2) {
      const [v1, g1] = entries[0]
      const [v2, g2] = entries[1]
      const c1 = g1.length
      const c2 = g2.length
      if ((c1 === 3 && c2 === 1) || (c1 === 1 && c2 === 3)) {
        const tripleValue = c1 === 3 ? v1 : v2
        return { type: 'triple_with_single', value: tripleValue, length }
      }
    }

    if (allSame) {
      return { type: 'bomb', value: first, length }
    }
  }

  // 三带二
  if (length === 5) {
    const groups = groupByValue(sorted)
    const entries = Array.from(groups.entries())
    if (entries.length === 2) {
      const [v1, g1] = entries[0]
      const [v2, g2] = entries[1]
      const c1 = g1.length
      const c2 = g2.length
      if ((c1 === 3 && c2 === 2) || (c1 === 2 && c2 === 3)) {
        const tripleValue = c1 === 3 ? v1 : v2
        return { type: 'triple_with_pair', value: tripleValue, length }
      }
    }
  }

  // 四带二（4+1+1 或 4+2 或 4+2+2）
  if (length === 6 || length === 8) {
    const groups = groupByValue(sorted)
    const entries = Array.from(groups.entries())
    const fourEntry = entries.find(([, groupCards]) => groupCards.length === 4)
    if (fourEntry) {
      const fourValue = fourEntry[0]
      if (length === 6) {
        // 6 张：4+1+1 或 4+2，附属牌数量满足即可
        return { type: 'four_with_two', value: fourValue, length }
      } else {
        // 8 张：需要 4+2+2
        const otherCounts = entries
          .filter(([value]) => value !== fourValue)
          .map(([, groupCards]) => groupCards.length)
        if (otherCounts.length === 2 && otherCounts.every((c) => c === 2)) {
          return { type: 'four_with_two', value: fourValue, length }
        }
      }
    }
  }

  if (length >= 5) {
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b)
    if (uniqueValues.length === length) {
      const min = uniqueValues[0]
      const max = uniqueValues[uniqueValues.length - 1]
      if (min >= 3 && max <= 14) {
        let consecutive = true
        for (let i = 1; i < uniqueValues.length; i++) {
          if (uniqueValues[i] !== uniqueValues[i - 1] + 1) {
            consecutive = false
            break
          }
        }
        if (consecutive) {
          return { type: 'straight', value: min, length }
        }
      }
    }
  }

  if (length >= 6 && length % 2 === 0) {
    const groups = groupByValue(cards)
    const pairValues: number[] = []
    for (const [value, groupCards] of groups.entries()) {
      if (groupCards.length === 2) {
        pairValues.push(value)
      }
    }
    if (pairValues.length * 2 === length) {
      pairValues.sort((a, b) => a - b)
      const min = pairValues[0]
      const max = pairValues[pairValues.length - 1]
      if (min >= 3 && max <= 14) {
        let consecutive = true
        for (let i = 1; i < pairValues.length; i++) {
          if (pairValues[i] !== pairValues[i - 1] + 1) {
            consecutive = false
            break
          }
        }
        if (consecutive) {
          return { type: 'pair_sequence', value: min, length }
        }
      }
    }
  }

  return null
}

const findAllBombs = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const bombs: Card[][] = []
  for (const cards of groups.values()) {
    if (cards.length === 4) {
      bombs.push(sortCardsAsc(cards))
    }
  }
  // 按牌面值从小到大排序
  bombs.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return bombs
}

const findAllTriples = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const triples: Card[][] = []
  for (const cards of groups.values()) {
    if (cards.length === 3 || cards.length > 3) {
      triples.push(sortCardsAsc(cards).slice(0, 3))
    }
  }
  triples.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return triples
}

const findAllPairs = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const pairs: Card[][] = []
  for (const cards of groups.values()) {
    if (cards.length >= 2) {
      const sorted = sortCardsAsc(cards)
      pairs.push([sorted[0], sorted[1]])
    }
  }
  pairs.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return pairs
}

const findAllSingles = (hand: Card[]): Card[][] => {
  const sorted = sortCardsAsc(hand)
  return sorted.map((c) => [c])
}

const findAllTripleWithSingles = (hand: Card[]): Card[][] => {
  const triples = findAllTriples(hand)
  const sortedHand = sortCardsAsc(hand)
  const results: Card[][] = []

  for (const triple of triples) {
    const tripleValue = getCardValue(triple[0])
    for (const card of sortedHand) {
      if (getCardValue(card) !== tripleValue) {
        results.push([...triple, card])
      }
    }
  }

  return results
}

const findAllTripleWithPairs = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const entries = Array.from(groups.entries())
  const results: Card[][] = []

  for (const [value, cardsOfValue] of entries) {
    if (cardsOfValue.length >= 3) {
      const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

      for (const [pairValue, pairCards] of entries) {
        if (pairValue === value) continue
        if (pairCards.length >= 2) {
          const sortedPair = sortCardsAsc(pairCards)
          results.push([...triple, sortedPair[0], sortedPair[1]])
        }
      }
    }
  }

  return results
}

const findAllFourWithTwo = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const results: Card[][] = []

  for (const [value, cardsOfValue] of groups.entries()) {
    if (cardsOfValue.length === 4) {
      const four = sortCardsAsc(cardsOfValue)
      const remaining = sortCardsAsc(hand).filter((c) => getCardValue(c) !== value)

      // 6 张：4+1+1 或 4+2，取当前能组成的最小两张牌
      if (remaining.length >= 2) {
        results.push([...four, remaining[0], remaining[1]])
      }

      // 8 张：4+2+2，取当前能组成的最小两对
      const remainingGroups = groupByValue(remaining)
      const pairs: Card[][] = []
      for (const cards of remainingGroups.values()) {
        if (cards.length >= 2) {
          const sortedPair = sortCardsAsc(cards)
          pairs.push([sortedPair[0], sortedPair[1]])
        }
      }
      if (pairs.length >= 2) {
        const firstPair = pairs[0]
        const secondPair = pairs[1]
        results.push([...four, ...firstPair, ...secondPair])
      }
    }
  }

  return results
}

const findBiggerSingles = (hand: Card[], minValue: number): Card[][] => {
  const groups = groupByValue(hand)
  const values = Array.from(groups.keys()).sort((a, b) => a - b)

  // 计算当前手牌中所有可能顺子涉及到的点数（用于判断某张单牌是否是顺子关键点）
  const straights = findAllStraights(hand)
  const straightValueSet = new Set<number>()
  for (const straight of straights) {
    for (const card of straight) {
      straightValueSet.add(getCardValue(card))
    }
  }

  type SingleCandidate = { card: Card; value: number; cost: number }
  const candidates: SingleCandidate[] = []

  for (const value of values) {
    if (value <= minValue) continue
    const cardsOfValue = sortCardsAsc(groups.get(value) || [])
    const groupSize = cardsOfValue.length
    if (groupSize === 0) continue

    const isCriticalSingle = groupSize === 1 && straightValueSet.has(value)

    const baseCost =
      groupSize === 1 ? 0 : groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
    const fullCost = baseCost + (isCriticalSingle ? 100 : 0)

    for (const card of cardsOfValue) {
      candidates.push({ card, value, cost: fullCost })
    }
  }

  candidates.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost
    if (a.value !== b.value) return a.value - b.value
    return getCardValue(a.card) - getCardValue(b.card)
  })

  return candidates.map((c) => [c.card])
}

const findBiggerPairs = (hand: Card[], minValue: number): Card[][] => {
  const groups = groupByValue(hand)

  // 计算手牌中所有可能顺子涉及到的点数，用于判断拆掉某对是否会破坏顺子
  const straights = findAllStraights(hand)
  const straightValueSet = new Set<number>()
  for (const straight of straights) {
    for (const card of straight) {
      straightValueSet.add(getCardValue(card))
    }
  }

  type PairCandidate = { cards: Card[]; value: number; cost: number }
  const candidates: PairCandidate[] = []

  for (const [value, cards] of groups.entries()) {
    if (value <= minValue || cards.length < 2) continue

    const sorted = sortCardsAsc(cards)
    const pair: Card[] = [sorted[0], sorted[1]]
    const groupSize = cards.length

    // 如果这一点数只有两张牌，并且在某个顺子中出现，则拆这对会破坏顺子
    const remainingAfterPair = groupSize - 2
    const breaksStraight = remainingAfterPair <= 0 && straightValueSet.has(value)

    const baseCost = groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
    const fullCost = baseCost + (breaksStraight ? 100 : 0)

    candidates.push({ cards: pair, value, cost: fullCost })
  }

  candidates.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost
    if (a.value !== b.value) return a.value - b.value
    return getCardValue(a.cards[0]) - getCardValue(b.cards[0])
  })

  return candidates.map((c) => c.cards)
}

const findAllStraights = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const values = Array.from(groups.keys())
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  const candidateValues: number[][] = []
  let start = 0
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== values[i - 1] + 1) {
      const run = values.slice(start, i)
      if (run.length >= 5) {
        for (let len = run.length; len >= 5; len--) {
          for (let s = 0; s + len <= run.length; s++) {
            candidateValues.push(run.slice(s, s + len))
          }
        }
      }
      start = i
    }
  }

  const combos: Card[][] = []
  for (const seq of candidateValues) {
    const combo: Card[] = []
    let ok = true
    for (const v of seq) {
      const cardsOfValue = sortCardsAsc(groups.get(v) || [])
      if (cardsOfValue.length === 0) {
        ok = false
        break
      }
      combo.push(cardsOfValue[0])
    }
    if (ok) {
      combos.push(combo)
    }
  }

  const unique: Card[][] = []
  const seen = new Set<string>()
  for (const combo of combos) {
    const key = sortCardsAsc(combo).join(',')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(combo)
    }
  }

  unique.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length
    return getCardValue(a[0]) - getCardValue(b[0])
  })

  return unique
}

const findAllPairSequences = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const pairValues = Array.from(groups.entries())
    .filter(([, cards]) => cards.length >= 2)
    .map(([value]) => value)
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  const candidateValues: number[][] = []
  let start = 0
  for (let i = 1; i <= pairValues.length; i++) {
    if (i === pairValues.length || pairValues[i] !== pairValues[i - 1] + 1) {
      const run = pairValues.slice(start, i)
      if (run.length >= 3) {
        for (let len = run.length; len >= 3; len--) {
          for (let s = 0; s + len <= run.length; s++) {
            candidateValues.push(run.slice(s, s + len))
          }
        }
      }
      start = i
    }
  }

  const combos: Card[][] = []
  for (const seq of candidateValues) {
    const combo: Card[] = []
    let ok = true
    for (const v of seq) {
      const cardsOfValue = sortCardsAsc(groups.get(v) || [])
      if (cardsOfValue.length < 2) {
        ok = false
        break
      }
      combo.push(cardsOfValue[0], cardsOfValue[1])
    }
    if (ok) {
      combos.push(combo)
    }
  }

  const unique: Card[][] = []
  const seen = new Set<string>()
  for (const combo of combos) {
    const key = sortCardsAsc(combo).join(',')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(combo)
    }
  }

  unique.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length
    return getCardValue(a[0]) - getCardValue(b[0])
  })

  return unique
}

const findBiggerStraights = (hand: Card[], minStartValue: number, length: number): Card[][] => {
  if (length < 5) return []

  const groups = groupByValue(hand)
  const values = Array.from(groups.keys())
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  const combos: Card[][] = []
  let start = 0
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== values[i - 1] + 1) {
      const run = values.slice(start, i)
      if (run.length >= length) {
        for (let s = 0; s + length <= run.length; s++) {
          const seq = run.slice(s, s + length)
          const seqStart = seq[0]
          if (seqStart > minStartValue) {
            const combo: Card[] = []
            let ok = true
            for (const v of seq) {
              const cardsOfValue = sortCardsAsc(groups.get(v) || [])
              if (cardsOfValue.length === 0) {
                ok = false
                break
              }
              combo.push(cardsOfValue[0])
            }
            if (ok) {
              combos.push(combo)
            }
          }
        }
      }
      start = i
    }
  }

  combos.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return combos
}

const findBiggerPairSequences = (hand: Card[], minStartValue: number, length: number): Card[][] => {
  if (length < 6 || length % 2 !== 0) return []

  const requiredPairs = length / 2
  const groups = groupByValue(hand)
  const pairValues = Array.from(groups.entries())
    .filter(([, cards]) => cards.length >= 2)
    .map(([value]) => value)
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  const combos: Card[][] = []
  let start = 0
  for (let i = 1; i <= pairValues.length; i++) {
    if (i === pairValues.length || pairValues[i] !== pairValues[i - 1] + 1) {
      const run = pairValues.slice(start, i)
      if (run.length >= requiredPairs) {
        for (let s = 0; s + requiredPairs <= run.length; s++) {
          const seq = run.slice(s, s + requiredPairs)
          const seqStart = seq[0]
          if (seqStart > minStartValue) {
            const combo: Card[] = []
            let ok = true
            for (const v of seq) {
              const cardsOfValue = sortCardsAsc(groups.get(v) || [])
              if (cardsOfValue.length < 2) {
                ok = false
                break
              }
              combo.push(cardsOfValue[0], cardsOfValue[1])
            }
            if (ok) {
              combos.push(combo)
            }
          }
        }
      }
      start = i
    }
  }

  combos.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return combos
}

const findBiggerTriples = (hand: Card[], minValue: number): Card[][] => {
  const result: Card[][] = []
  const groups = groupByValue(hand)
  for (const [value, cards] of groups.entries()) {
    if (value > minValue && (cards.length === 3 || cards.length > 3)) {
      const sorted = sortCardsAsc(cards)
      result.push(sorted.slice(0, 3))
    }
  }
  result.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return result
}

const findBiggerTripleWithSingles = (hand: Card[], minTripleValue: number): Card[][] => {
  const results: Card[][] = []
  const groups = groupByValue(hand)
  const entries = Array.from(groups.entries()).sort(([a], [b]) => a - b)

  // 预先计算所有可能顺子涉及到的点数，用于判断某个单牌是否是顺子关键牌
  const straights = findAllStraights(hand)
  const straightValueSet = new Set<number>()
  for (const straight of straights) {
    for (const card of straight) {
      straightValueSet.add(getCardValue(card))
    }
  }

  type KickCandidate = { card: Card; value: number; cost: number }

  for (const [value, cardsOfValue] of entries) {
    if (value <= minTripleValue || cardsOfValue.length < 3) continue

    const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

    // 计算所有可作为三带一“单牌”的候选，并按代价排序
    const remaining = sortCardsAsc(hand).filter((c) => getCardValue(c) !== value)
    const kicks: KickCandidate[] = []

    for (const card of remaining) {
      const v = getCardValue(card)
      const groupSize = groups.get(v)?.length ?? 0

      const isCriticalSingle = groupSize === 1 && straightValueSet.has(v)
      const baseCost =
        groupSize === 1 ? 0 : groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
      const fullCost = baseCost + (isCriticalSingle ? 100 : 0)

      kicks.push({ card, value: v, cost: fullCost })
    }

    kicks.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost
      if (a.value !== b.value) return a.value - b.value
      return getCardValue(a.card) - getCardValue(b.card)
    })

    for (const k of kicks) {
      results.push([...triple, k.card])
    }
  }

  return results
}

const findBiggerTripleWithPairs = (hand: Card[], minTripleValue: number): Card[][] => {
  const results: Card[][] = []
  const groups = groupByValue(hand)
  const entries = Array.from(groups.entries()).sort(([a], [b]) => a - b)

  for (const [value, cardsOfValue] of entries) {
    if (value <= minTripleValue || cardsOfValue.length < 3) continue
    const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

    // 选择作为三带二“对子”的候选时，使用与 findBiggerPairs 类似的代价模型
    // 预先计算所有可能顺子涉及到的点数
    const straights = findAllStraights(hand)
    const straightValueSet = new Set<number>()
    for (const straight of straights) {
      for (const card of straight) {
        straightValueSet.add(getCardValue(card))
      }
    }

    type PairKickCandidate = { cards: Card[]; value: number; cost: number }
    const pairKicks: PairKickCandidate[] = []

    for (const [pairValue, pairCards] of entries) {
      if (pairValue === value || pairCards.length < 2) continue

      const sortedPair = sortCardsAsc(pairCards)
      const pair: Card[] = [sortedPair[0], sortedPair[1]]
      const groupSize = pairCards.length

      // 拆掉这一对后剩余张数
      const remainingAfterPair = groupSize - 2
      const breaksStraight = remainingAfterPair <= 0 && straightValueSet.has(pairValue)

      const baseCost = groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
      const fullCost = baseCost + (breaksStraight ? 100 : 0)

      pairKicks.push({ cards: pair, value: pairValue, cost: fullCost })
    }

    pairKicks.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost
      if (a.value !== b.value) return a.value - b.value
      return getCardValue(a.cards[0]) - getCardValue(b.cards[0])
    })

    for (const k of pairKicks) {
      results.push([...triple, ...k.cards])
    }
  }

  return results
}

const findBiggerFourWithTwo = (hand: Card[], minFourValue: number, length: number): Card[][] => {
  if (length !== 6 && length !== 8) return []

  const results: Card[][] = []
  const groups = groupByValue(hand)
  const entries = Array.from(groups.entries()).sort(([a], [b]) => a - b)

  // 预先计算所有可能顺子涉及到的点数
  const straights = findAllStraights(hand)
  const straightValueSet = new Set<number>()
  for (const straight of straights) {
    for (const card of straight) {
      straightValueSet.add(getCardValue(card))
    }
  }

  for (const [value, cardsOfValue] of entries) {
    if (value <= minFourValue || cardsOfValue.length < 4) continue

    const four = sortCardsAsc(cardsOfValue).slice(0, 4)
    const remaining = sortCardsAsc(hand).filter((c) => getCardValue(c) !== value)

    if (length === 6) {
      if (remaining.length >= 2) {
        // 选择两张“带牌”单牌，使用与 findBiggerSingles 类似的代价模型
        type SingleKickCandidate = { card: Card; value: number; cost: number }
        const kicks: SingleKickCandidate[] = []

        const remainingGroups = groupByValue(remaining)
        const remainingValues = Array.from(remainingGroups.keys()).sort((a, b) => a - b)

        for (const v of remainingValues) {
          const cardsOfV = sortCardsAsc(remainingGroups.get(v) || [])
          const groupSize = cardsOfV.length
          if (groupSize === 0) continue

          const isCriticalSingle = groupSize === 1 && straightValueSet.has(v)
          const baseCost =
            groupSize === 1 ? 0 : groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
          const fullCost = baseCost + (isCriticalSingle ? 100 : 0)

          for (const c of cardsOfV) {
            kicks.push({ card: c, value: v, cost: fullCost })
          }
        }

        kicks.sort((a, b) => {
          if (a.cost !== b.cost) return a.cost - b.cost
          if (a.value !== b.value) return a.value - b.value
          return getCardValue(a.card) - getCardValue(b.card)
        })

        if (kicks.length >= 2) {
          results.push([...four, kicks[0].card, kicks[1].card])
        }
      }
    } else {
      const remainingGroups = groupByValue(remaining)
      type PairCandidate = { cards: Card[]; value: number; cost: number }
      const pairCandidates: PairCandidate[] = []

      for (const [v, cards] of remainingGroups.entries()) {
        if (cards.length < 2) continue
        const sortedPair = sortCardsAsc(cards)
        const pair: Card[] = [sortedPair[0], sortedPair[1]]
        const groupSize = cards.length

        const remainingAfterPair = groupSize - 2
        const breaksStraight = remainingAfterPair <= 0 && straightValueSet.has(v)

        const baseCost = groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
        const fullCost = baseCost + (breaksStraight ? 100 : 0)

        pairCandidates.push({ cards: pair, value: v, cost: fullCost })
      }

      pairCandidates.sort((a, b) => {
        if (a.cost !== b.cost) return a.cost - b.cost
        if (a.value !== b.value) return a.value - b.value
        return getCardValue(a.cards[0]) - getCardValue(b.cards[0])
      })

      if (pairCandidates.length >= 2) {
        const firstPair = pairCandidates[0]
        const secondPair = pairCandidates[1]
        results.push([...four, ...firstPair.cards, ...secondPair.cards])
      }
    }
  }

  return results
}

const findBiggerBombs = (hand: Card[], minValue: number): Card[][] => {
  const result: Card[][] = []
  const groups = groupByValue(hand)
  for (const [value, cards] of groups.entries()) {
    if (value > minValue && cards.length === 4) {
      result.push(sortCardsAsc(cards))
    }
  }
  result.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return result
}

export class CardHintHelper {
  // 全局提示索引，用于同一轮中循环提示不同组合
  private static hintIndex = 0

  static resetHintIndex() {
    this.hintIndex = 0
  }

  /**
   * 如果整手牌本身就是一个完整牌型，返回这手牌（按排序后的顺序）
   * 用于只剩一手牌时的自动出牌
   */
  static getFullHandIfSinglePattern(playerHand: Card[]): Card[] | null {
    if (!playerHand || playerHand.length === 0) return null

    const pattern = detectSimplePattern(playerHand)
    if (!pattern) return null
    if (pattern.length !== playerHand.length) return null

    return sortCardsAsc(playerHand)
  }

  /**
   * 获取一手提示牌
   * @param playerHand 当前玩家手牌（字符串格式）
   * @param lastPlayed 上家出的牌（只用 cards 来推断简单牌型），为空表示新一轮/首次出牌
   */
  static getHint(playerHand: Card[], lastPlayed: Card[] | null): Card[] | null {
    if (!playerHand || playerHand.length === 0) {
      return null
    }

    const hand = sortCardsAsc(playerHand)
    let allHints: Card[][] = []

    if (!lastPlayed || lastPlayed.length === 0) {
      // 首次出牌或新一轮：给出所有可选组合
      allHints = this.getAllFirstPlayHints(hand)
    } else {
      const pattern = detectSimplePattern(lastPlayed)
      if (!pattern) {
        // 复杂牌型暂时只提示炸弹/王炸
        allHints = this.getBombAndRocketHints(hand)
      } else {
        allHints = this.getAllBeatingHints(hand, pattern)
      }
    }

    if (!allHints || allHints.length === 0) {
      return null
    }

    const index = this.hintIndex % allHints.length
    this.hintIndex++
    return allHints[index]
  }

  // 首次出牌：优先提示张数多的牌型，其次是小牌
  private static getAllFirstPlayHints(hand: Card[]): Card[][] {
    const nonPower: Card[][] = []
    const power: Card[][] = []

    const straights = findAllStraights(hand)
    const pairSequences = findAllPairSequences(hand)
    const tripleWithSingles = findAllTripleWithSingles(hand)
    const tripleWithPairs = findAllTripleWithPairs(hand)
    const triples = findAllTriples(hand)
    const pairs = findAllPairs(hand)
    const singles = findAllSingles(hand)
    const fourWithTwo = findAllFourWithTwo(hand)
    const bombs = findAllBombs(hand)
    const rocket = detectRocketInHand(hand)

    nonPower.push(...straights)
    nonPower.push(...pairSequences)
    nonPower.push(...tripleWithSingles)
    nonPower.push(...tripleWithPairs)
    nonPower.push(...triples)
    nonPower.push(...pairs)
    nonPower.push(...singles)

    power.push(...fourWithTwo)
    power.push(...bombs)
    if (rocket.hasRocket) {
      power.push(rocket.cards)
    }

    const dedupe = (combos: Card[][]): Card[][] => {
      const unique: Card[][] = []
      const seen = new Set<string>()
      for (const combo of combos) {
        const key = sortCardsAsc(combo).join(',')
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(combo)
        }
      }
      return unique
    }

    const getMinValue = (combo: Card[]): number => {
      let min = Infinity
      for (const c of combo) {
        const v = getCardValue(c)
        if (v < min) min = v
      }
      return min === Infinity ? 0 : min
    }

    const sortByPriority = (combos: Card[][]): Card[][] => {
      return combos.sort((a, b) => {
        const minA = getMinValue(a)
        const minB = getMinValue(b)
        if (minA !== minB) return minA - minB
        if (a.length !== b.length) return b.length - a.length
        return getCardValue(a[0]) - getCardValue(b[0])
      })
    }

    const uniqueNonPower = sortByPriority(dedupe(nonPower))
    const uniquePower = sortByPriority(dedupe(power))

    return [...uniqueNonPower, ...uniquePower]
  }

  // 跟牌：根据简单牌型查找所有能压过的组合
  private static getAllBeatingHints(hand: Card[], pattern: SimplePattern): Card[][] {
    const sameTypeHints: Card[][] = []

    switch (pattern.type) {
      case 'single': {
        sameTypeHints.push(...findBiggerSingles(hand, pattern.value))
        break
      }
      case 'pair': {
        sameTypeHints.push(...findBiggerPairs(hand, pattern.value))
        break
      }
      case 'triple': {
        sameTypeHints.push(...findBiggerTriples(hand, pattern.value))
        break
      }
      case 'triple_with_single': {
        sameTypeHints.push(...findBiggerTripleWithSingles(hand, pattern.value))
        break
      }
      case 'triple_with_pair': {
        sameTypeHints.push(...findBiggerTripleWithPairs(hand, pattern.value))
        break
      }
      case 'bomb': {
        sameTypeHints.push(...findBiggerBombs(hand, pattern.value))
        break
      }
      case 'straight': {
        sameTypeHints.push(...findBiggerStraights(hand, pattern.value, pattern.length))
        break
      }
      case 'pair_sequence': {
        sameTypeHints.push(...findBiggerPairSequences(hand, pattern.value, pattern.length))
        break
      }
      case 'four_with_two': {
        sameTypeHints.push(...findBiggerFourWithTwo(hand, pattern.value, pattern.length))
        break
      }
    }

    // 除了炸弹本身，任何牌型都可以额外用炸弹/王炸压
    const bombsAndRocket: Card[][] = []
    if (pattern.type !== 'bomb') {
      const bombs = findAllBombs(hand)
      bombsAndRocket.push(...bombs)

      const rocket = detectRocketInHand(hand)
      if (rocket.hasRocket) {
        bombsAndRocket.push(rocket.cards)
      }
    }

    sameTypeHints.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length
      // 对于长度相同的组合，保留原有顺序，以尊重各 findBigger* 函数内部的代价排序
      return 0
    })

    bombsAndRocket.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length
      return getCardValue(a[0]) - getCardValue(b[0])
    })

    const result: Card[][] = []
    const seen = new Set<string>()
    const pushUnique = (combo: Card[]) => {
      const key = sortCardsAsc(combo).join(',')
      if (!seen.has(key)) {
        seen.add(key)
        result.push(combo)
      }
    }

    for (const combo of sameTypeHints) {
      pushUnique(combo)
    }
    for (const combo of bombsAndRocket) {
      pushUnique(combo)
    }

    return result
  }

  // 仅提供炸弹和王炸提示（用于复杂牌型暂不支持时）
  private static getBombAndRocketHints(hand: Card[]): Card[][] {
    const hints: Card[][] = []
    const bombs = findAllBombs(hand)
    hints.push(...bombs)

    const rocket = detectRocketInHand(hand)
    if (rocket.hasRocket) {
      hints.push(rocket.cards)
    }

    // 按张数和点数排序
    hints.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length
      return getCardValue(a[0]) - getCardValue(b[0])
    })

    return hints
  }
}
