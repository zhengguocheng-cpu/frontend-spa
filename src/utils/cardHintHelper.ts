import type { Card } from '../store/slices/gameSlice'

// 简化版出牌提示助手
// 目前支持的牌型：单牌、对子、三张、炸弹、王炸
// 后续可以逐步扩展顺子、连对、飞机等高级牌型

export type SimplePatternType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'bomb'
  | 'rocket'
  | 'straight'
  | 'pair_sequence'
  | 'triple_with_single'
  | 'triple_with_pair'
  | 'four_with_two'
  | 'airplane'
  | 'airplane_with_wings'

export interface SimplePattern {
  type: SimplePatternType
  value: number
  length: number
  wingsType?: 'single' | 'pair'
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

const HIGH_CARD_VALUE = RANK_VALUES['A']
const isHighPowerValue = (v: number): boolean => v >= HIGH_CARD_VALUE

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

interface StructureValueSets {
  straight: Set<number>
  pairSequence: Set<number>
  airplaneTriple: Set<number>
}

// 计算当前手牌中各类“结构牌型”（顺子、连对、飞机）的核心点数集合
const getStructureValueSets = (hand: Card[]): StructureValueSets => {
  const groups = groupByValue(hand)

  const straight = new Set<number>()
  const pairSequence = new Set<number>()
  const airplaneTriple = new Set<number>()

  const allValues = Array.from(groups.keys())
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  // 顺子：任意长度>=5的连续点数段中的所有点数
  let start = 0
  for (let i = 1; i <= allValues.length; i++) {
    if (i === allValues.length || allValues[i] !== allValues[i - 1] + 1) {
      const run = allValues.slice(start, i)
      if (run.length >= 5) {
        for (const v of run) {
          straight.add(v)
        }
      }
      start = i
    }
  }

  // 连对：每个点数至少2张，且连续对数>=3
  const pairValues = allValues.filter((v) => (groups.get(v) || []).length >= 2)
  start = 0
  for (let i = 1; i <= pairValues.length; i++) {
    if (i === pairValues.length || pairValues[i] !== pairValues[i - 1] + 1) {
      const run = pairValues.slice(start, i)
      if (run.length >= 3) {
        for (const v of run) {
          pairSequence.add(v)
        }
      }
      start = i
    }
  }

  // 飞机：每个点数至少3张，且连续三张的组数>=2
  const tripleValues = allValues.filter((v) => (groups.get(v) || []).length >= 3)
  start = 0
  for (let i = 1; i <= tripleValues.length; i++) {
    if (i === tripleValues.length || tripleValues[i] !== tripleValues[i - 1] + 1) {
      const run = tripleValues.slice(start, i)
      if (run.length >= 2) {
        for (const v of run) {
          airplaneTriple.add(v)
        }
      }
      start = i
    }
  }

  return { straight, pairSequence, airplaneTriple }
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

  // 王炸（大王 + 小王）：两张牌，点数分别是 16 和 17
  if (length === 2) {
    const rocket = detectRocketInHand(cards)
    if (rocket.hasRocket && rocket.cards.length === 2) {
      const valuesSet = new Set(values)
      if (valuesSet.has(RANK_VALUES['小王']) && valuesSet.has(RANK_VALUES['大王'])) {
        return { type: 'rocket', value: RANK_VALUES['大王'], length }
      }
    }
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

  // 飞机（连续三张）及飞机带翅膀
  if (length >= 6) {
    const groups = groupByValue(sorted)
    const entries = Array.from(groups.entries())

    // 找出所有三张以上且不含 2 / 王 的点数
    const tripleEntries = entries.filter(([value, groupCards]) => {
      const count = groupCards.length
      return count >= 3 && value >= 3 && value <= 14
    })

    if (tripleEntries.length >= 2) {
      const tripleValues = tripleEntries
        .map(([value]) => value)
        .sort((a, b) => a - b)

      // 检查三张是否连续
      let consecutive = true
      for (let i = 1; i < tripleValues.length; i++) {
        if (tripleValues[i] !== tripleValues[i - 1] + 1) {
          consecutive = false
          break
        }
      }

      if (consecutive) {
        const planeCount = tripleValues.length
        const bodyCardsCount = planeCount * 3
        const wingsCount = length - bodyCardsCount

        // 纯飞机：仅由连续三张组成
        if (wingsCount === 0 && bodyCardsCount === length) {
          const minTripleValue = tripleValues[0]
          // length 使用总牌数，便于后续根据牌数推断飞机结构
          return { type: 'airplane', value: minTripleValue, length }
        }

        // 飞机带翅膀：三张部分 + 单牌 / 对子
        if (wingsCount > 0 && wingsCount % planeCount === 0) {
          const minTripleValue = tripleValues[0]
          const wingsPerPlane = wingsCount / planeCount

          // 检查翅膀结构是否符合：
          // wingsPerPlane === 1 -> 每个三张带1张单牌
          // wingsPerPlane === 2 -> 每个三张带1对
          if (wingsPerPlane === 1 || wingsPerPlane === 2) {
            // 校验各点数的张数分布是否只由三张 + 单牌/对子构成
            let valid = true
            let singleRanks = 0
            let pairRanks = 0

            const tripleValueSet = new Set(tripleValues)

            for (const [value, groupCards] of entries) {
              const count = groupCards.length
              if (tripleValueSet.has(value)) {
                // 三张点数必须正好是 3 张
                if (count !== 3) {
                  valid = false
                  break
                }
              } else {
                if (count === 1) {
                  singleRanks++
                } else if (count === 2) {
                  pairRanks++
                } else {
                  // 出现了 3/4 张等其他数量，不符合飞机带翅膀
                  valid = false
                  break
                }
              }
            }

            if (valid) {
              if (wingsPerPlane === 1 && singleRanks === planeCount) {
                return {
                  type: 'airplane_with_wings',
                  value: minTripleValue,
                  length,
                  wingsType: 'single',
                }
              }
              if (wingsPerPlane === 2 && pairRanks === planeCount) {
                return {
                  type: 'airplane_with_wings',
                  value: minTripleValue,
                  length,
                  wingsType: 'pair',
                }
              }
            }
          }
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
    // 只使用恰好三张的点数，不从炸弹中拆三张
    if (cards.length === 3) {
      triples.push(sortCardsAsc(cards))
    }
  }
  triples.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return triples
}

const findAllPairs = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const pairs: Card[][] = []
  for (const cards of groups.values()) {
    // 只从2张或3张中取对子，避免从炸弹中拆对子
    if (cards.length === 2 || cards.length === 3) {
      const sorted = sortCardsAsc(cards)
      pairs.push([sorted[0], sorted[1]])
    }
  }
  pairs.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]))
  return pairs
}

const findAllSingles = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const sorted = sortCardsAsc(hand)
  // 首轮提示中不从炸弹拆单牌
  return sorted
    .filter((c) => (groups.get(getCardValue(c)) || []).length < 4)
    .map((c) => [c])
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
  const entries = Array.from(groups.entries()).sort(([a], [b]) => a - b)
  const results: Card[][] = []
  const totalLen = hand.length

