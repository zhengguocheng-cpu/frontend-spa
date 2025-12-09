import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import './style.css'

interface FeedbackReply {
  id: string
  author: string
  content: string
  createdAt: string
}

interface FeedbackItem {
  id: string
  userName: string
  feedbackType: string
  feedbackContent: string
  contact: string
  screenshots?: {
    filename: string
    originalname: string
    size: number
    path: string
  }[]
  timestamp: string
  createdAt: string
  updatedAt?: string
  userAgent?: string
  url?: string
  status?: string
  priority?: string
  replies?: FeedbackReply[]
}

interface GameLogPlayerSummary {
  playerId: string
  playerName: string
  role?: string | null
  isBot?: boolean
}

interface GameLogSummary {
  gameId: string
  roomId?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  landlordId?: string | null
  winnerId?: string
  winnerName?: string
  winnerRole?: string | null
  landlordWin?: boolean
  baseScore?: number
  bombCount?: number
  rocketCount?: number
  isSpring?: boolean
  isAntiSpring?: boolean
  players?: GameLogPlayerSummary[]
}

interface AdminUserSummary {
  userId: string
  username: string
  totalScore: number
  gamesPlayed: number
  gamesWon: number
  winRate: number
  createdAt: string
  lastPlayedAt?: string | null
  isBot: boolean
  totalPlayTimeSeconds: number
}

interface UsageTrendPoint {
  date: string
  activeUsers: number
  totalPlayTimeSeconds: number
}

interface SystemStats {
  totalPlayers: number
  totalGames: number
  totalScoreChanges: number
  lastUpdated: string
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: 'BUG / 故障',
  experience: '玩法体验',
  suggestion: '功能建议',
  other: '其他',
}

const FEEDBACK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: '待排查' },
  { value: 'investigating', label: '排查中' },
  { value: 'urgent', label: '需紧急解决' },
  { value: 'later', label: '后续优化' },
  { value: 'resolved', label: '已解决' },
]

