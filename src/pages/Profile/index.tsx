import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import AvatarSelector from '@/components/AvatarSelector'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatScore } from '@/utils/scoreFormatter'
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
  multipliers?: {
    base: number
    bomb: number
    rocket: number
    spring: number
    antiSpring: number
    total: number
  }
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

interface ScoreTrendData {
  date: string      // 用于 X 轴：按天展示，例如 11/30
  fullTime: string  // 完整时间，Tooltip 中展示，例如 11/30 11:22
  score: number
  scoreWan: number // 以万为单位
}

// 从历史记录生成积分趋势数据
function generateScoreTrend(historyData: GameHistoryItem[], currentTotalScore: number): ScoreTrendData[] {
  if (!historyData || historyData.length === 0) return []
  
  const sorted = [...historyData].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  
  let score = currentTotalScore
  const trend: ScoreTrendData[] = []
  
  // 从最新往回推算，按“每局”生成一个点
  for (let i = sorted.length - 1; i >= 0; i--) {
    const game = sorted[i]
    const d = new Date(game.timestamp)
    const date = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    const fullTime = d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const scoreWan = Number((score / 10000).toFixed(2))
    trend.unshift({ date, fullTime, score, scoreWan })
    score -= (game.scoreChange || 0)
  }
  
  return trend.slice(-10) // 只保留最近10条
}

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [history, setHistory] = useState<GameHistoryItem[]>([])
  const [achievements, setAchievements] = useState<AchievementItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendData[]>([])
  
  // 头像选择器状态
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [currentAvatar, setCurrentAvatar] = useState(() => {
    if (user && typeof user.avatar === 'string') {
      const match = user.avatar.match(/^avatar-(\d+)$/)
      if (match) {
        const id = Number(match[1])
        if (!Number.isNaN(id) && id > 0) return id
      }
    }
    return 1
  }) // 默认头像编号

  // 昵称编辑状态
  const [displayName, setDisplayName] = useState(user?.name || '')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // 左侧垂直 Tab：资料 / 战绩 / 历史记录
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'history'>('profile')

  const handleSelectAvatar = async (avatarId: number) => {
    if (!user) return
    setCurrentAvatar(avatarId)
    
    // TODO: 调用后端 API 保存头像
    try {
      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : window.location.origin
      const avatarKey = `avatar-${avatarId}`
      const nameToUse = (displayName || user.name || '').trim() || user.name
      const res = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: nameToUse,
          avatar: avatarKey,
        }),
      })
      let json: any = null
      try {
        json = await res.json()
      } catch {}
      if (!res.ok || !json?.success) {
        console.warn('保存头像失败:', res.status, json?.message)
        return
      }
      const nextName: string =
        (typeof json.data?.username === 'string' && json.data.username.trim()) || nameToUse
      const nextAvatar: string =
        (typeof json.data?.avatar === 'string' && json.data.avatar.trim()) || avatarKey
      setDisplayName(nextName)
      updateUser({ name: nextName, avatar: nextAvatar })
    } catch (error) {
      console.error('保存头像失败:', error)
    }
  }

  const handleStartEditName = () => {
    setEditingName(true)
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setDisplayName(user?.name || '')
  }

  const handleSaveName = async () => {
    const trimmed = displayName.trim()
    if (!trimmed || !user) return

    setSavingName(true)
    try {
      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : window.location.origin
      const currentAvatarKey =
        (user.avatar && /^avatar-\d+$/.test(user.avatar))
          ? user.avatar
          : `avatar-${currentAvatar}`
      const res = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: trimmed,
          avatar: currentAvatarKey,
        }),
      })
      let json: any = null
      try {
        json = await res.json()
      } catch {}
      if (!res.ok || !json?.success) {
        console.warn('保存昵称失败:', res.status, json?.message)
        return
      }
      const nextName: string =
        (typeof json.data?.username === 'string' && json.data.username.trim()) || trimmed
      const nextAvatar: string =
        (typeof json.data?.avatar === 'string' && json.data.avatar.trim()) || currentAvatarKey
      setDisplayName(nextName)
      updateUser({ name: nextName, avatar: nextAvatar })
      setEditingName(false)
    } catch (error) {
      console.error('保存昵称失败:', error)
    } finally {
      setSavingName(false)
    }
  }

  const handleBlurName = () => {
    // 正在保存时忽略 blur，避免重复请求
    if (savingName) return

    const trimmed = displayName.trim()
    if (!trimmed) {
      // 空昵称时还原为原来的名字并退出编辑
      handleCancelEditName()
      return
    }

    handleSaveName()
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
          const totalScore = data.totalScore ?? 0
          setStats({
            totalScore,
            gamesPlayed: data.gamesPlayed ?? 0,
            winRate: data.winRate ?? 0,
            currentStreak: data.currentStreak ?? 0,
          })
          const historyData = Array.isArray(data.gameHistory) ? data.gameHistory : []
          setHistory(historyData)
          
          // 生成积分趋势数据
          const trend = generateScoreTrend(historyData, totalScore)
          setScoreTrend(trend)
          
          // 从后端记录恢复昵称与头像
          if (typeof data.username === 'string' && data.username.trim()) {
            const backendName = data.username.trim()
            setDisplayName(backendName)
            updateUser({ name: backendName })
          }
          if (typeof data.avatar === 'string' && data.avatar.trim()) {
            const avatarStr: string = data.avatar.trim()
            const match = avatarStr.match(/^avatar-(\d+)$/)
            if (match) {
              const id = Number(match[1])
              if (!Number.isNaN(id) && id > 0) {
                setCurrentAvatar(id)
              }
            }
            updateUser({ avatar: avatarStr })
          }
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
  }, [user?.id])

  const winRateText =
    stats && stats.winRate != null ? `${Number(stats.winRate).toFixed(1)}%` : '--'

  return (
    <div className="profile-page">
      <div className="profile-layout-container">
        {/* 左侧栏：用户信息 + 导航 */}
        <div className="profile-sidebar">
          {/* 用户信息卡片 */}
          <div className="profile-user-card">
            <div
              className="profile-avatar-container"
              onClick={() => setShowAvatarSelector(true)}
              title="点击更换头像"
            >
              <div className={`profile-avatar-img avatar-sprite avatar-${currentAvatar}`} />
            </div>
            <div className="profile-user-info">
              <div className="profile-name-row">
                {editingName ? (
                  <input
                    className="profile-name-input"
                    value={displayName}
                    maxLength={16}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={handleBlurName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEditName()
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="profile-name">{displayName || user.name}</div>
                    <button
                      type="button"
                      className="profile-name-edit"
                      onClick={handleStartEditName}
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <div className="profile-id">ID: {user.id}</div>
            </div>
          </div>

          {/* 导航菜单 */}
          <div className="profile-nav-menu">
            <button
              type="button"
              className={'profile-nav-item' + (activeTab === 'profile' ? ' active' : '')}
              onClick={() => setActiveTab('profile')}
            >
              <span className="nav-icon">📊</span>
              对局数据
            </button>
            <button
              type="button"
              className={'profile-nav-item' + (activeTab === 'stats' ? ' active' : '')}
              onClick={() => setActiveTab('stats')}
            >
              <span className="nav-icon">🏆</span>
              荣誉殿堂
            </button>
            <button
              type="button"
              className={'profile-nav-item' + (activeTab === 'history' ? ' active' : '')}
              onClick={() => setActiveTab('history')}
            >
              <span className="nav-icon">🕒</span>
              历史记录
            </button>
          </div>
        </div>

        {/* 右侧内容面板 */}
        <div className="profile-content-panel">
          {/* 1. 对局数据 Tab 内容 */}
          <div className={activeTab === 'profile' ? '' : 'hidden'}>
            <div className="panel-section-title">数据概览</div>
            <div className="profile-stats-grid-large">
              <div className="stat-card-large">
                <div className="label">当前积分</div>
                <div className="value text-gold">{stats ? formatScore(stats.totalScore) : '--'}</div>
              </div>
              <div className="stat-card-large">
                <div className="label">总场次</div>
                <div className="value">{stats ? stats.gamesPlayed : '--'}</div>
              </div>
              <div className="stat-card-large">
                <div className="label">胜率</div>
                <div className="value">{winRateText}</div>
              </div>
              <div className="stat-card-large">
                <div className="label">当前连胜</div>
                <div className="value text-red">{stats ? stats.currentStreak : 0}</div>
              </div>
            </div>

            <div className="panel-divider" />
            
            <div className="panel-section-title">积分图（每局总积分）</div>
            {scoreTrend.length === 0 ? (
              <div className="profile-empty">暂无数据</div>
            ) : (
              <div className="score-trend-chart">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={scoreTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value: number) => (value / 10000).toFixed(1)}
                      label={{ value: '积分(万)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                      formatter={(value: number) => [formatScore(value), '积分']}
                      // 使用每个点自己的 fullTime 作为标题，精确到分钟
                      labelFormatter={((_: any, payload: any) => {
                        const arr = Array.isArray(payload) ? payload : []
                        const p = arr[0]
                        return p?.payload?.fullTime || ''
                      }) as any}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#fbbf24" 
                      strokeWidth={3}
                      dot={{ fill: '#fbbf24', r: 4 }}
                      activeDot={{ r: 6 }}
                      label={(props: any) => {
                        const { x, y, index, value } = props
                        // 每隔2个点显示一次，或者总是显示第一个和最后一个
                        if (index === 0 || index === scoreTrend.length - 1 || index % 2 === 0) {
                          const rawScore = Number(value) || 0
                          const formatted = formatScore(rawScore) // 例如 "41.2万" / "297万"
                          const text = formatted.replace('万', '') // 只在曲线上显示数字部分，单位用坐标轴
                          return (
                            <text x={x} y={y - 8} fill="#fbbf24" fontSize={11} fontWeight={600} textAnchor="middle">
                              {text}
                            </text>
                          )
                        }
                        return null
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 2. 荣誉殿堂 Tab 内容 */}
          <div className={activeTab === 'stats' ? '' : 'hidden'}>
            <div className="panel-section-title">我的成就</div>
            {achievementsLoading && <div className="loading-text">加载中...</div>}
            {!achievementsLoading && achievements.length === 0 && (
              <div className="profile-empty">暂无成就，继续加油～</div>
            )}
            {achievements.length > 0 && (
              <div className="achievements-grid">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={'achievement-item ' + (a.isUnlocked ? 'unlocked' : 'locked')}
                    title={a.description}
                  >
                    <div className="achievement-icon">{a.icon}</div>
                    <div className="achievement-name">{a.name}</div>
                    {!a.isUnlocked && (
                      <div className="achievement-desc">{`${Math.round(a.progress || 0)}%`}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 历史记录 Tab 内容 */}
          <div className={activeTab === 'history' ? '' : 'hidden'}>
            <div className="panel-section-title">
              最近战绩
              {!loading && !error && history.length > 0 && (
                <span className="sub-text"> (最近 {history.length} 场)</span>
              )}
            </div>
            {loading && <div className="loading-text">加载中...</div>}
            {!loading && !error && history.length === 0 && (
              <div className="profile-empty">暂无游戏记录</div>
            )}
            {!loading && !error && history.length > 0 && (
              <div className="profile-history-list">
                {history.slice(0, 10).map((game, idx) => {
                  const time = new Date(game.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const roleText = game.role === 'landlord' ? '地主' : '农民'
                  const resultPrefix = game.isWinner ? '🎉' : '💔'
                  const scoreChange = Number(game.scoreChange || 0)
                  const absScore = Math.abs(scoreChange)
                  const scoreText =
                    scoreChange >= 0 ? `+${formatScore(absScore)}` : `-${formatScore(absScore)}`
                  const tags: string[] = Array.isArray(game.tags) ? game.tags : []

                  // ===== 使用“万”为单位重建积分公式 =====
                  const baseScore = 5000
                  const baseWan = baseScore / 10000 // 0.5 万

                  let bombCount = 0
                  let rocketCount = 0
                  let hasSpring = false
                  let hasAntiSpring = false

                  for (const tag of tags) {
                    if (tag.startsWith('炸弹×')) {
                      const n = parseInt(tag.replace('炸弹×', ''), 10)
                      if (!Number.isNaN(n) && n > 0) bombCount = n
                    } else if (tag.startsWith('王炸×')) {
                      const n = parseInt(tag.replace('王炸×', ''), 10)
                      if (!Number.isNaN(n) && n > 0) rocketCount = n
                    } else if (tag === '春天') {
                      hasSpring = true
                    } else if (tag === '反春') {
                      hasAntiSpring = true
                    }
                  }

                  const factorList: number[] = []
                  if (hasSpring) factorList.push(16)
                  if (hasAntiSpring) factorList.push(16)
                  if (bombCount > 0) factorList.push(Math.pow(3, bombCount))
                  if (rocketCount > 0) factorList.push(Math.pow(8, rocketCount))
                  if (game.role === 'landlord') factorList.push(2)

                  // 理论结果（万）
                  let resultWan = baseWan
                  for (const f of factorList) {
                    resultWan *= f
                  }

                  // 使用真实积分进行校准，确保右侧结果与公式右边一致
                  const realWan = absScore / 10000
                  if (realWan > 0) {
                    resultWan = realWan
                  }

                  const resultWanStr =
                    resultWan >= 100
                      ? resultWan.toFixed(0)
                      : resultWan >= 10
                      ? resultWan.toFixed(1)
                      : resultWan.toFixed(2)

                  let formula = ''
                  if (factorList.length > 0) {
                    formula = `${baseWan} × ${factorList.join(' × ')} = ${resultWanStr}万`
                  } else {
                    formula = `基础：${resultWanStr}万`
                  }

                  return (
                    <div key={idx} className="profile-history-item">
                      <div className="history-col history-time">
                        {time}
                      </div>
                      <div className="history-col history-role">
                        {resultPrefix} {roleText}
                      </div>
                      <div className="history-col history-multiplier">
                        {tags.length > 0 && (
                          <div className="tags">
                            {tags.map((tag) => (
                              <span key={tag} className="tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="formula">{formula}</div>
                      </div>
                      <div className="history-col history-score">
                        <div className={scoreChange >= 0 ? 'score positive' : 'score negative'}>
                          {scoreText}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 头像选择器弹窗 */}
      {showAvatarSelector && (
        <AvatarSelector
          currentAvatar={currentAvatar}
          onSelect={handleSelectAvatar}
          onClose={() => setShowAvatarSelector(false)}
        />
      )}
    </div>
  )
}
