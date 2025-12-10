/**
 * Wallet Score Helper Functions
 */

export async function fetchPlayerScore(userId: string): Promise<number | null> {
  try {
    const baseUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin

    const res = await fetch(
      `${baseUrl}/api/score/${encodeURIComponent(userId)}`,
    )

    let json: any = null
    try {
      json = await res.json()
    } catch {
      // ignore parse error
    }

    if (!res.ok || !json?.success || !json.data) {
      return 0
    }

    const data = json.data
    const scoreValue = typeof data.totalScore === 'number' ? data.totalScore : 0
    return scoreValue
  } catch (err: any) {
    return 0
  }
}