const FEEDBACK_STATUS_ORDER: Record<string, number> = {
  urgent: 0,
  pending: 1,
  investigating: 2,
  later: 3,
  resolved: 4,
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'feedback' | 'settings' | 'games' | 'analytics'>(
    'feedback',
  )
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'trend'>('overview')
  const [loading, setLoading] = useState(false)
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [games, setGames] = useState<GameLogSummary[]>([])
  const [selectedGame, setSelectedGame] = useState<any | null>(null)
  const [gameDetailLoading, setGameDetailLoading] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null)
  const [feedbackSortKey, setFeedbackSortKey] = useState<'index' | 'user' | 'status' | 'type'>('status')
  const [feedbackSortDir, setFeedbackSortDir] = useState<'asc' | 'desc'>('asc')
  const [feedbackView, setFeedbackView] = useState<'list' | 'detail'>('list')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [usageTrend, setUsageTrend] = useState<UsageTrendPoint[]>([])
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)

  useEffect(() => {
    if (activeTab === 'feedback') {
      void fetchFeedbackList()
    } else if (activeTab === 'games') {
      void fetchGameLogs()
    } else if (activeTab === 'analytics') {
      void fetchAnalytics()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'feedback') return
    if (!feedbackList.length) {
      setSelectedFeedbackId(null)
      return
    }
    if (!selectedFeedbackId || !feedbackList.some((f) => f.id === selectedFeedbackId)) {
      setSelectedFeedbackId(feedbackList[0].id)
    }
  }, [activeTab, feedbackList, selectedFeedbackId])

  const fetchFeedbackList = async () => {
    try {
      setLoading(true)

      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : window.location.origin

      const res = await fetch(`${baseUrl}/api/feedback/list`)
      const json = await res.json()

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `加载失败（${res.status}）`)
      }

      setFeedbackList(Array.isArray(json.feedbacks) ? json.feedbacks : [])
    } catch (err: any) {
      console.error('加载反馈列表失败:', err)
      Toast.show({ content: err?.message || '加载失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const buildBaseUrl = () => {
    return window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin
  }

  const handleOpenFeedbackDetail = (id: string) => {
    setSelectedFeedbackId(id)
    setFeedbackView('detail')
  }

  const handleBackToFeedbackList = () => {
    setFeedbackView('list')
  }

  const handleFeedbackSortChange = (key: 'index' | 'user' | 'status' | 'type') => {
    setFeedbackSortKey((prevKey) => {
      if (prevKey === key) {
        setFeedbackSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setFeedbackSortDir('asc')
      return key
    })
  }

  const getSortArrow = (key: 'index' | 'user' | 'status' | 'type') => {
    if (feedbackSortKey !== key) return ''
    return feedbackSortDir === 'asc' ? '↑' : '↓'
  }

  const getSortedFeedbacks = () => {
    const list = [...feedbackList]
    list.sort((a, b) => {
      let diff = 0

      if (feedbackSortKey === 'status') {
        const sa = FEEDBACK_STATUS_ORDER[a.status || 'pending'] ?? 99
        const sb = FEEDBACK_STATUS_ORDER[b.status || 'pending'] ?? 99
        diff = sa - sb
        if (diff !== 0) {
          return feedbackSortDir === 'asc' ? diff : -diff
        }
        const ta = new Date(a.timestamp || a.createdAt).getTime() || 0
        const tb = new Date(b.timestamp || b.createdAt).getTime() || 0
        const timeDiff = tb - ta // 同一状态内，默认按时间倒序
        return feedbackSortDir === 'asc' ? -timeDiff : timeDiff
      }

      if (feedbackSortKey === 'index') {
        const ta = new Date(a.timestamp || a.createdAt).getTime() || 0
        const tb = new Date(b.timestamp || b.createdAt).getTime() || 0
        diff = ta - tb
      } else if (feedbackSortKey === 'user') {
        const na = a.userName || ''
        const nb = b.userName || ''
        diff = na.localeCompare(nb, 'zh-CN')
      } else if (feedbackSortKey === 'type') {
        const ta = FEEDBACK_TYPE_LABELS[a.feedbackType] || a.feedbackType || ''
        const tb = FEEDBACK_TYPE_LABELS[b.feedbackType] || b.feedbackType || ''
        diff = ta.localeCompare(tb, 'zh-CN')
      }

      if (diff === 0) return 0
      return feedbackSortDir === 'asc' ? diff : -diff
    })
    return list
  }

  const getStatusLabel = (status?: string) => {
    const found = FEEDBACK_STATUS_OPTIONS.find((opt) => opt.value === status)
    return found ? found.label : '待排查'
  }

  const getContentPreview = (text: string) => {
    if (!text) return ''
    const firstLine = text.split(/\r?\n/)[0].trim()
    if (firstLine.length <= 20) return firstLine
    return `${firstLine.slice(0, 20)}…`
  }

  const handleUpdateFeedbackStatus = async (id: string, status: string) => {
    try {
      const baseUrl = buildBaseUrl()
      const res = await fetch(`${baseUrl}/api/feedback/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `更新状态失败（${res.status}）`)
      }

      const updated: FeedbackItem = json.feedback
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)))
    } catch (err: any) {
      console.error('更新反馈状态失败:', err)
      Toast.show({ content: err?.message || '更新状态失败', icon: 'fail' })
    }
  }

  const handleSubmitReply = async (id: string) => {
    const content = (replyDrafts[id] || '').trim()
    if (!content) {
      Toast.show({ content: '请输入回复内容', icon: 'info' })
      return
    }

    try {
      const baseUrl = buildBaseUrl()
      const res = await fetch(`${baseUrl}/api/feedback/${encodeURIComponent(id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, author: '管理员' }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `回复失败（${res.status}）`)
      }

      const updated: FeedbackItem = json.feedback
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)))
      setReplyDrafts((prev) => ({ ...prev, [id]: '' }))
    } catch (err: any) {
      console.error('提交回复失败:', err)
      Toast.show({ content: err?.message || '回复失败', icon: 'fail' })
    }
  }

  const formatTime = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return ''
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainSeconds = seconds % 60
    if (minutes <= 0) return `${seconds}s`
    return `${minutes}m ${remainSeconds}s`
  }

  const formatSecondsToHms = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return ''
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    if (hours > 0) {
      if (minutes > 0) return `${hours}h${minutes}m`
      return `${hours}h`
    }
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  const fetchGameLogs = async () => {
    try {
      setGamesLoading(true)

      const baseUrl = buildBaseUrl()
      const res = await fetch(`${baseUrl}/api/admin/game-logs?limit=50`)
      const json = await res.json()

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `加载失败（${res.status}）`)
      }

      const list = Array.isArray(json.games) ? (json.games as GameLogSummary[]) : []
      setGames(list)

      if (!selectedGame && list.length > 0) {
        void fetchGameDetail(list[0].gameId)
      }
    } catch (err: any) {
      console.error('加载对局列表失败:', err)
      Toast.show({ content: err?.message || '加载对局列表失败', icon: 'fail' })
    } finally {
      setGamesLoading(false)
    }
  }

  const fetchGameDetail = async (gameId: string) => {
    try {
      setGameDetailLoading(true)

      const baseUrl = buildBaseUrl()
      const res = await fetch(`${baseUrl}/api/admin/game-logs/${encodeURIComponent(gameId)}`)
      const json = await res.json()

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `加载失败（${res.status}）`)
      }

      setSelectedGame(json.game)
    } catch (err: any) {
      console.error('加载对局详情失败:', err)
      Toast.show({ content: err?.message || '加载对局详情失败', icon: 'fail' })
    } finally {
      setGameDetailLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true)

      const baseUrl = buildBaseUrl()
      const [usersRes, trendRes, statsRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/users`),
        fetch(`${baseUrl}/api/admin/analytics/usage-trend?days=30`),
        fetch(`${baseUrl}/api/score/system/stats`),
      ])

      const [usersJson, trendJson, statsJson] = await Promise.all([
        usersRes
          .json()
          .catch(() => ({ success: false })),
        trendRes
          .json()
          .catch(() => ({ success: false })),
        statsRes
          .json()
          .catch(() => ({ success: false })),
      ])

      if (!usersRes.ok || !usersJson?.success) {
        throw new Error(usersJson?.message || `加载用户列表失败（${usersRes.status}）`)
      }

      if (!trendRes.ok || !trendJson?.success) {
        throw new Error(trendJson?.message || `加载趋势数据失败（${trendRes.status}）`)
      }

      setUsers(Array.isArray(usersJson.users) ? (usersJson.users as AdminUserSummary[]) : [])
      setUsageTrend(
        Array.isArray(trendJson.points) ? (trendJson.points as UsageTrendPoint[]) : [],
      )

      if (statsRes.ok && statsJson?.success && statsJson.data) {
        setSystemStats(statsJson.data as SystemStats)
      } else {
        setSystemStats(null)
      }
    } catch (err: any) {
      console.error('加载用户分析数据失败:', err)
      Toast.show({ content: err?.message || '加载用户分析数据失败', icon: 'fail' })
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleExportSelectedGameJson = () => {
    if (!selectedGame) {
      Toast.show({ content: '请选择一局对局', icon: 'info' })
      return
    }

    try {
      const dataStr = JSON.stringify(selectedGame, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const id = selectedGame.gameId || 'game_log'
      link.href = url
      link.download = `game_${id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('导出对局 JSON 失败:', err)
      Toast.show({ content: err?.message || '导出失败', icon: 'fail' })
    }
  }

  const renderFeedbackTab = () => {
    const sorted = getSortedFeedbacks()
    const selected =
      (selectedFeedbackId && sorted.find((f) => f.id === selectedFeedbackId)) || null

    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">用户反馈</h2>
          <div className="admin-feedback-header-actions">
            {feedbackView === 'detail' && (
              <button
                type="button"
                className="admin-refresh-button"
                onClick={handleBackToFeedbackList}
              >
                返回列表
              </button>
            )}
            <button
              type="button"
              className="admin-refresh-button"
              onClick={() => fetchFeedbackList()}
              disabled={loading}
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="admin-empty">暂无反馈记录</div>
        ) : feedbackView === 'list' ? (
          <div className="admin-feedback-table">
            <div className="admin-feedback-table-header-row">
              <div
                className="admin-feedback-table-header-cell sortable"
                onClick={() => handleFeedbackSortChange('index')}
              >
                <span>时间</span>
                <span className="sort-arrow">{getSortArrow('index')}</span>
              </div>
              <div
                className="admin-feedback-table-header-cell sortable"
                onClick={() => handleFeedbackSortChange('user')}
              >
                <span>玩家</span>
                <span className="sort-arrow">{getSortArrow('user')}</span>
              </div>
              <div
                className="admin-feedback-table-header-cell sortable"
                onClick={() => handleFeedbackSortChange('type')}
              >
                <span>标题</span>
                <span className="sort-arrow">{getSortArrow('type')}</span>
              </div>
              <div className="admin-feedback-table-header-cell">反馈内容</div>
              <div
                className="admin-feedback-table-header-cell sortable"
                onClick={() => handleFeedbackSortChange('status')}
              >
                <span>处理状态</span>
                <span className="sort-arrow">{getSortArrow('status')}</span>
              </div>
            </div>

            <div className="admin-feedback-table-body">
              {sorted.map((item) => {
                const isActive = selected && selected.id === item.id
                const statusLabel = getStatusLabel(item.status)
                const preview = getContentPreview(item.feedbackContent)
                const typeLabel =
                  FEEDBACK_TYPE_LABELS[item.feedbackType] || item.feedbackType || '其他'

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      'admin-feedback-table-row' +
                      (isActive ? ' admin-feedback-table-row-active' : '')
                    }
                    onClick={() => handleOpenFeedbackDetail(item.id)}
                  >
                    <div className="admin-feedback-col index">
                      {formatTime(item.timestamp || item.createdAt)}
                    </div>
                    <div className="admin-feedback-col user">{item.userName || '匿名用户'}</div>
                    <div className="admin-feedback-col type">{typeLabel}</div>
                    <div className="admin-feedback-col content">{preview}</div>
                    <div className="admin-feedback-col status">
                      <span
                        className={
                          'admin-feedback-status-pill status-' + (item.status || 'pending')
                        }
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="admin-feedback-detail">
            {!selected ? (
              <div className="admin-empty">未找到该反馈记录。</div>
            ) : (
              <>
                <div className="admin-feedback-detail-header">
                  <div>
                    <div className="admin-feedback-detail-title">
                      {selected.userName || '匿名用户'}
                    </div>
                    <div className="admin-feedback-detail-subtitle">
                      {formatTime(selected.timestamp || selected.createdAt)}
                      {selected.url && (
                        <span className="admin-feedback-detail-url">
                          {' '}
                          · {selected.url}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="admin-feedback-detail-status">
                    <span className="label">处理状态</span>
                    <select
                      className="admin-feedback-status-select"
                      value={selected.status || 'pending'}
                      onChange={(e) =>
                        handleUpdateFeedbackStatus(selected.id, e.target.value)
                      }
                    >
                      {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="admin-feedback-detail-meta">
                  {selected.contact && (
                    <div className="admin-feedback-meta-item">
                      <span className="label">联系方式</span>
                      <span className="value">{selected.contact}</span>
                    </div>
                  )}
                  {selected.userAgent && (
                    <div className="admin-feedback-meta-item">
                      <span className="label">设备</span>
                      <span className="value">{selected.userAgent}</span>
                    </div>
                  )}
                </div>

                <div className="admin-feedback-detail-content">
                  {selected.feedbackContent}
                </div>

                {Array.isArray(selected.screenshots) && selected.screenshots.length > 0 && (
                  <div className="admin-feedback-screenshots">
                    <div className="admin-feedback-screenshots-title">用户截图</div>
                    <div className="admin-feedback-screenshots-grid">
                      {selected.screenshots.map((shot) => {
                        const baseUrl = buildBaseUrl()
                        const url = `${baseUrl}/uploads/feedback/${encodeURIComponent(
                          shot.filename,
                        )}`
                        return (
                          <a
                            key={shot.filename}
                            className="admin-feedback-screenshot-item"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={url}
                              alt={shot.originalname || shot.filename}
                              className="admin-feedback-screenshot-thumb"
                            />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {Array.isArray(selected.replies) && selected.replies.length > 0 && (
                  <div className="admin-feedback-replies">
                    {selected.replies.map((reply) => (
                      <div key={reply.id} className="admin-feedback-reply">
                        <div className="reply-header">
                          <span className="reply-author">{reply.author || '管理员'}</span>
                          <span className="reply-time">{formatTime(reply.createdAt)}</span>
                        </div>
                        <div className="reply-content">{reply.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="admin-feedback-reply-editor">
                  <textarea
                    className="admin-feedback-reply-textarea"
                    rows={2}
                    placeholder="回复用户反馈，记录处理进度..."
                    value={replyDrafts[selected.id] || ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-feedback-reply-button"
                    onClick={() => handleSubmitReply(selected.id)}
                  >
                    回复
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSettingsTab = () => {
    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">游戏设置（占位）</h2>
        </div>
        <div className="admin-placeholder">
          这里后续可以配置金币活动、倍率、公告等游戏参数。
        </div>
      </div>
    )
  }

  const renderGamesTab = () => {
    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">对局记录</h2>
          <button
            type="button"
            className="admin-refresh-button"
            onClick={() => fetchGameLogs()}
            disabled={gamesLoading}
          >
            {gamesLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        {games.length === 0 && !gamesLoading ? (
          <div className="admin-empty">暂无对局记录，请先完成一局游戏。</div>
        ) : (
          <div className="admin-games-layout">
            <div className="admin-games-list">
              <div className="admin-games-list-header">最近对局</div>
              <div className="admin-games-list-inner">
                {games.map((game) => {
                  const isActive = selectedGame && selectedGame.gameId === game.gameId
                  const title = game.winnerName
                    ? `${game.winnerName} (${game.winnerRole === 'landlord' ? '地主' : '农民'})`
                    : game.gameId
                  const timeLabel = formatTime(game.endedAt || game.startedAt)
                  const playersLabel = (game.players || [])
                    .map((p) => p.playerName || p.playerId)
                    .join('，')

                  return (
                    <button
                      key={game.gameId}
                      type="button"
                      className={`admin-game-item ${isActive ? 'admin-game-item-active' : ''}`}
                      onClick={() => fetchGameDetail(game.gameId)}
                    >
                      <div className="admin-game-item-title">{title}</div>
                      <div className="admin-game-item-meta">
                        <span>{timeLabel}</span>
                        {game.roomId && <span>房间: {game.roomId}</span>}
                      </div>
                      <div className="admin-game-item-players" title={playersLabel}>
                        {playersLabel || '玩家信息缺失'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="admin-games-detail">
              {gameDetailLoading && <div className="admin-empty">对局详情加载中...</div>}
              {!gameDetailLoading && !selectedGame && (
                <div className="admin-empty">请选择左侧一局对局查看详情。</div>
              )}
              {!gameDetailLoading && selectedGame && (
                <>
                  <div className="admin-games-detail-header">
                    <div>
                      <div className="admin-games-detail-title">对局 {selectedGame.gameId}</div>
                      <div className="admin-games-detail-subtitle">
                        {formatTime(selectedGame.startedAt)}
                        {selectedGame.endedAt && ` ~ ${formatTime(selectedGame.endedAt)}`}
                        {typeof selectedGame.durationMs === 'number' && (
                          <span className="admin-games-detail-duration">
                            （时长 {formatDuration(selectedGame.durationMs)}）
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-refresh-button"
                      onClick={handleExportSelectedGameJson}
                      disabled={!selectedGame}
                    >
                      导出 JSON
                    </button>
                  </div>

                  <div className="admin-games-detail-section">
                    <div className="admin-games-detail-section-title">玩家</div>
                    <div className="admin-games-detail-players">
                      {Array.isArray(selectedGame.players) && selectedGame.players.length > 0 ? (
                        selectedGame.players.map((p: any) => (
                          <div key={p.playerId} className="admin-games-detail-player">
                            <div className="name">{p.playerName || p.playerId}</div>
                            <div className="meta">
                              {p.role === 'landlord' ? '地主' : '农民'}
                              {p.isBot ? ' · 机器人' : ''}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-empty">暂无玩家信息</div>
                      )}
                    </div>
                  </div>

                  <div className="admin-games-detail-section">
                    <div className="admin-games-detail-section-title">结果</div>
                    <div className="admin-games-detail-result">
                      <div>
                        胜者：{selectedGame.result?.winnerName || selectedGame.result?.winnerId || '未知'}（
                        {selectedGame.result?.winnerRole === 'landlord' ? '地主' : '农民'}）
                      </div>
                      <div>
                        地主：{selectedGame.landlordId || '未知'}，
                        {selectedGame.result?.landlordWin ? '地主获胜' : '农民获胜'}
                      </div>
                      <div>
                        炸弹：{selectedGame.result?.bombCount ?? 0}，王炸：
                        {selectedGame.result?.rocketCount ?? 0}，春天：
                        {selectedGame.result?.isSpring ? '是' : '否'}，反春：
                        {selectedGame.result?.isAntiSpring ? '是' : '否'}
                      </div>
                    </div>
                  </div>

                  <div className="admin-games-detail-section">
                    <div className="admin-games-detail-section-title">原始 JSON</div>
                    <pre className="admin-code-block">
                      {JSON.stringify(selectedGame, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderAnalyticsTab = () => {
    const sortedUsers = [...users].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))

    const maxActive = usageTrend.reduce((max, p) => Math.max(max, p.activeUsers), 0)
    const maxPlay = usageTrend.reduce(
      (max, p) => Math.max(max, p.totalPlayTimeSeconds),
      0,
    )

    const latestPoint = usageTrend.length > 0 ? usageTrend[usageTrend.length - 1] : null
    const avgActive =
      usageTrend.length > 0
        ? usageTrend.reduce((sum, p) => sum + p.activeUsers, 0) / usageTrend.length
        : 0

    const xTickInterval =
      usageTrend.length > 0 ? Math.max(1, Math.floor(usageTrend.length / 8)) : 1

    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">用户分析</h2>
          <button
            type="button"
            className="admin-refresh-button"
            onClick={() => fetchAnalytics()}
            disabled={analyticsLoading}
          >
            {analyticsLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        <div className="admin-analytics-subtabs">
          <button
            type="button"
            className={
              'admin-analytics-subtab' +
              (analyticsView === 'overview' ? ' admin-analytics-subtab-active' : '')
            }
            onClick={() => setAnalyticsView('overview')}
          >
            用户概览
          </button>
          <button
            type="button"
            className={
              'admin-analytics-subtab' +
              (analyticsView === 'trend' ? ' admin-analytics-subtab-active' : '')
            }
            onClick={() => setAnalyticsView('trend')}
          >
            活跃趋势
          </button>
        </div>

        {!analyticsLoading && sortedUsers.length === 0 && usageTrend.length === 0 ? (
          <div className="admin-empty">暂无用户数据，请先完成几局游戏。</div>
        ) : null}

        <div className="admin-analytics-layout">
          <div className="admin-analytics-summary-card">
            <div className="admin-analytics-summary-title">总体数据</div>
            <div className="admin-analytics-summary-grid">
              <div className="admin-analytics-summary-item">
                <div className="label">总玩家数</div>
                <div className="value">
                  {systemStats?.totalPlayers ?? sortedUsers.length}
                </div>
              </div>
              <div className="admin-analytics-summary-item">
                <div className="label">总对局数</div>
                <div className="value">{systemStats?.totalGames ?? '-'}</div>
              </div>
              <div className="admin-analytics-summary-item">
                <div className="label">最近活跃日期</div>
                <div className="value">
                  {usageTrend.length > 0
                    ? usageTrend[usageTrend.length - 1]?.date
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {analyticsView === 'overview' ? (
            <div className="admin-analytics-users-card">
              <div className="admin-analytics-card-header">
                <div className="title">玩家列表</div>
                <div className="subtitle">按金币从高到低排序</div>
              </div>
              {sortedUsers.length === 0 ? (
                <div className="admin-empty">暂无玩家记录。</div>
              ) : (
                <div className="admin-analytics-users-table">
                  <div className="admin-analytics-users-header-row">
                    <div>玩家</div>
                    <div>金币</div>
                    <div>局数</div>
                    <div>胜率</div>
                    <div>总在线时长</div>
                    <div>最近上线</div>
                  </div>
                  <div className="admin-analytics-users-body">
                    {sortedUsers.map((u) => (
                      <div key={u.userId} className="admin-analytics-users-row">
                        <div className="col name">
                          {u.username || u.userId}
                          {u.isBot && <span className="tag-bot">机器人</span>}
                        </div>
                        <div className="col score">{u.totalScore.toLocaleString()}</div>
                        <div className="col games">{u.gamesPlayed}</div>
                        <div className="col winrate">
                          {u.gamesPlayed > 0 ? `${u.winRate.toFixed(1)}%` : '-'}
                        </div>
                        <div className="col playtime">
                          {formatSecondsToHms(u.totalPlayTimeSeconds)}
                        </div>
                        <div className="col last">
                          {u.lastPlayedAt ? formatTime(u.lastPlayedAt) : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="admin-analytics-chart-card">
                <div className="admin-analytics-card-header">
                  <div className="title">每日活跃用户折线图</div>
                  <div className="subtitle">横轴为日期，纵轴为当天登录过的玩家总人数</div>
                </div>
                {usageTrend.length === 0 || maxActive === 0 ? (
                  <div className="admin-empty">暂无活跃数据。</div>
                ) : (
                  <>
                    <div className="admin-analytics-line-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={usageTrend}
                          margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
                        >
                          <CartesianGrid
                            stroke="rgba(30, 64, 175, 0.35)"
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            interval={xTickInterval}
                            tick={{ fill: 'rgba(148, 163, 184, 0.96)', fontSize: 10 }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(148, 163, 184, 0.4)' }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: 'rgba(148, 163, 184, 0.96)', fontSize: 10 }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(148, 163, 184, 0.4)' }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(15, 23, 42, 0.95)',
                              border: '1px solid rgba(51, 65, 85, 0.9)',
                              borderRadius: 8,
                              padding: 8,
                              fontSize: 11,
                              color: '#e5e7eb',
                            }}
                            labelStyle={{
                              color: 'rgba(191, 219, 254, 0.96)',
                              marginBottom: 4,
                            }}
                            cursor={{
                              stroke: 'rgba(148, 163, 184, 0.4)',
                              strokeWidth: 1,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="activeUsers"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            dot={{
                              r: 3,
                              stroke: '#1d4ed8',
                              strokeWidth: 1.5,
                              fill: '#93c5fd',
                            }}
                            activeDot={{ r: 4 }}
                          >
                            <LabelList
                              dataKey="activeUsers"
                              position="top"
                              fill="rgba(191, 219, 254, 0.96)"
                              fontSize={10}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="admin-analytics-chart-summary">
                      <span>
                        最近一天：
                        {latestPoint
                          ? `${latestPoint.date} · ${latestPoint.activeUsers} 人`
                          : '-'}
                      </span>
                      <span>30天峰值：{maxActive} 人</span>
                      <span>
                        30天日均：
                        {avgActive > 0 ? `${avgActive.toFixed(1)} 人` : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="admin-analytics-trend-card">
                <div className="admin-analytics-card-header">
                  <div className="title">最近30天活跃趋势</div>
                  <div className="subtitle">按天统计活跃玩家数和总在线时长</div>
                </div>
                {usageTrend.length === 0 ? (
                  <div className="admin-empty">暂无趋势数据。</div>
                ) : (
                  <div className="admin-analytics-trend-list">
                    {usageTrend.map((p) => {
                      const activeRatio = maxActive > 0 ? p.activeUsers / maxActive : 0
                      const timeRatio = maxPlay > 0 ? p.totalPlayTimeSeconds / maxPlay : 0
                      return (
                        <div key={p.date} className="admin-analytics-trend-row">
                          <div className="col date">{p.date}</div>
                          <div className="col metrics">
                            <span className="metric">活跃 {p.activeUsers}</span>
                            <span className="metric">
                              时长 {formatSecondsToHms(p.totalPlayTimeSeconds)}
                            </span>
                          </div>
                          <div className="col bars">
                            <div
                              className="bar bar-active"
                              style={{ width: `${(activeRatio || 0) * 100}%` }}
                            />
                            <div
                              className="bar bar-time"
                              style={{ width: `${(timeRatio || 0) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-main">
          <h1 className="admin-title">后台管理</h1>
          <div className="admin-subtitle">仅限管理员自用，地址保密即可。</div>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <button
            type="button"
            className={`admin-tab ${activeTab === 'feedback' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            用户反馈
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'settings' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            游戏设置
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'games' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            对局记录
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'analytics' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            用户分析
          </button>
        </aside>

        <main className="admin-main">
          {activeTab === 'feedback' && renderFeedbackTab()}
          {activeTab === 'settings' && renderSettingsTab()}
          {activeTab === 'games' && renderGamesTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </main>
      </div>
    </div>
  )
}
