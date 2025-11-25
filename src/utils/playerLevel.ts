export interface PlayerLevelInfo {
  name: string
  icon: string
}

/**
 * 根据总积分（例如金币数）计算玩家段位
 * 阈值示例（可与后端约定统一）：
 *  - 青铜I: < 100_000
 *  - 青铜II: 100_000 - 399_999
 *  - 白银: 400_000 - 999_999  （首登 50 万落在这里）
 *  - 黄金: 1_000_000 - 1_999_999
 *  - 钻石: 2_000_000 - 4_999_999
 *  - 王者: >= 5_000_000
 */
export function getLevelByScore(rawScore: number | null | undefined): PlayerLevelInfo {
  const score = typeof rawScore === 'number' && rawScore > 0 ? rawScore : 0

  if (score >= 5_000_000) {
    return { name: '王者', icon: '👑' }
  }

  if (score >= 2_000_000) {
    return { name: '钻石', icon: '💎' }
  }

  if (score >= 1_000_000) {
    return { name: '黄金', icon: '🥇' }
  }

  if (score >= 400_000) {
    // 首登 50 万金币会落在这里
    return { name: '白银', icon: '🏅' }
  }

  if (score >= 100_000) {
    return { name: '青铜Ⅱ', icon: '🏆' }
  }

  return { name: '青铜Ⅰ', icon: '🏆' }
}
