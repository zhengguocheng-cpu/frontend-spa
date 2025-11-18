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

export function getOrCreateGuestIdentity(): GuestIdentity {
  let id = sessionStorage.getItem(GUEST_ID_KEY)
  let name = sessionStorage.getItem(GUEST_NAME_KEY)

  if (!id) {
    id = generateGuestId()
    sessionStorage.setItem(GUEST_ID_KEY, id)
  }

  if (!name) {
    // 默认昵称：用户 + 完整 ID，例如 用户12345678
    name = `用户${id}`
    sessionStorage.setItem(GUEST_NAME_KEY, name)
  }

  return { id, name }
}
