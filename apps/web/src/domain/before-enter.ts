import type { UserGetUserInfoListData } from '@roxy/backend-api'
import { Role } from '/@/enums'

export const BEFORE_ENTER_SESSION_KEY = 'before_enter_active'
export const ECOMMERCE_OPEN_GUIDE_PENDING_KEY = 'ecommerce_open_guide_pending'
/** 跳过 before-enter 后触发的「创建账号」跨页引导 */
export const ECOMMERCE_SKIP_CREATE_GUIDE_KEY = 'ecommerce_skip_create_guide'
export const BEFORE_ENTER_STEP_KEY_PREFIX = 'before_enter_step:'

/** before-enter 可恢复的步骤页（不含 skip 用的 normal） */
export type BeforeEnterStep = 'choose' | 'proxy' | 'third' | 'platform'

/** 跳过引导后的创建账号 tour 阶段 */
export type EcommerceSkipCreateGuidePhase
  = | 'create_btn'
    | 'basic_info'
    | 'post_create'
  /** 已点击绑定，等待绑定成功后再聚焦启动 */
    | 'awaiting_bind'
    | 'open'

export interface EcommerceSkipCreateGuideState {
  phase: EcommerceSkipCreateGuidePhase
  /** 创建时已绑定设备则跳过列表「绑定设备」聚焦 */
  skipBind?: boolean
}

const BEFORE_ENTER_STEPS: readonly BeforeEnterStep[] = ['choose', 'proxy', 'third', 'platform']

type UserInfo = Partial<UserGetUserInfoListData['data']>

function beforeEnterStepKey(userId: number | string) {
  return `${BEFORE_ENTER_STEP_KEY_PREFIX}${userId}`
}

function isBeforeEnterStep(value: string | null): value is BeforeEnterStep {
  return !!value && (BEFORE_ENTER_STEPS as readonly string[]).includes(value)
}

export function isGuideIncomplete(userInfo: UserInfo): boolean {
  const status = userInfo.onboardingTaskStatus
  return globalThis.isElectron
    ? status?.firstRegisterGuideStatus === false
    : status?.firstWebRegisterGuideStatus === false
}

/** 仅登录流判断：Owner 且未完成首次引导时应进入 before-enter */
export function needsBeforeEnter(userInfo: UserInfo, intoWorkspaceId?: number): boolean {
  if (intoWorkspaceId) {
    return false
  }
  if (userInfo.role !== Role.OWNER) {
    return false
  }
  return isGuideIncomplete(userInfo)
}

/** 冷启动/导航强制恢复：引导未完成且本地仍有步骤进度 */
export function needsBeforeEnterResume(userInfo: UserInfo, intoWorkspaceId?: number): boolean {
  if (!needsBeforeEnter(userInfo, intoWorkspaceId)) {
    return false
  }
  const userId = userInfo.id
  if (userId == null) {
    return false
  }
  return hasBeforeEnterProgress(userId)
}

export function getBeforeEnterStep(userId: number | string): BeforeEnterStep | null {
  const value = localStorage.getItem(beforeEnterStepKey(userId))
  return isBeforeEnterStep(value) ? value : null
}

export function setBeforeEnterStep(userId: number | string, step: BeforeEnterStep) {
  localStorage.setItem(beforeEnterStepKey(userId), step)
}

export function clearBeforeEnterStep(userId: number | string) {
  localStorage.removeItem(beforeEnterStepKey(userId))
}

export function hasBeforeEnterProgress(userId: number | string): boolean {
  return getBeforeEnterStep(userId) != null
}

/** 进入引导时若尚无进度则写入 choose，不覆盖已有步骤 */
export function ensureBeforeEnterStep(userId: number | string): BeforeEnterStep {
  const existing = getBeforeEnterStep(userId)
  if (existing) {
    return existing
  }
  setBeforeEnterStep(userId, 'choose')
  return 'choose'
}

export function markBeforeEnterSession() {
  sessionStorage.setItem(BEFORE_ENTER_SESSION_KEY, '1')
}

export function clearBeforeEnterSession() {
  sessionStorage.removeItem(BEFORE_ENTER_SESSION_KEY)
}

export function isBeforeEnterSessionActive(): boolean {
  return sessionStorage.getItem(BEFORE_ENTER_SESSION_KEY) === '1'
}

export function markPendingEcommerceOpenGuide() {
  sessionStorage.setItem(ECOMMERCE_OPEN_GUIDE_PENDING_KEY, '1')
}

/** 是否存在待消费的电商打开引导（不消费） */
export function hasPendingEcommerceOpenGuide(): boolean {
  return sessionStorage.getItem(ECOMMERCE_OPEN_GUIDE_PENDING_KEY) === '1'
}

export function consumePendingEcommerceOpenGuide(): boolean {
  if (sessionStorage.getItem(ECOMMERCE_OPEN_GUIDE_PENDING_KEY) !== '1') {
    return false
  }
  sessionStorage.removeItem(ECOMMERCE_OPEN_GUIDE_PENDING_KEY)
  return true
}

function parseSkipCreateGuideState(raw: string | null): EcommerceSkipCreateGuideState | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EcommerceSkipCreateGuideState>
    const phases: EcommerceSkipCreateGuidePhase[] = ['create_btn', 'basic_info', 'post_create', 'awaiting_bind', 'open']
    if (!parsed.phase || !phases.includes(parsed.phase)) {
      return null
    }
    return {
      phase: parsed.phase,
      skipBind: parsed.skipBind === true,
    }
  }
  catch {
    return null
  }
}

/** 跳过 before-enter 后启动「创建账号」跨页引导 */
export function markPendingEcommerceSkipCreateGuide() {
  const state: EcommerceSkipCreateGuideState = { phase: 'create_btn' }
  sessionStorage.setItem(ECOMMERCE_SKIP_CREATE_GUIDE_KEY, JSON.stringify(state))
}

export function getEcommerceSkipCreateGuideState(): EcommerceSkipCreateGuideState | null {
  return parseSkipCreateGuideState(sessionStorage.getItem(ECOMMERCE_SKIP_CREATE_GUIDE_KEY))
}

export function setEcommerceSkipCreateGuideState(state: EcommerceSkipCreateGuideState) {
  sessionStorage.setItem(ECOMMERCE_SKIP_CREATE_GUIDE_KEY, JSON.stringify(state))
}

export function clearEcommerceSkipCreateGuide() {
  sessionStorage.removeItem(ECOMMERCE_SKIP_CREATE_GUIDE_KEY)
}

export function hasPendingEcommerceSkipCreateGuide(): boolean {
  return getEcommerceSkipCreateGuideState() != null
}
