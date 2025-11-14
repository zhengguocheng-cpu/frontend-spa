import { useState, useEffect } from 'react'
import { Button, Form, Input, Picker, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import './style.css'

const avatarOptions = ['👑', '🐯', '🐼', '🐻', '🐰', '🐶', '🐱', '🦁', '🐸', '🐵']

export default function Login() {
  const { login, loading, user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState(avatarOptions[0])
  const [pickerVisible, setPickerVisible] = useState(false)

  const handleSubmit = async () => {
    if (!username.trim()) {
      Toast.show({ content: '请输入玩家昵称', icon: 'fail' })
      return
    }

    console.log('🔵 开始登录...', { username: username.trim(), avatar })
    setSubmitting(true)
    try {
      console.log('🔵 调用 login 函数...')
      const authUser = await login({
        userName: username.trim(),
        playerAvatar: avatar,
        htmlName: 'spa',
      })
      console.log('✅ 登录成功:', authUser)
      Toast.show({ content: `欢迎回来，${authUser.name}`, icon: 'success' })
      
      // 检查是否有待恢复的房间（从 URL 或 sessionStorage）
      const urlParams = new URLSearchParams(window.location.search)
      const roomIdFromUrl = urlParams.get('roomId')
      const lastRoomId = sessionStorage.getItem('lastRoomId')
      const lastRoomTime = sessionStorage.getItem('lastRoomTime')
      
      // 如果 URL 中有 roomId，或者 localStorage 中有最近的房间（30秒内）
      const targetRoomId = roomIdFromUrl || (
        lastRoomId && lastRoomTime && 
        (Date.now() - parseInt(lastRoomTime)) < 30000 
          ? lastRoomId 
          : null
      )
      
      if (targetRoomId) {
        console.log('🔄 检测到待恢复的房间:', targetRoomId)
        // 跳转到房间，后端会自动发送 game_state_restored 事件
        navigate(`/game/${targetRoomId}`, { replace: true })
      } else {
        console.log('🔵 跳转到房间列表')
        // 跳转到房间列表
        navigate('/rooms', { replace: true, state: null })
      }
      
      console.log('✅ 跳转完成')
    } catch (error) {
      console.error('❌ 登录失败:', error)
      const errMsg = error instanceof Error ? error.message : '登录失败，请稍后重试'
      Toast.show({ content: errMsg, icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  // 如果已登录，直接跳转（只在组件挂载时检查一次）
  useEffect(() => {
    if (user) {
      navigate('/rooms', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在挂载时执行一次

  if (user) {
    return null
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">🎮 斗地主</h1>
          <p className="login-subtitle">输入昵称，选择头像，开始游戏</p>
        </div>

        <Form layout="horizontal" className="login-form">
          <Form.Item label="玩家昵称">
            <Input
              placeholder="例如：欢乐斗地主"
              value={username}
              onChange={setUsername}
              disabled={loading || submitting}
              clearable
            />
          </Form.Item>

          <Form.Item
            label="选择头像"
            onClick={() => !loading && !submitting && setPickerVisible(true)}
          >
            <div className="avatar-display">
              <span className="avatar-emoji">{avatar}</span>
              <span className="avatar-text">点击选择</span>
            </div>
          </Form.Item>
        </Form>

        <Button
          color="primary"
          size="large"
          block
          loading={loading || submitting}
          onClick={handleSubmit}
          className="login-button"
        >
          进入游戏大厅
        </Button>
      </div>

      <Picker
        columns={[avatarOptions.map((v) => ({ label: `${v} 头像`, value: v }))]}
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        value={[avatar]}
        onConfirm={(val) => setAvatar(val[0] as string)}
      />
    </div>
  )
}