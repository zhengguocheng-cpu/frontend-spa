import { useEffect, useState } from 'react'
import { Card } from 'antd'
import { SpinLoading } from 'antd-mobile'
import { useAuth } from '@/context/AuthContext'
import { formatScore } from '@/utils/scoreFormatter'
import './style.css'

 interface LeaderboardEntry {
  rank: number
  userId: string
  username?: string
  value: number
  gamesPlayed: number
  winRate: number
}

export default function Leaderboard() {
  const { user } = useAuth()

  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()

    const loadLeaderboard = async () => {
      try {
        setLoading(true)
        setError(null)

        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        // 固定使用积分排行榜
        const res = await fetch(`${baseUrl}/api/score/leaderboard/score`, {
          signal: controller.signal,
        })

        let json: any = null
        try {
          json = await res.json()
        } catch (e) {
          // ignore body parse error
        }

        if (!res.ok || !json?.success || !Array.isArray(json.data)) {
          console.warn('加载排行榜失败或返回结构异常:', res.status, json?.message)
          setData([])
          setError('加载排行榜失败，请稍后重试')
          return
        }

        setData(json.data)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载排行榜异常:', err)
        setData([])
        setError('加载排行榜失败，请检查网络后重试')
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()

    return () => {
      controller.abort()
    }
  }, [user])

  if (!user) {
    return null
  }

  const formatWinRate = (v: number | null | undefined) => {
    // 后端 winRate 已经是 0-100 的百分数，这里只做格式化，不再乘以 100
    if (v == null) return '0.0%'
    return `${Number(v).toFixed(1)}%`
  }

  const scoreHeaderLabel = '积分'

  return (
    <div className="leaderboard-page">
      <Card className="leaderboard-card" variant="borderless">
        <div className="leaderboard-header-row">
          <div className="leaderboard-header-left" />
          <div className="leaderboard-header-center">
            <h1 className="leaderboard-title">🏆 排行榜</h1>
          </div>
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-table-header">
            <div className="col-rank">排名</div>
            <div className="col-player">玩家</div>
            <div className="col-score">{scoreHeaderLabel}</div>
            <div className="col-games">场次</div>
            <div className="col-winrate">胜率</div>
          </div>

          <div className="leaderboard-table-body">
            {loading && (
              <div className="leaderboard-loading">
                <SpinLoading style={{ '--size': '32px' }} />
                <span>加载中...</span>
              </div>
            )}

            {!loading && error && <div className="leaderboard-empty">{error}</div>}

            {!loading && !error && data.length === 0 && (
              <div className="leaderboard-empty">暂无排行榜数据</div>
            )}

            {!loading && !error &&
              data.map((entry) => {
                const isMe = entry.userId === user.id
                const rankIcon =
                  entry.rank === 1
                    ? '🥇'
                    : entry.rank === 2
                      ? '🥈'
                      : entry.rank === 3
                        ? '🥉'
                        : entry.rank

                const scoreText = formatScore(entry.value ?? 0)

                return (
                  <div
                    key={entry.userId + '-' + entry.rank}
                    className={
                      'leaderboard-row ' + (isMe ? 'me' : '') + (entry.rank <= 3 ? ` top${entry.rank}` : '')
                    }
                  >
                    <div className="col-rank">{rankIcon}</div>
                    <div className="col-player">
                      <div className="player-avatar">👤</div>
                      <div className="player-name">{entry.username || entry.userId}</div>
                    </div>
                    <div className="col-score">{scoreText}</div>
                    <div className="col-games">{entry.gamesPlayed ?? 0}</div>
                    <div className="col-winrate">{formatWinRate(entry.winRate)}</div>
                  </div>
                )
              })}
          </div>
        </div>
      </Card>
    </div>
  )
}
