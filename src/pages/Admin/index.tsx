import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
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
  const [activeTab, setActiveTab] = useState<'feedback' | 'settings' | 'games'>('feedback')
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

  useEffect(() => {
    if (activeTab === 'feedback') {
      void fetchFeedbackList()
    } else if (activeTab === 'games') {
      void fetchGameLogs()
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
                <span>序号</span>
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
              {sorted.map((item, index) => {
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
                    <div className="admin-feedback-col index">{index + 1}</div>
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
        </aside>

        <main className="admin-main">
          {activeTab === 'feedback' && renderFeedbackTab()}
          {activeTab === 'settings' && renderSettingsTab()}
          {activeTab === 'games' && renderGamesTab()}
        </main>
      </div>
    </div>
  )
}
