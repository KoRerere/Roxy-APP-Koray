import type { SessionContext } from '../browser/browser-item/browserItem'

export interface SessionData {
  sessionId: string
  userId: string
  dirId: string
  containerId: string
  containerName: string
  httpPort: number
  udpPort: number
  nekoAdminPassword: string
  createdAt: number
  lastSeenAt: number
  /** 总使用时长截止时间，不受心跳续期间隔影响 */
  usageExpiresAt: number
  /** 当前会话有效截止时间，取空闲过期和总使用时长的较早值 */
  expiresAt: number
  /** 断连计费上报所需的鉴权上下文 */
  sessionContext?: SessionContext
}

export type SessionState = 'active' | 'idle-expired' | 'usage-expired'

/**
 * 兼容旧会话数据。
 * 旧版本 Redis 里没有 usageExpiresAt 时，退化为使用 expiresAt 作为总时长截止时间。
 */
export function normalizeSessionData(sessionData: SessionData): SessionData {
  const usageExpiresAt = typeof sessionData.usageExpiresAt === 'number'
    ? sessionData.usageExpiresAt
    : sessionData.expiresAt

  return {
    ...sessionData,
    usageExpiresAt,
    expiresAt: Math.min(sessionData.expiresAt, usageExpiresAt),
  }
}

export function getSessionState(sessionData: SessionData, now = Date.now()): SessionState {
  if (sessionData.usageExpiresAt <= now) {
    return 'usage-expired'
  }

  if (sessionData.expiresAt <= now) {
    return 'idle-expired'
  }

  return 'active'
}
