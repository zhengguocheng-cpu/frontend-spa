import { useEffect, useState, useMemo } from 'react'
import { Toast } from 'antd-mobile'
import { useAuth } from '@/context/AuthContext'
import { formatScore } from '@/utils/scoreFormatter'
import './style.css'

interface RechargeOption {
  id: string
  coins: number
  price: number
  hot?: boolean
}

// 充值档位：从 10 万金币开始，用“万”为单位展示（10 万金币 = 1 元）
const RECHARGE_OPTIONS: RechargeOption[] = [
  { id: 'r1', coins: 100000, price: 1, hot: true },  // 10 万
  { id: 'r2', coins: 200000, price: 2 },             // 20 万
  { id: 'r3', coins: 500000, price: 5 },             // 50 万
  { id: 'r4', coins: 1000000, price: 10 },           // 100 万
]

// 会员等级规则：仿照“新手 / 老手 / 高手 / 精英 / 大师 / 特大”六档，仅前端展示
const LEVELS = [
  { id: 'L0', name: '新手', min: 0, max: 199999 },        // < 20 万
  { id: 'L1', name: '老手', min: 200000, max: 499999 },    // 20 万 - 49.9 万
  { id: 'L2', name: '高手', min: 500000, max: 999999 },    // 50 万 - 99.9 万
  { id: 'L3', name: '精英', min: 1000000, max: 1999999 },  // 100 万 - 199.9 万
  { id: 'L4', name: '大师', min: 2000000, max: 4999999 },  // 200 万 - 499.9 万
  { id: 'L5', name: '特大', min: 5000000, max: Infinity }, // ≥ 500 万
]

