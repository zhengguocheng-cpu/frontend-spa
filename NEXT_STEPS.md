# 下一步实现计划

## ✅ 已完成

1. **基础架构**
   - Socket 连接管理
   - 路由和认证
   - Redux 状态管理

2. **房间功能**
   - 房间列表
   - 创建/加入房间
   - 准备功能

3. **游戏 UI**
   - 手牌显示（重叠、红黑花色、JOKER）
   - 手牌选中（向上移动，不遮挡）
   - 抢地主 UI（倒计时、按钮）
   - 底牌显示（顶端中间）

4. **叫地主逻辑**
   - 轮流叫地主
   - 15秒倒计时
   - 自动不抢
   - 地主确定

## 📋 待实现功能

### 1. 出牌逻辑 🎯

#### 参考文件
- `frontend/public/room/js/room-simple.js` 第 1100-1300 行

#### 需要实现
- [ ] 出牌按钮（出牌、不出、提示）
- [ ] 出牌验证（牌型检测）
- [ ] 出牌动画
- [ ] 上家出牌显示
- [ ] 回合切换
- [ ] 倒计时（30秒）

#### 关键事件
```typescript
// 发送
socket.emit('play_cards', {
  roomId: string,
  userId: string,
  cards: string[]
})

socket.emit('pass', {
  roomId: string,
  userId: string
})

// 接收
socket.on('turn_to_play', (data) => {
  // 轮到谁出牌
  playerId: string,
  canPass: boolean,
  timeLimit: number
})

socket.on('cards_played', (data) => {
  // 玩家出牌
  playerId: string,
  cards: string[],
  cardType: string,
  nextPlayerId: string
})

socket.on('player_passed', (data) => {
  // 玩家不出
  playerId: string,
  nextPlayerId: string
})
```

#### UI 结构（照抄 frontend）
```html
<!-- 出牌控制按钮 -->
<div class="play-controls">
  <button id="playCardsBtn">出牌</button>
  <button id="passBtn">不出</button>
  <button id="hintBtn">提示</button>
</div>

<!-- 上家出牌显示 -->
<div class="played-cards-area">
  <div class="played-cards-label">上家出牌</div>
  <div class="played-cards-container">
    <!-- 出的牌 -->
  </div>
</div>
```

### 2. 牌型检测 🃏

#### 需要实现
- [ ] 单张
- [ ] 对子
- [ ] 三张
- [ ] 三带一
- [ ] 三带二
- [ ] 顺子（5张以上）
- [ ] 连对（3对以上）
- [ ] 飞机
- [ ] 炸弹
- [ ] 王炸

#### 参考
- `frontend/public/room/js/card-validator.js`
- 或者使用后端验证

### 3. 游戏结束 🏁

#### 参考文件
- `frontend/public/room/js/room-simple.js` 第 1400-1500 行

#### 需要实现
- [ ] 游戏结束检测（某人出完牌）
- [ ] 结算界面
- [ ] 积分计算
- [ ] 再来一局

#### 关键事件
```typescript
socket.on('game_over', (data) => {
  winner: string,
  winnerId: string,
  landlordWin: boolean,
  scores: {
    [userId: string]: number
  },
  gameResult: {
    landlord: string,
    farmers: string[],
    winner: string
  }
})
```

#### UI 结构（照抄 frontend）
```html
<div class="game-result-modal">
  <div class="result-header">
    <h2>游戏结束</h2>
  </div>
  <div class="result-content">
    <div class="winner-info">
      <div class="winner-avatar">👑</div>
      <div class="winner-name">玩家名</div>
      <div class="winner-text">获胜！</div>
    </div>
    <div class="scores-table">
      <!-- 积分表 -->
    </div>
  </div>
  <div class="result-actions">
    <button>再来一局</button>
    <button>返回大厅</button>
  </div>
</div>
```

### 4. 其他功能 ✨

#### 发牌动画
- [ ] 卡牌从中央飞向玩家
- [ ] 翻牌效果
- [ ] 音效

#### 聊天功能
- [ ] 发送消息
- [ ] 接收消息
- [ ] 快捷语

#### 音效
- [ ] 出牌音效
- [ ] 抢地主音效
- [ ] 胜利/失败音效

## 🎯 实现顺序

### 第一阶段：出牌逻辑（最重要）
1. 实现出牌按钮 UI
2. 实现出牌事件监听
3. 实现回合切换
4. 实现上家出牌显示
5. 实现不出功能

### 第二阶段：游戏结束
1. 监听 game_over 事件
2. 显示结算界面
3. 实现再来一局

### 第三阶段：优化
1. 添加牌型检测
2. 添加提示功能
3. 添加动画效果
4. 添加音效

## 📚 参考文档

### Frontend 关键文件
```
frontend/public/room/
├── room.html                 # HTML 结构
├── css/
│   └── room.css             # 样式
└── js/
    ├── room-simple.js       # 核心逻辑
    ├── card-validator.js    # 牌型验证
    └── sound-manager.js     # 音效管理
```

### Backend 关键文件
```
backend/src/services/socket/
├── GameFlowHandler.ts       # 游戏流程
├── CardPlayHandler.ts       # 出牌逻辑
└── GameEndHandler.ts        # 游戏结束
```

## 🔧 开发建议

1. **照抄 frontend**
   - 不要自己设计逻辑
   - 保持结构和样式一致
   - 先实现功能，后优化

2. **分步实现**
   - 一次只做一个功能
   - 测试通过后再继续
   - 记录遇到的问题

3. **使用现有代码**
   - Redux slice 已经有出牌相关的 action
   - Socket 事件监听框架已搭建
   - 只需要补充具体逻辑

4. **后端优先**
   - 先确认后端接口是否完整
   - 如果后端缺少功能，记录在 BACKEND_MODIFICATION_PLAN.md
   - 不要修改后端，除非绝对必要

## 📝 下一步行动

1. 阅读 `frontend/public/room/js/room-simple.js` 的出牌逻辑
2. 检查后端是否有对应的 Socket 事件
3. 实现出牌按钮 UI
4. 实现出牌事件监听
5. 测试出牌流程

---

**开始实现出牌逻辑！** 🚀
