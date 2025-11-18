import { Card, Button } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { globalSocket } from '@/services/socket'
import './style.css'

interface ProfileStats {
  totalScore: number
  gamesPlayed: number
  winRate: number
  currentStreak: number
}

interface GameHistoryItem {
  timestamp: string | number | Date
  role: 'landlord' | 'farmer' | string
  isWinner: boolean
  scoreChange: number
  tags?: string[]
}

interface AchievementItem {
  id: string
  name: string
  description: string
  icon: string
  type: 'milestone' | 'streak' | 'special' | 'master' | string
  isUnlocked: boolean
  progress: number
  unlockedAt?: string | Date | null
}

// 按成就ID定义一个展示优先级：首胜 -> 连胜类 -> 其它里程碑
const ACHIEVEMENT_ORDER: Record<string, number> = {
  first_win: 1,
  streak_3: 2,
  streak_5: 3,
  streak_10: 4,
  win_10: 5,
  win_50: 6,
  win_100: 7,
}

function getAchievementOrder(a: AchievementItem): number {
  const byId = ACHIEVEMENT_ORDER[a.id]
  if (typeof byId === 'number') return byId
  // 未在表中的成就统一排在后面
  return 1000
}

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [history, setHistory] = useState<GameHistoryItem[]>([])
  const [achievements, setAchievements] = useState<AchievementItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [achievementsLoading, setAchievementsLoading] = useState(false)

  const status = globalSocket.getStatus()

  const handleGoBack = () => {
    navigate(-1)
  }

  if (!user) {
    return null
  }

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()

    const loadScoreAndHistory = async () => {
      try {
        setLoading(true)
        setError(null)

        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        const res = await fetch(`${baseUrl}/api/score/${encodeURIComponent(user.id)}`, {
          signal: controller.signal,
        })

        let json: any = null
        try {
          json = await res.json()
        } catch (e) {
          // ignore body parse error
        }

        // 所有接口错误都视为“暂无记录”，不在 UI 上提示错误
        if (!res.ok) {
          console.warn('加载战绩接口返回非 2xx:', res.status, json?.message)
          setStats(null)
          setHistory([])
          setError(null)
          return
        }

        if (json && json.success && json.data) {
          const data = json.data
          setStats({
            totalScore: data.totalScore ?? 0,
            gamesPlayed: data.gamesPlayed ?? 0,
            winRate: data.winRate ?? 0,
            currentStreak: data.currentStreak ?? 0,
          })
          setHistory(Array.isArray(data.gameHistory) ? data.gameHistory : [])
        } else {
          // 返回结构异常也当作暂无记录
          console.warn('加载战绩返回结构异常:', json)
          setStats(null)
          setHistory([])
          setError(null)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载战绩失败:', err)
        // 网络/解析错误同样按暂无记录处理
        setStats(null)
        setHistory([])
        setError(null)
      } finally {
        setLoading(false)
      }
    }

    const loadAchievements = async () => {
      try {
        setAchievementsLoading(true)

        const baseUrl =
          window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin

        const res = await fetch(
          `${baseUrl}/api/score/${encodeURIComponent(user.id)}/achievements`,
          {
            signal: controller.signal,
          }
        )

        let json: any = null
        try {
          json = await res.json()
        } catch (e) {
          // ignore body parse error
        }

        if (!res.ok || !json?.success || !Array.isArray(json.data)) {
          console.warn('加载成就失败或返回结构异常:', res.status, json?.message)
          setAchievements([])
          return
        }

        // 按预设顺序排序成就，让展示呈现“首胜 -> 三连胜/五连胜/十连胜 -> 其它”的进阶效果
        const sorted: AchievementItem[] = [...json.data].sort((a: AchievementItem, b: AchievementItem) => {
          const orderA = getAchievementOrder(a)
          const orderB = getAchievementOrder(b)
          if (orderA !== orderB) return orderA - orderB
          // 次级按名称排序，保证顺序稳定
          return String(a.name).localeCompare(String(b.name), 'zh-CN')
        })

        setAchievements(sorted)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载成就失败:', err)
        setAchievements([])
      } finally {
        setAchievementsLoading(false)
      }
    }

    loadScoreAndHistory()
    loadAchievements()

    return () => {
      controller.abort()
    }
  }, [user])

  const winRateText =
    stats && stats.winRate != null ? `${Number(stats.winRate).toFixed(1)}%` : '--'

  return (
    <div className="profile-page">
      <Card className="profile-card" bordered={false}>
        <div className="profile-header">
          <div className="profile-header-left">
            <div className="profile-avatar-large">
              <div className="profile-avatar-img" />
            </div>
            <div className="profile-basic">
              <div className="profile-name">{user.name}</div>
              <div className="profile-id">ID: {user.id}</div>
            </div>
          </div>
          <div className="profile-header-right">
            <div
              className={
                'profile-conn-pill ' + (status.connected ? 'profile-conn-ok' : 'profile-conn-bad')
              }
            >
              {status.connected ? '在线' : '离线'}
            </div>
            <div className="profile-conn-sub">
              {status.connected
                ? `Socket: ${status.socketId ?? '未知'}`
                : '请检查网络或重新登录'}
            </div>
          </div>
        </div>

        <div className="profile-main">
          <div className="profile-stats-card">
            <div className="profile-stats-title">对局概览</div>
            <div className="profile-stats-grid">
              <div className="profile-stat-item">
                <div className="label">当前积分</div>
                <div className="value">{stats ? stats.totalScore : '--'}</div>
              </div>
              <div className="profile-stat-item">
                <div className="label">总场次</div>
                <div className="value">{stats ? stats.gamesPlayed : '--'}</div>
              </div>
              <div className="profile-stat-item">
                <div className="label">胜率</div>
                <div className="value">{winRateText}</div>
              </div>
              <div className="profile-stat-item">
                <div className="label">当前连胜</div>
                <div className="value">{stats ? stats.currentStreak : '--'}</div>
              </div>
            </div>
          </div>

          <div className="profile-achievements-card">
            <div className="profile-achievements-header">
              <div className="title">我的成就</div>
              {achievementsLoading && <span className="sub">加载中...</span>}
            </div>
            {!achievementsLoading && achievements.length === 0 && (
              <div className="profile-empty">暂无成就，继续加油～</div>
            )}
            {achievements.length > 0 && (
              <div className="achievements-grid">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={
                      'achievement-item ' + (a.isUnlocked ? 'unlocked' : 'locked')
                    }
                    title={a.description}
                  >
                    <div className="achievement-icon">{a.icon}</div>
                    <div className="achievement-name">{a.name}</div>
                    <div className="achievement-desc">
                      {a.isUnlocked ? '已解锁' : `${Math.round(a.progress || 0)}%`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-history-card">
            <div className="profile-history-header">
              <div className="title">最近战绩</div>
              {loading && <span className="sub">加载中...</span>}
              {!loading && !error && history.length > 0 && (
                <span className="sub">共 {history.length} 场，展示最近 10 场</span>
              )}
            </div>
            {error && (
              <div className="profile-error-text">{error}</div>
            )}
            {!error && history.length === 0 && !loading && (
              <div className="profile-empty">暂无游戏记录，打一局试试吧～</div>
            )}
            {!error && history.length > 0 && (
              <div className="profile-history-list">
                {history.slice(0, 10).map((game, idx) => {
                  const time = new Date(game.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const roleText = game.role === 'landlord' ? '地主' : '农民'
                  const resultPrefix = game.isWinner ? '✅' : '❌'
                  const scoreChange = Number(game.scoreChange || 0)
                  const scoreText = scoreChange > 0 ? `+${scoreChange}` : `${scoreChange}`
                  const tags: string[] = Array.isArray(game.tags) ? game.tags : []

                  return (
                    <div key={idx} className="profile-history-item">
                      <div className="info">
                        <div className="time">{time}</div>
                        <div className="role">
                          {resultPrefix} {roleText}
                        </div>
                        {tags.length > 0 && (
                          <div className="tags">
                            {tags.map((tag) => (
                              <span key={tag} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={scoreChange >= 0 ? 'score positive' : 'score negative'}>
                        {scoreText}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="profile-actions">
          <Button onClick={handleGoBack}>返回</Button>
          <Button type="primary" onClick={() => navigate('/leaderboard')}>
            查看排行榜
          </Button>
          <Button onClick={() => navigate('/feedback')}>
            意见反馈
          </Button>
        </div>
      </Card>
    </div>
  )
}
