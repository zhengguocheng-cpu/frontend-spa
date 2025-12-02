const pagePreloaders: Array<() => Promise<unknown>> = [
  () => import('@/pages/LobbyHome'),
  () => import('@/pages/GameRoom'),
  () => import('@/pages/Settings'),
  () => import('@/pages/Profile'),
  () => import('@/pages/Leaderboard'),
  () => import('@/pages/Feedback'),
  () => import('@/pages/Login'),
  () => import('@/pages/Register'),
  () => import('@/pages/RoomList'),
  () => import('@/pages/InstallGuide'),
]

const STATIC_ASSETS: string[] = [
  '/imgs/loading.jpg',
  '/imgs/bk-2.jpg',
  '/imgs/dou-dizhu-avatar.png',
  '/imgs/card-quick-02.png',
  '/imgs/card-room.jpg',
  '/imgs/card-boom.jpg',
  '/imgs/avatars-sprite.png',
  '/imgs/coin.jpg',
  '/imgs/zuan0000.png',
  '/sounds/background.wav',
  '/sounds/jiaodizhu.mp3',
  '/sounds/zhadan.mp3',
  '/sounds/三带一.mp3',
  '/sounds/发牌.mp3',
  '/sounds/王炸.mp3',
  '/sounds/要不起.mp3',
  '/sounds/赢牌.mp3',
  '/sounds/输牌.mp3',
  '/sounds/飞机.mp3',
]

async function safePreloadModule(loader: () => Promise<unknown>) {
  try {
    await loader()
  } catch (error) {
    console.warn('预加载页面模块失败:', error)
  }
}

async function safeFetch(url: string) {
  try {
    await fetch(url, { cache: 'no-cache' })
  } catch (error) {
    console.warn('预加载静态资源失败:', url, error)
  }
}

export async function preloadCoreAssets() {
  const tasks: Promise<unknown>[] = []

  for (const loader of pagePreloaders) {
    tasks.push(safePreloadModule(loader))
  }

  for (const url of STATIC_ASSETS) {
    tasks.push(safeFetch(url))
  }

  await Promise.all(tasks)
}
