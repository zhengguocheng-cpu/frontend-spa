/**
 * ChatPanel - 聊天面板组件
 * 可复用的聊天侧边栏，支持多种棋牌游戏
 */

import React from 'react'
import { Button } from 'antd-mobile'
import type { ChatMessage } from '@/types/game'
import './style.css'

export interface ChatPanelProps {
  visible: boolean
  messages: ChatMessage[]
  currentMessage: string
  onClose: () => void
  onMessageChange: (message: string) => void
  onSend: () => void
}

export function ChatPanel(props: ChatPanelProps) {
  const { visible, messages, currentMessage, onClose, onMessageChange, onSend } = props

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSend()
    }
  }

  return (
    <>
      {/* 遮罩层 */}
      {visible && (
        <div
          className="chat-overlay"
          onClick={onClose}
        />
      )}

      {/* 聊天侧边栏 */}
      <aside className={`chat-sidebar ${visible ? 'visible' : 'hidden'}`}>
        {/* 头部 */}
        <div className="chat-header">
          <h3>房间聊天</h3>
          <Button 
            size="small" 
            fill="none"
            onClick={onClose}
            style={{ padding: '4px 8px' }}
          >
            关闭
          </Button>
        </div>

        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              暂无聊天消息
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="chat-message">
                <div className="chat-message-sender">{msg.sender}</div>
                <div className="chat-message-content">{msg.message}</div>
              </div>
            ))
          )}
        </div>

        {/* 输入区域 */}
        <div className="chat-input-area">
          <div className="chat-input-container">
            <input
              type="text"
              placeholder="输入聊天内容..."
              value={currentMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyPress={handleKeyPress}
              className="chat-input"
            />
            <Button 
              color="primary" 
              onClick={onSend}
              size="small"
            >
              发送
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
