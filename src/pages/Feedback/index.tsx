import { useState, FormEvent } from 'react'
import { Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import './style.css'

// 反馈类型
const FEEDBACK_TYPES = [
  { value: 'bug', label: 'BUG / 故障' },
  { value: 'experience', label: '玩法体验' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'other', label: '其他' },
] as const

export default function FeedbackPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [feedbackType, setFeedbackType] = useState<string>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!feedbackType || !content.trim()) {
      Toast.show({ content: '请选择反馈类型并填写具体描述', icon: 'fail' })
      return
    }

    try {
      setSubmitting(true)

      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : window.location.origin

      const formData = new FormData()
      formData.append('userName', user.name || user.id)
      formData.append('feedbackType', feedbackType)
      formData.append('feedbackContent', content.trim())
      formData.append('contact', contact.trim())
      formData.append('timestamp', new Date().toISOString())
      formData.append('userAgent', navigator.userAgent)
      formData.append('url', window.location.href)

      if (files && files.length > 0) {
        Array.from(files)
          .slice(0, 3)
          .forEach((file) => {
            formData.append('screenshots', file)
          })
      }

      const res = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        body: formData,
      })

      let json: any = null
      try {
        json = await res.json()
      } catch (err) {
        // ignore parse error
      }

      if (!res.ok || !json?.success) {
        const msg = json?.message || `提交失败（${res.status}）`
        throw new Error(msg)
      }

      Toast.show({ content: '反馈已提交，感谢你的建议！', icon: 'success' })
      setContent('')
      setContact('')
      setFiles(null)
      navigate(-1)
    } catch (err: any) {
      console.error('提交反馈失败:', err)
      Toast.show({ content: err?.message || '提交失败，请稍后重试', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="feedback-page">
      <header className="feedback-header">
        <button className="feedback-back" type="button" onClick={() => navigate(-1)}>
          返回
        </button>
        <div className="feedback-header-main">
          <h1 className="feedback-title">意见反馈</h1>
          <div className="feedback-subtitle">你的每一条建议，我们都会认真看完。</div>
        </div>
      </header>

      <section className="feedback-intro">
        <div className="feedback-greeting">你好，{user.name}</div>
        <p className="feedback-intro-text">
          如果遇到问题、对对局体验有想法，或者有新的玩法点子，欢迎在这里告诉我们。
          大概三十秒，就能完成一次反馈。
        </p>
      </section>

      <form className="feedback-form" onSubmit={handleSubmit}>
        <div className="feedback-field">
          <label className="feedback-label">反馈类型</label>
          <select
            className="feedback-select"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
          >
            {FEEDBACK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="feedback-field">
          <label className="feedback-label">具体描述</label>
          <textarea
            className="feedback-textarea"
            rows={5}
            placeholder="请尽量详细地描述你遇到的问题或建议，比如：在哪个页面、做了什么操作、期望的效果是什么等。"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="feedback-field">
          <label className="feedback-label">
            联系方式（选填）
            <span className="feedback-hint">（QQ / 微信 / 邮箱，用于必要时联系你）</span>
          </label>
          <input
            className="feedback-input"
            type="text"
            placeholder="例如：微信号、QQ、邮箱"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <div className="feedback-field">
          <label className="feedback-label">
            截图（选填，最多 3 张）
            <span className="feedback-hint">（上传出问题时的截图，更方便排查）</span>
          </label>
          <input
            className="feedback-file"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
          />
        </div>

        <div className="feedback-actions">
          <Button
            block
            color="primary"
            type="submit"
            loading={submitting}
            disabled={submitting}
          >
            提交反馈
          </Button>
          <div className="feedback-footnote">
            我们只会在必要时使用你留下的联系方式与您取得联系，不会对外公开。
          </div>
        </div>
      </form>
    </div>
  )
}
