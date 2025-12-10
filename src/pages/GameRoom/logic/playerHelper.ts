/**
 * Player Helper Functions
 */

export function getPlayerPositions(players: any[], user: any) {
  if (!user) {
    return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
  }

  const filteredPlayers = Array.isArray(players)
    ? players.filter((p: any) => p && (p.id || p.name))
    : []

  if (filteredPlayers.length === 0) {
    return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
  }

  const myIndex = filteredPlayers.findIndex(
    (p: any) => p.id === user.id || p.name === user.name
  )

  if (myIndex === -1) {
    return { leftPlayer: null, rightPlayer: null, currentPlayer: null }
  }

  const currentPlayer = filteredPlayers[myIndex]

  const leftPlayer = filteredPlayers.length >= 2
    ? filteredPlayers[(myIndex - 1 + filteredPlayers.length) % filteredPlayers.length]
    : null

  const rightPlayer = filteredPlayers.length >= 3
    ? filteredPlayers[(myIndex + 1) % filteredPlayers.length]
    : null

  return { leftPlayer, rightPlayer, currentPlayer }
}

export function isLandlordPlayer(player: any | null, landlordId: string | null): boolean {
  if (!player || !landlordId) return false
  const ids = [player.id, (player as any)?.userId, player.name].filter(Boolean)
  return ids.includes(landlordId)
}

export function getAvatarClassName(avatar: string | undefined): { type: 'sprite' | 'text', value: string } {
  const raw = (avatar || '').trim()
  const match = raw.match(/^avatar-(\d+)$/)
  if (match) {
    const id = Number(match[1])
    if (!Number.isNaN(id) && id > 0) {
      return { type: 'sprite', value: `avatar-sprite avatar-${id} avatar-sprite-small` }
    }
  }
  return { type: 'text', value: raw || '👤' }
}

export function getRemainingCardsForPlayer(
  player: any | null,
  remainingHandsMap: any
): string[] | null {
  if (!player || !remainingHandsMap) return null
  
  const id = player.id || player.name
  if (id && remainingHandsMap[id]) {
    const info = remainingHandsMap[id]
    if (info && Array.isArray(info.cards) && info.cards.length > 0) {
      return info.cards as string[]
    }
  }
  return null
}