  for (const [value, cardsOfValue] of entries) {
    // 三张部分只使用恰好三张的点数，避免从炸弹中拆三张
    if (cardsOfValue.length === 3) {
      const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

      const pairCandidates = entries.filter(([pairValue, pairCards]) => {
        if (pairValue === value) return false
        // 带的对子只从2张或3张中取，避免从炸弹拆对子
        return pairCards.length === 2 || pairCards.length === 3
      })

      if (pairCandidates.length === 0) continue

      if (pairCandidates.length > 1) {
        // 有不止一个对子时，直接用最小的对子
        const [, smallPairCards] = pairCandidates[0]
        const sortedPair = sortCardsAsc(smallPairCards)
        results.push([...triple, sortedPair[0], sortedPair[1]])
      } else {
        // 只有一个对子时，如果出完这手后牌已经很少，可以接受用这个对子；否则交给三带一去用小单
        const [, onlyPairCards] = pairCandidates[0]
        const remainingAfterTriplePair = totalLen - 5
        if (remainingAfterTriplePair <= 3) {
          const sortedPair = sortCardsAsc(onlyPairCards)
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

  // 计算当前手牌中所有可能顺子涉及到的点数（用于判断某张单牌是否是顺子关键点）
  const { straight, pairSequence, airplaneTriple } = getStructureValueSets(hand)

  type SingleCandidate = { card: Card; value: number; cost: number; groupSize: number }
  const candidates: SingleCandidate[] = []

  // 遍历所有点数，收集候选单牌
  for (const [value, cardsOfValue] of groups.entries()) {
    if (value <= minValue) continue
    const groupSize = cardsOfValue.length
    if (groupSize === 0) continue
    // 不从炸弹中拆单牌
    if (groupSize === 4) continue

    const isStraightCritical = groupSize === 1 && straight.has(value)
    const isPairSeqCritical = groupSize === 2 && pairSequence.has(value)
    const isAirplaneCritical = groupSize === 3 && airplaneTriple.has(value)
    const isCriticalSingle = isStraightCritical || isPairSeqCritical || isAirplaneCritical

    // 代价模型：
    // - 真正的单牌（groupSize=1）代价最低
    // - 拆对子和三张的代价大幅提高
    // - 破坏结构的牌代价极高
    const baseCost =
      groupSize === 1 ? 0 : groupSize === 2 ? 100 : groupSize === 3 ? 200 : 300
    const structurePenalty = isCriticalSingle ? 500 : 0
    const fullCost = baseCost + structurePenalty

    // 每个点数只添加一张牌（最小的那张），避免重复
    const sorted = sortCardsAsc(cardsOfValue)
    candidates.push({ card: sorted[0], value, cost: fullCost, groupSize })
  }

  // 排序优先级（关键修复）：
  // 1. 优先使用真正的单牌（groupSize=1）
  // 2. 在同类型中，优先使用点数小的（刚好能压过即可）
  // 3. 破坏结构的牌排在最后
  candidates.sort((a, b) => {
    // 首先按 groupSize 分组：单牌 < 对子 < 三张
    if (a.groupSize !== b.groupSize) return a.groupSize - b.groupSize
    // 同类型中，先按点数从小到大（关键！）
    if (a.value !== b.value) return a.value - b.value
    // 点数相同时，按 cost 排序（虽然点数相同的情况很少）
    return a.cost - b.cost
  })

  return candidates.map((c) => [c.card])
}

const findBiggerPairs = (hand: Card[], minValue: number): Card[][] => {
  const groups = groupByValue(hand)

  // 计算手牌中所有可能顺子涉及到的点数，用于判断拆掉某对是否会破坏顺子
  const { straight, pairSequence, airplaneTriple } = getStructureValueSets(hand)

  type PairCandidate = { cards: Card[]; value: number; cost: number; groupSize: number }
  const candidates: PairCandidate[] = []

  for (const [value, cards] of groups.entries()) {
    if (value <= minValue || cards.length < 2) continue
    // 不从炸弹中拆对子
    if (cards.length === 4) continue

    const sorted = sortCardsAsc(cards)
    const pair: Card[] = [sorted[0], sorted[1]]
    const groupSize = cards.length

    // 如果这一点数只有两张牌，并且在某个顺子中出现，则拆这对会破坏顺子
    const remainingAfterPair = groupSize - 2
    const breaksStraight = remainingAfterPair <= 0 && straight.has(value)
    const breaksPairSequence = remainingAfterPair < 2 && pairSequence.has(value)
    const breaksAirplane = airplaneTriple.has(value) && groupSize === 3

    // 修改代价模型：降低高牌惩罚，优先按点数从小到大
    const baseCost = groupSize === 2 ? 0 : groupSize === 3 ? 1 : 2
    const isHighPower = isHighPowerValue(value)
    const fullCost =
      baseCost +
      (breaksStraight || breaksPairSequence || breaksAirplane ? 100 : 0) +
      (isHighPower ? 10 : 0) // 降低高牌惩罚，让点数排序更重要

    candidates.push({ cards: pair, value, cost: fullCost, groupSize })
  }

  // 排序优先级（关键）：
  // 1. 先按 groupSize：真对子（2张）在前，拆三张（3张）在后
  // 2. 同一 groupSize 内，按点数从小到大（先 88，再 99，再 10 10 ...）
  // 3. 点数相同时再看 cost，尽量少破坏顺子/连对/飞机
  candidates.sort((a, b) => {
    if (a.groupSize !== b.groupSize) return a.groupSize - b.groupSize
    if (a.value !== b.value) return a.value - b.value
    return a.cost - b.cost
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

// 所有纯飞机（不带翅膀）：至少 2 组连续三张
const findAllPlanes = (hand: Card[]): Card[][] => {
  const groups = groupByValue(hand)
  const tripleValues = Array.from(groups.entries())
    .filter(([, cards]) => cards.length >= 3)
    .map(([value]) => value)
    .filter((v) => v >= 3 && v <= 14)
    .sort((a, b) => a - b)

  const candidateValueRuns: number[][] = []
  let start = 0
  for (let i = 1; i <= tripleValues.length; i++) {
    if (i === tripleValues.length || tripleValues[i] !== tripleValues[i - 1] + 1) {
      const run = tripleValues.slice(start, i)
      if (run.length >= 2) {
        for (let len = run.length; len >= 2; len--) {
          for (let s = 0; s + len <= run.length; s++) {
            candidateValueRuns.push(run.slice(s, s + len))
          }
        }
      }
      start = i
    }
  }

  const combos: Card[][] = []
  for (const seq of candidateValueRuns) {
    const combo: Card[] = []
    let ok = true
    for (const v of seq) {
      const cardsOfValue = sortCardsAsc(groups.get(v) || [])
      if (cardsOfValue.length < 3) {
        ok = false
        break
      }
      combo.push(cardsOfValue[0], cardsOfValue[1], cardsOfValue[2])
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

// 飞机带对子：每个三张带一个对子（总牌数 = 5 * planeCount）
const findAllPlanesWithPairs = (hand: Card[]): Card[][] => {
  const planes = findAllPlanes(hand)
  const results: Card[][] = []

  for (const plane of planes) {
    const planeCount = plane.length / 3
    if (planeCount < 2) continue

    const remaining = sortCardsAsc(hand).filter((c) => !plane.includes(c))
    const remainingGroups = groupByValue(remaining)
    const pairValues = Array.from(remainingGroups.entries())
      .filter(([, cards]) => cards.length >= 2)
      .map(([value]) => value)
      .sort((a, b) => a - b)

    if (pairValues.length < planeCount) continue

    const wings: Card[] = []
    for (let i = 0; i < planeCount; i++) {
      const v = pairValues[i]
      const cardsOfValue = sortCardsAsc(remainingGroups.get(v) || [])
      if (cardsOfValue.length < 2) {
        wings.length = 0
        break
      }
      wings.push(cardsOfValue[0], cardsOfValue[1])
    }

    if (wings.length === planeCount * 2) {
      results.push([...plane, ...wings])
    }
  }

  return results
}

// 飞机带单牌：每个三张带一张单牌（总牌数 = 4 * planeCount）
const findAllPlanesWithSingles = (hand: Card[]): Card[][] => {
  const planes = findAllPlanes(hand)
  const results: Card[][] = []

  for (const plane of planes) {
    const planeCount = plane.length / 3
    if (planeCount < 2) continue

    const remaining = sortCardsAsc(hand).filter((c) => !plane.includes(c))
    if (remaining.length < planeCount) continue

    const wings = remaining.slice(0, planeCount)
    results.push([...plane, ...wings])
  }

  return results
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

// 纯飞机（不带翅膀）跟牌：同组数、起点更大的连续三张
const findBiggerAirplanes = (hand: Card[], minStartValue: number, planeCount: number): Card[][] => {
  if (planeCount < 2) return []

  const groups = groupByValue(hand)
  const values = Array.from(groups.entries())
    .filter(([v, cards]) => v >= 3 && v <= 14 && cards.length >= 3)
    .map(([v]) => v)
    .sort((a, b) => a - b)

  const combos: Card[][] = []
  let start = 0

  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || values[i] !== values[i - 1] + 1) {
      const run = values.slice(start, i)
      if (run.length >= planeCount) {
        for (let s = 0; s + planeCount <= run.length; s++) {
          const seq = run.slice(s, s + planeCount)
          const seqStart = seq[0]
          if (seqStart > minStartValue) {
            const combo: Card[] = []
            let ok = true
            for (const v of seq) {
              const cardsOfValue = sortCardsAsc(groups.get(v) || [])
              if (cardsOfValue.length < 3) {
                ok = false
                break
              }
              combo.push(cardsOfValue[0], cardsOfValue[1], cardsOfValue[2])
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

// 飞机带翅膀跟牌：同组数、起点更大的飞机 + 同类型翅膀（单牌或对子）
const findBiggerAirplanesWithWings = (
  hand: Card[],
  minStartValue: number,
  planeCount: number,
  wingsType: 'single' | 'pair',
): Card[][] => {
  if (planeCount < 2) return []

  const groups = groupByValue(hand)
  const tripleValues = Array.from(groups.entries())
    .filter(([v, cards]) => v >= 3 && v <= 14 && cards.length >= 3)
    .map(([v]) => v)
    .sort((a, b) => a - b)

  const combos: Card[][] = []
  let start = 0

  for (let i = 1; i <= tripleValues.length; i++) {
    if (i === tripleValues.length || tripleValues[i] !== tripleValues[i - 1] + 1) {
      const run = tripleValues.slice(start, i)
      if (run.length >= planeCount) {
        for (let s = 0; s + planeCount <= run.length; s++) {
          const seq = run.slice(s, s + planeCount)
          const seqStart = seq[0]
          if (seqStart <= minStartValue) continue

          // 构造飞机主体
          const plane: Card[] = []
          let ok = true
          for (const v of seq) {
            const cardsOfValue = sortCardsAsc(groups.get(v) || [])
            if (cardsOfValue.length < 3) {
              ok = false
              break
            }
            plane.push(cardsOfValue[0], cardsOfValue[1], cardsOfValue[2])
          }
          if (!ok) continue

          const remaining = sortCardsAsc(hand).filter((c) => !plane.includes(c))
          const remainingGroups = groupByValue(remaining)
          const tripleValueSet = new Set(seq)

          if (wingsType === 'single') {
            // 每个三张带 1 张单牌：所有翅膀点数在组合中计数必须为 1，且不能与三张点数重复
            const wingValues = Array.from(remainingGroups.entries())
              .filter(([v, cards]) => !tripleValueSet.has(v) && cards.length >= 1)
              .map(([v]) => v)
              .sort((a, b) => a - b)

            if (wingValues.length < planeCount) continue

            const wings: Card[] = []
            for (let k = 0; k < planeCount; k++) {
              const v = wingValues[k]
              const cardsOfValue = sortCardsAsc(remainingGroups.get(v) || [])
              if (cardsOfValue.length === 0) {
                wings.length = 0
                break
              }
              // 只取一张，保证该点数在组合中计数为 1
              wings.push(cardsOfValue[0])
            }

            if (wings.length === planeCount) {
              combos.push([...plane, ...wings])
            }
          } else {
            // wingsType === 'pair'：每个三张带 1 对，翅膀点数不能与三张点数重复
            const wingValues = Array.from(remainingGroups.entries())
              .filter(([v, cards]) => !tripleValueSet.has(v) && cards.length >= 2)
              .map(([v]) => v)
              .sort((a, b) => a - b)

            if (wingValues.length < planeCount) continue

            const wings: Card[] = []
            for (let k = 0; k < planeCount; k++) {
              const v = wingValues[k]
              const cardsOfValue = sortCardsAsc(remainingGroups.get(v) || [])
              if (cardsOfValue.length < 2) {
                wings.length = 0
                break
              }
              wings.push(cardsOfValue[0], cardsOfValue[1])
            }

            if (wings.length === planeCount * 2) {
              combos.push([...plane, ...wings])
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
    // 只使用恰好三张的点数，不从炸弹中拆三张
    if (value > minValue && cards.length === 3) {
      const sorted = sortCardsAsc(cards)
      result.push(sorted)
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
  const { straight, pairSequence, airplaneTriple } = getStructureValueSets(hand)

  type KickCandidate = { card: Card; value: number; cost: number }

  for (const [value, cardsOfValue] of entries) {
    // 三张部分只使用恰好三张的点数，避免从炸弹拆三张
    if (value <= minTripleValue || cardsOfValue.length !== 3) continue

    const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

    // 计算所有可作为三带一“单牌”的候选，并按代价排序
    const remaining = sortCardsAsc(hand).filter((c) => getCardValue(c) !== value)
    const kicks: KickCandidate[] = []

    for (const card of remaining) {
      const v = getCardValue(card)
      const groupSize = groups.get(v)?.length ?? 0

      const isStraightCritical = groupSize === 1 && straight.has(v)
      const isPairSeqCritical = groupSize === 2 && pairSequence.has(v)
      const isAirplaneCritical = groupSize === 3 && airplaneTriple.has(v)
      const isCriticalSingle = isStraightCritical || isPairSeqCritical || isAirplaneCritical
      const baseCost =
        groupSize === 1 ? 0 : groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
      const isHighPower = isHighPowerValue(v)
      const fullCost = baseCost + (isCriticalSingle ? 100 : 0) + (isHighPower ? 120 : 0)

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

  const { straight, pairSequence, airplaneTriple } = getStructureValueSets(hand)

  for (const [value, cardsOfValue] of entries) {
    // 三张部分只使用恰好三张的点数，避免从炸弹拆三张
    if (value <= minTripleValue || cardsOfValue.length !== 3) continue
    const triple = sortCardsAsc(cardsOfValue).slice(0, 3)

    type PairKickCandidate = { cards: Card[]; value: number; cost: number }
    const pairKicks: PairKickCandidate[] = []

    for (const [pairValue, pairCards] of entries) {
      if (pairValue === value || pairCards.length < 2) continue

      const sortedPair = sortCardsAsc(pairCards)
      const pair: Card[] = [sortedPair[0], sortedPair[1]]
      const groupSize = pairCards.length

      // 拆掉这一对后剩余张数
      const remainingAfterPair = groupSize - 2
      const breaksStraight = remainingAfterPair <= 0 && straight.has(pairValue)
      const breaksPairSequence = remainingAfterPair < 2 && pairSequence.has(pairValue)
      const breaksAirplane = airplaneTriple.has(pairValue) && groupSize === 3

      const baseCost = groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
      const isHighPower = isHighPowerValue(pairValue)
      const fullCost =
        baseCost +
        (breaksStraight || breaksPairSequence || breaksAirplane ? 100 : 0) +
        (isHighPower ? 120 : 0)

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
  const { straight, pairSequence, airplaneTriple } = getStructureValueSets(hand)

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

          const isStraightCritical = groupSize === 1 && straight.has(v)
          const isPairSeqCritical = groupSize === 2 && pairSequence.has(v)
          const isAirplaneCritical = groupSize === 3 && airplaneTriple.has(v)
          const isCriticalSingle = isStraightCritical || isPairSeqCritical || isAirplaneCritical
          const baseCost =
            groupSize === 1 ? 0 : groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
          const isHighPower = isHighPowerValue(v)
          const fullCost = baseCost + (isCriticalSingle ? 100 : 0) + (isHighPower ? 120 : 0)

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
        const breaksStraight = remainingAfterPair <= 0 && straight.has(v)
        const breaksPairSequence = remainingAfterPair < 2 && pairSequence.has(v)
        const breaksAirplane = airplaneTriple.has(v) && groupSize === 3

        const baseCost = groupSize === 2 ? 1 : groupSize === 3 ? 2 : 3
        const fullCost = baseCost + (breaksStraight || breaksPairSequence || breaksAirplane ? 100 : 0)

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
   * 获取当前局面下的所有候选出牌组合（不做轮换）
   * 用于在调用大模型前做本地预判：0 个候选自动不出，1 个候选直接使用
   */
  static getAllHints(playerHand: Card[], lastPlayed: Card[] | null): Card[][] {
    if (!playerHand || playerHand.length === 0) return []

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

    if (!allHints || allHints.length === 0) return []
    return allHints
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
   * 判断整手牌在“牌型相同”的前提下，是否能够压过上家的牌
   * - 如果 lastPlayed 为空，视为可以出（首家 / 新一轮）
   * - 仅当牌型相同、长度相同且 fullHand 的主牌值大于 lastPlayed 时返回 true
   */
  static canFullHandBeatLast(fullHand: Card[], lastPlayed: Card[] | null): boolean {
    if (!fullHand || fullHand.length === 0) return false

    const selfPattern = detectSimplePattern(fullHand)
    if (!selfPattern) return false

    // 如果整手牌是王炸：
    // - 无上家牌：可以直接出
    // - 上家不是王炸：可以直接压过
    // - 上家也是王炸：无法再压过
    if (selfPattern.type === 'rocket') {
      if (!lastPlayed || lastPlayed.length === 0) {
        return true
      }

      const lastPatternForRocket = detectSimplePattern(lastPlayed)
      if (!lastPatternForRocket) return true
      return lastPatternForRocket.type !== 'rocket'
    }

    if (!lastPlayed || lastPlayed.length === 0) {
      // 无上家牌：首家/新一轮，默认允许整手牌出
      return true
    }

    const lastPattern = detectSimplePattern(lastPlayed)
    if (!lastPattern) return false

    // 炸弹自动出牌规则：
    // - 对方不是炸弹/王炸：可以直接压过
    // - 双方都是炸弹：点数大的可以压过
    // - 对方是王炸：无法压过
    if (selfPattern.type === 'bomb') {
      if (lastPattern.type === 'rocket') {
        return false
      }
      if (lastPattern.type !== 'bomb') {
        return true
      }
      // 双方都是炸弹时，比点数
      return selfPattern.value > lastPattern.value
    }

    // 只在“牌型相同”的前提下自动出牌
    if (selfPattern.type !== lastPattern.type) return false

    // 长度（牌张数）必须一致
    if (selfPattern.length !== lastPattern.length) return false

    // 主牌值更大才算能压过
    return selfPattern.value > lastPattern.value
  }

  /**
   * 获取一手提示牌
   * @param playerHand 当前玩家手牌（字符串格式）
   * @param lastPlayed 上家出的牌（只用 cards 来推断简单牌型），为空表示新一轮/首次出牌
   */
  static getHint(playerHand: Card[], lastPlayed: Card[] | null): Card[] | null {
    const allHints = this.getAllHints(playerHand, lastPlayed)
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
    const planes = findAllPlanes(hand)
    const planesWithPairs = findAllPlanesWithPairs(hand)
    const planesWithSingles = findAllPlanesWithSingles(hand)
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
    nonPower.push(...planes)
    nonPower.push(...planesWithPairs)
    nonPower.push(...planesWithSingles)
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
        const OPENING_HIGH_THRESHOLD = RANK_VALUES['10']
        const hasHighA = a.some((c) => getCardValue(c) >= OPENING_HIGH_THRESHOLD)
        const hasHighB = b.some((c) => getCardValue(c) >= OPENING_HIGH_THRESHOLD)
        if (hasHighA !== hasHighB) return hasHighA ? 1 : -1
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

    // 王炸是绝对最大牌，后家无法压过，提示系统不提供任何出牌建议
    if (pattern.type === 'rocket') {
      return []
    }

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
      case 'airplane': {
        // 纯飞机：pattern.length 为总牌数，planeCount = length / 3
        if (pattern.length % 3 === 0) {
          const planeCount = pattern.length / 3
          if (planeCount >= 2) {
            sameTypeHints.push(...findBiggerAirplanes(hand, pattern.value, planeCount))
          }
        }
        break
      }
      case 'airplane_with_wings': {
        if (!pattern.wingsType) break

        const divisor = pattern.wingsType === 'single' ? 4 : 5
        if (pattern.length % divisor !== 0) break

        const planeCount = pattern.length / divisor
        if (planeCount >= 2) {
          sameTypeHints.push(
            ...findBiggerAirplanesWithWings(hand, pattern.value, planeCount, pattern.wingsType),
          )
        }
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
