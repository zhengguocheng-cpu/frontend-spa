export interface GuestIdentity {
  id: string
  name: string
}

const GUEST_ID_KEY = 'guestUserId'
const GUEST_NAME_KEY = 'guestUserName'

function generateGuestId(): string {
  // 生成一个 8 位左右的数字 ID，尽量避免在同一环境中重复
  const now = Date.now().toString().slice(-6)
  const rand = Math.floor(Math.random() * 90 + 10).toString() // 2 位随机数
  return `${now}${rand}`
}

function getGuestStorage(): Storage {
  try {
    const search = window.location.search
    if (search.includes('guestStorage=session') && typeof sessionStorage !== 'undefined') {
      return sessionStorage
    }
  } catch (error) {}

  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
  } catch (error) {}

  return sessionStorage
}

export function getOrCreateGuestIdentity(): GuestIdentity {
  const storage = getGuestStorage()
  let id = storage.getItem(GUEST_ID_KEY)
  let name = storage.getItem(GUEST_NAME_KEY)

  if (!id) {
    id = generateGuestId()
    storage.setItem(GUEST_ID_KEY, id)
  }

  if (!name) {
    // 默认昵称：用户 + 完整 ID，例如 用户12345678
    name = `用户${id}`
    storage.setItem(GUEST_NAME_KEY, name)
  }

  return { id, name }
}

// 更新本地缓存的游客昵称，供后续自动登录时使用
export function setGuestName(name: string) {
  try {
    const storage = getGuestStorage()
    storage.setItem(GUEST_NAME_KEY, name)
  } catch (e) {
    // 忽略本地存储异常，避免影响登录流程
  }
}
