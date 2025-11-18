import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from 'antd'
import { SpinLoading } from 'antd-mobile'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'
import './style.css'

 type RankType = 'score' | 'winRate'

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
  const navigate = useNavigate()

  const [type, setType] = useState<RankType>('score')
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

        const res = await fetch(`${baseUrl}/api/score/leaderboard/${type}`, {
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
  }, [type, user])

  if (!user) {
    return null
  }

  const formatWinRate = (v: number | null | undefined) => {
    // 后端 winRate 已经是 0-100 的百分数，这里只做格式化，不再乘以 100
    if (v == null) return '0.0%'
    return `${Number(v).toFixed(1)}%`
  }

  const handleChangeType = (next: RankType) => {
    if (next === type) return
    setType(next)
  }

  const scoreHeaderLabel = type === 'score' ? '积分' : '胜率'

  const handleBackToLobby = () => {
    try {
      const lastRoomId = sessionStorage.getItem('lastRoomId')
      if (lastRoomId) {
        try {
          globalSocket.leaveGame(lastRoomId)
        } catch (err) {
          console.warn('返回大厅时离开房间失败（可忽略）:', err)
        }
        sessionStorage.removeItem('lastRoomId')
        sessionStorage.removeItem('lastRoomTime')
      }
    } catch (e) {
      console.warn('清理房间缓存失败（可忽略）:', e)
    }

    navigate('/')
  }

  return (
    <div className="leaderboard-page">
      <Card className="leaderboard-card" bordered={false}>
        <div className="leaderboard-header-row">
          <div className="leaderboard-header-left">
            <button className="lb-header-btn" onClick={handleBackToLobby}>
              ← 返回大厅
            </button>
          </div>
          <div className="leaderboard-header-center">
            <h1 className="leaderboard-title">🏆 排行榜</h1>
          </div>
          <div className="leaderboard-header-right">
            <button className="lb-header-btn secondary" onClick={() => navigate('/profile')}>
              我的资料
            </button>
          </div>
        </div>

        <div className="leaderboard-tabs">
          <button
            className={"lb-tab-btn " + (type === 'score' ? 'active' : '')}
            onClick={() => handleChangeType('score')}
          >
            积分排行
          </button>
          <button
            className={"lb-tab-btn " + (type === 'winRate' ? 'active' : '')}
            onClick={() => handleChangeType('winRate')}
          >
            胜率排行
          </button>
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

                const scoreText =
                  type === 'score' ? `${entry.value ?? 0}` : formatWinRate(entry.value)

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
