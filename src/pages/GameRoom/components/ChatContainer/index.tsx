/**
 * ChatContainer - 聊天容器组件（封装聊天面板和切换按钮）
 */

import { ChatPanel } from '@/shared/components'
import type { ChatMessage } from '@/types/game'

interface ChatContainerProps {
  visible: boolean
  messages: ChatMessage[]
  currentMessage: string
  onToggle: () => void
  onMessageChange: (msg: string) => void
  onSend: () => void
}

export function ChatContainer(props: ChatContainerProps) {
  const { visible, messages, currentMessage, onToggle, onMessageChange, onSend } = props

  return (
    <>
      {/* 聊天面板 */}
      <ChatPanel
        visible={visible}
        messages={messages}
        currentMessage={currentMessage}
        onClose={onToggle}
        onMessageChange={onMessageChange}
        onSend={onSend}
      />

      {/* 右下角：聊天按钮 */}
      {!visible && (
        <div className="bottom-right-ui">
          <button className="chat-toggle-btn" onClick={onToggle} title="打开聊天">
            💬
          </button>
        </div>
      )}
    </>
  )
}
