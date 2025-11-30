import { useState } from 'react'
import './AvatarSelector.css'

interface AvatarSelectorProps {
  currentAvatar: number // 当前头像编号 1-15
  onSelect: (avatarId: number) => void
  onClose: () => void
}

export default function AvatarSelector({ currentAvatar, onSelect, onClose }: AvatarSelectorProps) {
  const [selectedId, setSelectedId] = useState(currentAvatar)

  // 12个头像（根据你的图片）
  const avatars = [
    { id: 1, name: '法师' },
    { id: 2, name: '刺客' },
    { id: 3, name: '机器人' },
    { id: 5, name: '战士' },
    { id: 6, name: '骑士' },
    { id: 7, name: '狐狸' },
    { id: 9, name: '机械师' },
    { id: 10, name: '紫衣法师' },
    { id: 11, name: '暗影法师' },
    { id: 13, name: '红发战士' },
    { id: 14, name: '矮人' },
    { id: 15, name: '火焰法师' },
  ]

  const handleConfirm = () => {
    onSelect(selectedId)
    onClose()
  }

  return (
    <div className="avatar-selector-mask" onClick={onClose}>
      <div
        className="avatar-selector-panel"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="avatar-selector-header">选择头像</div>

        <div className="avatar-selector-grid">
          {avatars.map((avatar) => (
            <div
              key={avatar.id}
              className={`avatar-item ${selectedId === avatar.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(avatar.id)}
            >
              <div className={`avatar-sprite avatar-${avatar.id}`}></div>
              <div className="avatar-name">{avatar.name}</div>
            </div>
          ))}
        </div>

        <div className="avatar-selector-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-confirm" onClick={handleConfirm}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
