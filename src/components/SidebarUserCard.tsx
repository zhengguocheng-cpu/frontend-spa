import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import AvatarSelector from './AvatarSelector'

export default function SidebarUserCard() {
  const { user, updateUser } = useAuth()

  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [currentAvatar, setCurrentAvatar] = useState<number>(() => {
    if (user && typeof user.avatar === 'string') {
      const match = user.avatar.match(/^avatar-(\d+)$/)
      if (match) {
        const id = Number(match[1])
        if (!Number.isNaN(id) && id > 0) return id
      }
    }
    return 1
  })

  const [displayName, setDisplayName] = useState(() => user?.name || '')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // 当全局 user 变化时，同步本地显示用的名字和头像编号
  useEffect(() => {
    if (!user) return
    setDisplayName(user.name || '')
    if (typeof user.avatar === 'string') {
      const match = user.avatar.match(/^avatar-(\d+)$/)
      if (match) {
        const id = Number(match[1])
        if (!Number.isNaN(id) && id > 0) {
          setCurrentAvatar(id)
        }
      }
    }
  }, [user])

  const { displayId, avatarClass, emojiAvatar } = useMemo(() => {
    const id = user?.id || '--'
    const rawAvatar = (user?.avatar || '').trim()

    if (rawAvatar && /^avatar-(\d+)$/.test(rawAvatar)) {
      const match = rawAvatar.match(/^avatar-(\d+)$/)
      const num = match ? Number(match[1]) : 1
      const safeId = !Number.isNaN(num) && num > 0 ? num : 1
      return {
        displayId: id,
        avatarClass: `profile-avatar-img avatar-sprite avatar-${safeId}`,
        emojiAvatar: '',
      }
    }

    const emoji = rawAvatar || '👤'
    return {
      displayId: id,
      avatarClass: '',
      emojiAvatar: emoji,
    }
  }, [user])

  const handleSelectAvatar = async (avatarId: number) => {
    if (!user) return
    setCurrentAvatar(avatarId)

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
    if (!user) return
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
        user.avatar && /^avatar-\d+$/.test(user.avatar)
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
    if (savingName) return
    const trimmed = displayName.trim()
    if (!trimmed) {
      handleCancelEditName()
      return
    }
    handleSaveName()
  }

  // 未登录用户：展示只读卡片，不提供交互
  if (!user) {
    return (
      <div className="profile-user-card">
        <div className="profile-avatar-container">
          <span style={{ fontSize: 32 }}>{emojiAvatar}</span>
        </div>
        <div className="profile-user-info">
          <div className="profile-name-row">
            <div className="profile-name">未登录玩家</div>
          </div>
          <div className="profile-id">ID: --</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="profile-user-card">
        <div
          className="profile-avatar-container"
          onClick={() => setShowAvatarSelector(true)}
          title="点击更换头像"
        >
          {avatarClass ? (
            <div className={avatarClass} />
          ) : (
            <span style={{ fontSize: 32 }}>{emojiAvatar}</span>
          )}
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
          <div className="profile-id">ID: {displayId}</div>
        </div>
      </div>

      {showAvatarSelector && (
        <AvatarSelector
          currentAvatar={currentAvatar}
          onSelect={handleSelectAvatar}
          onClose={() => setShowAvatarSelector(false)}
        />
      )}
    </>
  )
}