export default function Membership() {
  const { user } = useAuth()
  const [walletScore, setWalletScore] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'level' | 'recharge' | 'score'>('level')

  useEffect(() => {
    if (!user) {
      setWalletScore(null)
      return
    }

    const controller = new AbortController()

    const loadWallet = async () => {
      try {
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
        } catch {
          // ignore body parse error
        }

        if (!res.ok || !json?.success || !json.data) {
          console.warn('加载会员钱包失败或返回结构异常:', res.status, json?.message)
          setWalletScore(0)
          return
        }

        const data = json.data
        const scoreValue = typeof data.totalScore === 'number' ? data.totalScore : 0
        setWalletScore(scoreValue)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('加载会员钱包失败:', err)
        setWalletScore(0)
      }
    }

    loadWallet()

    return () => {
      controller.abort()
    }
  }, [user])

  if (!user) {
    return null
  }

  const totalScore = typeof walletScore === 'number' ? walletScore : 0
  const displayScore = formatScore(totalScore)

  const currentLevel = useMemo(() => {
    return LEVELS.find((lvl) => totalScore >= lvl.min && totalScore <= lvl.max) || LEVELS[0]
  }, [totalScore])

  const nextLevel = useMemo(() => {
    const idx = LEVELS.findIndex((lvl) => lvl.id === currentLevel.id)
    if (idx < 0 || idx === LEVELS.length - 1) return null
    return LEVELS[idx + 1]
  }, [currentLevel])

  const needForNext =
    nextLevel && nextLevel.min !== Infinity ? Math.max(0, nextLevel.min - totalScore) : null

  const handleRecharge = (opt: RechargeOption) => {
    // 这里只预留前端入口，具体扣费与发放金币由后端钱包服务实现
    const coinsWan = opt.coins / 10000
    Toast.show({
      content: `充值功能开发中，将来可在此充值 ${coinsWan} 万金币（价格示意：${opt.price} 元）`,
      icon: 'info',
    })
  }

  return (
    <div className="membership-page">
      <div className="membership-container">
        {/* 左侧：用户信息 + 会员等级缩略 */}
        <aside className="membership-sidebar">
          <h1 className="membership-title">👑 会员中心</h1>

          <div className="membership-user">
            <div className="membership-username">{user.name}</div>
            <div className="membership-userid">ID: {user.id}</div>
          </div>

          <div className="membership-level-card">
            <div className="level-label">当前会员等级</div>
            <div className="level-main">
              <span className="level-tag">{currentLevel.name}</span>
            </div>
            <div className="level-progress-text">
              {nextLevel && needForNext != null
                ? `再获得 ${formatScore(needForNext)} 金币即可升级为 ${nextLevel.name}`
                : '已是最高等级'}
            </div>
            <div className="level-badges">
              {LEVELS.map((lvl) => (
                <div
                  key={lvl.id}
                  className={`level-badge ${lvl.id === currentLevel.id ? 'active' : ''}`}
                >
                  <span className="level-badge-id">{lvl.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="membership-rules">
            <div className="rules-title">会员积分规则</div>
            <ul className="rules-list">
              <li>1. 每 1 金币计 1 积分，用于计算会员等级，仅作展示，不影响真实钱包。</li>
              <li>2. 参与对局赢得的金币将累积到总积分中，输掉的金币会相应扣减。</li>
              <li>3. 充值获得的金币同样计入会员积分，提升会员等级更快。</li>
              <li>4. 后续可根据会员等级解锁头像框、特效等装饰（预留）。</li>
            </ul>
          </div>
        </aside>

        {/* 右侧：Tab 切换区 */}
        <main className="membership-main">
          <div className="membership-tabs">
            <button
              type="button"
              className={`membership-tab ${activeTab === 'level' ? 'active' : ''}`}
              onClick={() => setActiveTab('level')}
            >
              等级
            </button>
            <button
              type="button"
              className={`membership-tab ${activeTab === 'recharge' ? 'active' : ''}`}
              onClick={() => setActiveTab('recharge')}
            >
              充值
            </button>
            <button
              type="button"
              className={`membership-tab ${activeTab === 'score' ? 'active' : ''}`}
              onClick={() => setActiveTab('score')}
            >
              积分
            </button>
          </div>

          {activeTab === 'level' && (
            <>
              <div className="membership-balance-panel">
                <div className="balance-label">当前金币</div>
                <div className="balance-value">{displayScore}</div>
              </div>

              <div className="membership-section-header">
                <div className="section-title">会员等级</div>
                <div className="section-subtitle">根据总金币数量自动划分六档等级</div>
              </div>

              <div className="level-badges level-badges-large">
                {LEVELS.map((lvl) => (
                  <div
                    key={lvl.id}
                    className={`level-badge ${lvl.id === currentLevel.id ? 'active' : ''}`}
                  >
                    <span className="level-badge-id">{lvl.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'recharge' && (
            <>
              <div className="membership-balance-panel">
                <div className="balance-label">当前金币</div>
                <div className="balance-value">{displayScore}</div>
              </div>

              <div className="membership-section-header">
                <div className="section-title">金币充值</div>
                <div className="section-subtitle">请选择一个档位进行充值（示意样式）</div>
              </div>

              <div className="recharge-grid">
                {RECHARGE_OPTIONS.map((opt) => {
                  const coinsWan = opt.coins / 10000
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`recharge-card ${opt.hot ? 'hot' : ''}`}
                      onClick={() => handleRecharge(opt)}
                    >
                      {opt.hot && <div className="recharge-tag">热门</div>}
                      <div className="recharge-coin-visual">
                        <div className="coin-stack" />
                      </div>
                      <div className="recharge-info">
                        <div className="recharge-coins">{coinsWan} 万金币</div>
                        <div className="recharge-price">{opt.price} 元</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {activeTab === 'score' && (
            <>
              <div className="membership-section-header">
                <div className="section-title">积分规则说明</div>
                <div className="section-subtitle">与游戏内结算规则保持一致</div>
              </div>
              <div className="rules-block">
                <div className="rules-title">基础分与倍数（与游戏结算一致）</div>
                <ul className="rules-list">
                  <li>1. 每局基础分固定为 5000 分。</li>
                  <li>2. 炸弹：每出现 1 个炸弹，倍数 ×3，总炸弹倍数为 3 的炸弹数量次方。</li>
                  <li>3. 王炸：每出现 1 个王炸，倍数 ×8，总王炸倍数为 8 的王炸数量次方。</li>
                  <li>4. 春天 / 反春：满足条件时额外 ×16，春天和反春不会同时触发。</li>
                  <li>5. 总倍数 = 基础倍数 × 炸弹倍数 × 王炸倍数 × 春天倍数 × 反春倍数。</li>
                  <li>
                    6. 结算分：以 5000 × 总倍数 为基数，地主赢时地主获得 2 份，两个农民各失去
                    1 份；农民赢时相反。
                  </li>
                </ul>
                <div className="rules-note">* 本页说明直接来自后端计分逻辑，最终结果以实际对局结算为准。</div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
