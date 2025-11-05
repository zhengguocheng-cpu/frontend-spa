# 地主标识实现

## ✅ 已完成

### 1. CSS 样式

#### 地主玩家样式
```css
.player-info.landlord {
  border: 3px solid #FFD700; /* 金色边框 */
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 140, 0, 0.15));
  border-radius: 12px;
  padding: 12px;
  position: relative;
}
```

#### 地主徽章
```css
.landlord-badge {
  position: absolute;
  top: -12px;
  right: -12px;
  font-size: 28px;
  z-index: 10;
  animation: landlord-pulse 1.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

@keyframes landlord-pulse {
  0%, 100% { 
    transform: scale(1);
  }
  50% { 
    transform: scale(1.15);
  }
}
```

### 2. JSX 实现

#### 获取 landlordId
```typescript
const {
  players = [],
  gameStatus = 'waiting',
  myCards = [],
  selectedCards = [],
  lastPlayedCards = null,
  landlordCards = [],
  landlordId = null, // 添加这一行
} = gameState
```

#### 左侧玩家
```tsx
<div className={`player-info ${landlordId === leftPlayer.id ? 'landlord' : ''}`}>
  {landlordId === leftPlayer.id && (
    <div className="landlord-badge" title="地主">👑</div>
  )}
  {/* 玩家信息 */}
</div>
```

#### 右侧玩家
```tsx
<div className={`player-info ${landlordId === rightPlayer.id ? 'landlord' : ''}`}>
  {landlordId === rightPlayer.id && (
    <div className="landlord-badge" title="地主">👑</div>
  )}
  {/* 玩家信息 */}
</div>
```

#### 当前玩家（底部）
```tsx
<div className={`current-player-info ${landlordId === (user?.id || user?.name) ? 'landlord' : ''}`}>
  {landlordId === (user?.id || user?.name) && (
    <div className="landlord-badge" title="地主">👑</div>
  )}
  {/* 玩家信息 */}
</div>
```

## 🎨 视觉效果

### 地主玩家
- ✅ 金色边框（#FFD700）
- ✅ 金色光晕阴影
- ✅ 金色渐变背景
- ✅ 圆角边框

### 地主徽章
- ✅ 👑 皇冠图标
- ✅ 位于玩家信息右上角
- ✅ 脉冲动画（1.5秒循环）
- ✅ 阴影效果

## 📊 效果对比

### 普通玩家
```
┌─────────────┐
│  👤         │
│  玩家名     │
│  17 张      │
└─────────────┘
```

### 地主玩家
```
┌─────────────┐👑 ← 脉冲动画
│  👤         │
│  地主名     │ ← 金色边框和光晕
│  20 张      │
└─────────────┘
```

## 🔧 关键点

### 1. 动态判断
- 使用 `landlordId === player.id` 判断是否是地主
- 动态添加 `landlord` class
- 条件渲染徽章

### 2. 位置定位
- 徽章使用 `position: absolute`
- 相对于玩家信息容器定位
- `top: -12px, right: -12px` 位于右上角

### 3. 动画效果
- 使用 CSS `@keyframes` 定义脉冲动画
- `animation: landlord-pulse 1.5s ease-in-out infinite`
- 缩放范围：1.0 → 1.15 → 1.0

### 4. 样式层叠
- 金色边框覆盖原有边框
- 金色光晕阴影
- 半透明金色渐变背景

## ✅ 测试清单

- [ ] 地主确定后，地主玩家显示金色边框
- [ ] 地主玩家右上角显示 👑 徽章
- [ ] 徽章有脉冲动画
- [ ] 三个位置（左、右、底）都能正确显示
- [ ] 非地主玩家不显示标识

## 📝 参考文件

- `frontend/public/room/css/room.css` 第 214-243 行
- `frontend/public/room/js/room-simple.js` 第 1784-1835 行

---

**地主标识已完成！** 👑
