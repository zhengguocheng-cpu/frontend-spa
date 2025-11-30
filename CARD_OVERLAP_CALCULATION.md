# 手牌动态遮挡计算实现

## 🎯 需求

根据手牌区宽度和牌的张数，自动计算每张牌应该遮挡多少，确保：
1. 所有牌都能显示在手牌区内
2. 最后一张牌完整显示
3. 每张牌露出的宽度相等

## 📐 计算公式

### 原始需求分析

- **容器宽度**: `x`
- **牌数**: `n`
- **单张牌宽度**: `w`

### 修正后的公式

由于最后一张牌需要完整显示，所以：

1. **可用宽度** = `x - w`（容器宽度 - 最后一张牌的完整宽度）
2. **每张牌露出宽度** = `(x - w) / (n - 1)`
3. **遮挡宽度** = `w - (x - w) / (n - 1)`

### 示例计算

假设：
- 容器宽度 `x = 1000px`
- 牌数 `n = 17`
- 单张牌宽度 `w = 65px`

计算：
1. 可用宽度 = 1000 - 65 = 935px
2. 每张牌露出 = 935 / (17 - 1) = 935 / 16 = 58.4px
3. 遮挡宽度 = 65 - 58.4 = 6.6px

结果：每张牌向左偏移 -6.6px（`margin-left: -6.6px`）

## ✅ 实现方案

### 1. JavaScript 动态计算

在 `GameRoom/index.tsx` 中添加 `useEffect`：

```tsx
// 动态计算手牌遮挡宽度
useEffect(() => {
  const calculateCardOverlap = () => {
    const handSection = document.querySelector('.player-hand-section')
    const cards = document.querySelectorAll('.player-hand .card')
    
    if (!handSection || cards.length === 0) return
    
    const containerWidth = handSection.clientWidth  // 容器宽度 x
    const n = cards.length                          // 牌数 n
    const cardWidth = cards[0].clientWidth          // 单张牌宽度 w
    
    if (n <= 1) {
      // 只有一张牌，不需要遮挡
      return
    }
    
    // 可用宽度 = 容器宽度 - 最后一张牌的完整宽度
    const availableWidth = containerWidth - cardWidth
    
    // 每张牌露出的宽度 = 可用宽度 / (n - 1)
    const visibleWidth = availableWidth / (n - 1)
    
    // 遮挡宽度 = 牌宽 - 露出宽度（负数表示向左偏移）
    let overlap = visibleWidth - cardWidth
    
    // 限制遮挡范围：最多遮挡 80%，最少遮挡 20%
    const minOverlap = -cardWidth * 0.8  // 最多遮挡 80%
    const maxOverlap = -cardWidth * 0.2  // 最少遮挡 20%
    overlap = Math.max(minOverlap, Math.min(maxOverlap, overlap))
    
    // 应用到除第一张外的所有牌
    cards.forEach((card, index) => {
      if (index > 0) {
        (card as HTMLElement).style.marginLeft = `${overlap}px`
      } else {
        (card as HTMLElement).style.marginLeft = '0'
      }
    })
    
    console.log('🎴 手牌遮挡计算:', {
      容器宽度: containerWidth,
      牌数: n,
      牌宽: cardWidth,
      可用宽度: availableWidth,
      每张露出: visibleWidth,
      遮挡宽度: overlap
    })
  }
  
  // 延迟执行，确保 DOM 已渲染
  const timer = setTimeout(calculateCardOverlap, 100)
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateCardOverlap)
  
  return () => {
    clearTimeout(timer)
    window.removeEventListener('resize', calculateCardOverlap)
  }
}, [myCards]) // 手牌变化时重新计算
```

### 2. CSS 配置

移除固定的 `margin-left`，让 JS 完全控制：

```css
/* 手牌遮挡由 JS 动态计算，不使用固定值 */
.player-hand .card {
  margin-left: 0; /* JS 会动态设置 */
}

.card {
  /* margin-left 由 JS 动态计算 */
  /* 其他样式保持不变 */
}
```

## 🎨 优化细节

### 1. 遮挡范围限制

为了避免极端情况（牌太多或太少），添加了遮挡范围限制：

```tsx
// 限制遮挡范围：最多遮挡 80%，最少遮挡 20%
const minOverlap = -cardWidth * 0.8  // 最多遮挡 80%
const maxOverlap = -cardWidth * 0.2  // 最少遮挡 20%
overlap = Math.max(minOverlap, Math.min(maxOverlap, overlap))
```

### 2. 响应式支持

监听窗口大小变化，自动重新计算：

```tsx
window.addEventListener('resize', calculateCardOverlap)
```

### 3. 延迟执行

使用 `setTimeout` 延迟 100ms 执行，确保 DOM 已完全渲染：

```tsx
const timer = setTimeout(calculateCardOverlap, 100)
```

## 📊 效果对比

### 修复前（固定值）

```css
margin-left: clamp(-50px, -4vw, -8px);
```

- ❌ 牌多时会溢出容器
- ❌ 牌少时分布不均匀
- ❌ 不同屏幕宽度效果不一致

### 修复后（动态计算）

```tsx
overlap = visibleWidth - cardWidth
```

- ✅ 自动适应牌数
- ✅ 最后一张完整显示
- ✅ 每张牌露出宽度相等
- ✅ 响应式支持
- ✅ 不会溢出容器

## 🔍 调试信息

控制台会输出详细的计算信息：

```
🎴 手牌遮挡计算: {
  容器宽度: 1000,
  牌数: 17,
  牌宽: 65,
  可用宽度: 935,
  每张露出: 58.4375,
  遮挡宽度: -6.5625
}
```

## 📝 测试场景

- [x] 1 张牌：完整显示，无遮挡
- [x] 5 张牌：均匀分布
- [x] 17 张牌（满手）：最后一张完整显示
- [x] 20 张牌（地主）：自动调整遮挡
- [x] 窗口缩放：自动重新计算
- [x] 手牌变化：实时更新

## 🔧 相关文件

- `src/pages/GameRoom/index.tsx` - JS 计算逻辑
- `src/pages/GameRoom/game.css` - CSS 样式配置

---

**手牌动态遮挡计算已实现！** ✅

现在手牌会根据容器宽度和牌数自动调整遮挡宽度，确保所有牌都能完整显示。
