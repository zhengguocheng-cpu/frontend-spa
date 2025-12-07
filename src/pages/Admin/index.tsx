import { useState, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import './style.css'

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
  userAgent?: string
  url?: string
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'feedback' | 'settings' | 'games'>('feedback')
  const [loading, setLoading] = useState(false)
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [games, setGames] = useState<GameLogSummary[]>([])
  const [selectedGame, setSelectedGame] = useState<any | null>(null)
  const [gameDetailLoading, setGameDetailLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'feedback') {
      void fetchFeedbackList()
    } else if (activeTab === 'games') {
      void fetchGameLogs()
    }
  }, [activeTab])

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
    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">用户反馈</h2>
          <button
            type="button"
            className="admin-refresh-button"
            onClick={() => fetchFeedbackList()}
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {feedbackList.length === 0 ? (
          <div className="admin-empty">暂无反馈记录</div>
        ) : (
          <div className="admin-feedback-list">
            {feedbackList.map((item) => (
              <div key={item.id} className="admin-feedback-item">
                <div className="admin-feedback-header-row">
                  <div className="admin-feedback-user">
                    <span className="admin-feedback-user-name">{item.userName || '匿名用户'}</span>
                    <span className={`admin-feedback-type admin-feedback-type-${item.feedbackType || 'other'}`}>
                      {FEEDBACK_TYPE_LABELS[item.feedbackType] || item.feedbackType || '其他'}
                    </span>
                  </div>
                  <div className="admin-feedback-time">
                    {item.timestamp || item.createdAt}
                  </div>
                </div>

                <div className="admin-feedback-content">{item.feedbackContent}</div>

                <div className="admin-feedback-meta">
                  {item.contact && (
                    <div className="admin-feedback-meta-item">
                      <span className="label">联系方式</span>
                      <span className="value">{item.contact}</span>
                    </div>
                  )}
                  {item.url && (
                    <div className="admin-feedback-meta-item">
                      <span className="label">页面</span>
                      <span className="value">{item.url}</span>
                    </div>
                  )}
                  {Array.isArray(item.screenshots) && item.screenshots.length > 0 && (
                    <div className="admin-feedback-meta-item">
                      <span className="label">截图</span>
                      <span className="value">{item.screenshots.length} 张（文件名保存在后端）</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
