# 修复：全屏设置导致其他页面无法滚动

## 问题描述
在修复游戏房间的全屏显示问题时，在全局 CSS 中设置了 `overflow: hidden`，导致首页、登录页等其他页面无法滚动，按钮被隐藏在视口外。

## 问题原因
之前的修复方案在 `src/index.css` 中对 `html`、`body` 和 `#root` 全局设置了 `overflow: hidden`：

```css
html, body {
  overflow: hidden; /* ❌ 错误：影响所有页面 */
}

#root {
  overflow: hidden; /* ❌ 错误：影响所有页面 */
}
```

这导致：
- ✅ 游戏房间页面正常全屏显示（这是我们想要的）
- ❌ 首页无法滚动，看不到底部的"前往登录"按钮
- ❌ 登录页无法滚动
- ❌ 房间列表页无法滚动

## 修复方案

### 原则
**只在需要全屏的页面（游戏房间）设置 `overflow: hidden`，其他页面保持可滚动。**

### 1. 移除全局 overflow 限制

**文件**: `src/index.css`

```css
/* ✅ 修复后：不设置 overflow，允许页面自然滚动 */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  /* 移除了 overflow: hidden */
}

#root {
  width: 100%;
  min-height: 100%; /* 改为 min-height，允许内容超出 */
  /* 移除了 overflow: hidden */
}
```

### 2. 游戏房间页面保持全屏

**文件**: `src/pages/GameRoom/style.css`

游戏房间页面已经使用 `position: fixed` 和自己的 `overflow: hidden`，不受全局设置影响：

```css
.game-room-container {
  position: fixed; /* 固定定位，脱离文档流 */
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden; /* 只在游戏房间禁止滚动 */
}
```

### 3. 其他页面显式允许滚动

为了确保其他页面能够正常滚动，在各个页面容器上添加 `overflow-y: auto`：

#### 首页
**文件**: `src/pages/Home/style.css`

```css
.home-container {
  min-height: 100vh;
  overflow-y: auto; /* 允许垂直滚动 */
}
```

#### 登录页
**文件**: `src/pages/Login/style.css`

```css
.login-container {
  min-height: 100vh;
  overflow-y: auto; /* 允许垂直滚动 */
}
```

#### 房间列表页
**文件**: `src/pages/RoomList/style.css`

```css
.room-list-container {
  min-height: 100vh;
  overflow-y: auto; /* 允许垂直滚动 */
}
```

## 修改文件清单

1. ✅ `src/index.css` - 移除全局 `overflow: hidden`
2. ✅ `src/pages/Home/style.css` - 添加 `overflow-y: auto`
3. ✅ `src/pages/Login/style.css` - 添加 `overflow-y: auto`
4. ✅ `src/pages/RoomList/style.css` - 添加 `overflow-y: auto`
5. ✅ `src/pages/GameRoom/style.css` - 保持 `position: fixed` 和 `overflow: hidden`

## 测试步骤

### 1. 测试首页
1. 访问首页 `/`
2. **验证**: 如果内容超出视口，应该能够滚动
3. **验证**: 能够看到底部的"前往登录"按钮
4. **验证**: 点击按钮能够正常跳转

### 2. 测试登录页
1. 访问登录页 `/login`
2. **验证**: 如果内容超出视口，应该能够滚动
3. **验证**: 能够看到所有表单字段和登录按钮

### 3. 测试房间列表页
1. 访问房间列表页 `/rooms`
2. **验证**: 如果房间很多，应该能够滚动查看
3. **验证**: 能够看到所有房间和操作按钮

### 4. 测试游戏房间页
1. 进入游戏房间
2. **验证**: 页面完全填充屏幕，没有滚动条
3. **验证**: 所有游戏元素在视口内正确显示
4. **验证**: 调整窗口大小时，界面自适应且不出现滚动条

## 技术说明

### 为什么游戏房间不受影响？

游戏房间使用 `position: fixed`，这使得它：
1. **脱离文档流**：不受父元素的 overflow 设置影响
2. **固定在视口**：始终占据整个屏幕
3. **独立控制**：有自己的 `overflow: hidden` 设置

### 为什么其他页面需要 overflow-y: auto？

虽然移除了全局的 `overflow: hidden`，但显式设置 `overflow-y: auto` 可以：
1. **明确意图**：清楚表明这个页面是可滚动的
2. **防止意外**：避免未来的 CSS 修改影响滚动行为
3. **浏览器兼容**：确保在所有浏览器中行为一致

## 最佳实践

### ✅ 推荐做法
- 在需要全屏的页面使用 `position: fixed`
- 在普通页面使用 `min-height: 100vh` 和 `overflow-y: auto`
- 避免在全局设置 `overflow: hidden`

### ❌ 避免做法
- 不要在 `html`、`body` 或 `#root` 上设置 `overflow: hidden`
- 不要使用 `height: 100vh` 而应该用 `min-height: 100vh`
- 不要假设所有页面都需要相同的滚动行为

## 预期效果

### 首页
- ✅ 能够看到完整内容
- ✅ 能够滚动到底部
- ✅ 所有按钮可点击

### 登录页
- ✅ 表单完整显示
- ✅ 能够滚动（如果需要）
- ✅ 登录按钮可见

### 房间列表页
- ✅ 房间列表可滚动
- ✅ 所有操作按钮可见
- ✅ 能够查看所有房间

### 游戏房间页
- ✅ 完全填充屏幕
- ✅ 没有滚动条
- ✅ 所有游戏元素在视口内
- ✅ 窗口大小改变时自适应
