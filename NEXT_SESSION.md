# 下次工作快速启动指南

## 🎯 当前状态
- **文件**: `src/pages/GameRoom/index.tsx`
- **行数**: 2190行
- **目标**: 500行
- **剩余**: 1690行需减少

---

## ⚡ 快速开始（3步）

### 1. 启动开发环境
```bash
cd frontend-spa
npm run dev
```

### 2. 查看当前分支
```bash
git status
# 应该在 refactor/frontend-v1.7.0 分支
```

### 3. 开始第一个任务

---

## 📋 优先任务列表

### Task 1: 提取事件处理函数 (~400行，60分钟)

**目标**: 将Socket事件处理提取到 `events/` 模块

**步骤**:
1. 打开 `src/pages/GameRoom/index.tsx`
2. 找到 `useEffect(() => { if (!connected) return ...` (约670行)
3. 提取所有 `handleXxx` 函数到 `events/gameEvents.ts`
4. 导入并使用新模块

**示例代码**:
```typescript
// events/gameEvents.ts
export function createGameHandlers(params) {
  return {
    handleGameStarted: (data) => { ... },
    handleDealCardsAll: (data) => { ... },
    // ...
  }
}

// index.tsx
const gameHandlers = createGameHandlers({ dispatch, ... })
socket.on('game_started', gameHandlers.handleGameStarted)
```

**预计减少**: ~400行

---

### Task 2: 整合useEffect (~200行，40分钟)

**目标**: 合并相关的useEffect

**当前问题**:
- 10+ 个独立useEffect
- 很多只有几行代码
- 相关逻辑分散

**整合方案**:
```typescript
// 整合前（3个useEffect）
useEffect(() => { ... }, [gameStatus])
useEffect(() => { ... }, [isMyTurn])
useEffect(() => { ... }, [players])

// 整合后（1个useEffect）
useEffect(() => {
  if (gameStatus === 'finished') { ... }
  if (isMyTurn) { ... }
  // 相关逻辑放一起
}, [gameStatus, isMyTurn, players])
```

**预计减少**: ~200行

---

### Task 3: 删除冗余注释 (~100行，20分钟)

**删除**:
- 过时的中文注释
- 重复的说明
- 调试用注释

**保留**:
- JSDoc注释
- 关键业务逻辑说明
- TODO标记

**预计减少**: ~100行

---

## 🚀 快速达标方案

### 完成上述3个任务
- Task 1: -400行
- Task 2: -200行
- Task 3: -100行
- **总计**: -700行

### 预计结果
2190 - 700 = **1490行**

### 如果继续
再完成以下任务可到达目标：
- 简化长函数 (~300行)
- 提取工具函数 (~200行)
- 删除调试代码 (~200行)
- 重复代码DRY (~200行)

**最终**: ~590行 ✅ **达成500行目标！**

---

## 📚 参考文档

- `REFACTOR_SESSION_SUMMARY.md` - 详细总结
- `AGGRESSIVE_REFACTOR_PLAN.md` - 激进方案
- `REFACTOR_ROADMAP.md` - 路线图
- `TESTING_CHECKLIST.md` - 测试清单

---

## ⚠️ 注意事项

1. **编码问题**: 
   - ❌ 不要使用PowerShell批量操作
   - ✅ 手动编辑或使用IDE重构

2. **测试验证**:
   - 每完成一个任务就测试
   - 确保游戏功能正常

3. **频繁提交**:
   - 每个任务完成后Git提交
   - 方便回滚

---

## 🎯 今天的目标

**保守**: 完成Task 1（提取事件处理）  
**正常**: 完成Task 1 + Task 2  
**激进**: 完成所有3个任务

**加油！** 💪
