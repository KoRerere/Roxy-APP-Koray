import { toRaw } from 'vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { emitter } from '/@/utils/eventBus'
import { getLocalizedFeatureTips } from './confirm-app-quit-and-install'
import { resolveAppUpgradeReminderReason } from './upgrade-reminder-schedule'
import type { UpgradeReminderReason } from './upgrade-reminder-schedule'

/** 兼容热更新前「本会话已展示」标记，避免刚升级前端后立刻再弹一次 */
const LEGACY_SHOWN_KEY_PREFIX = 'preUpgradeTipsShown:'
/** 当前 Electron 会话是否已因启动弹出过该版本 */
const LAUNCH_SHOWN_KEY_PREFIX = 'appUpgradeLaunchShown:'
/** 强制更新就绪时刻与上次弹出时刻，跨进程重启仍按 8 小时间隔续算 */
const FORCE_STATE_KEY_PREFIX = 'appUpgradeForceReminder:'

/** 进行中的弹出任务世代号；下载中事件会自增以作废尚未弹出的公告 */
let showGeneration = 0
let inFlight: Promise<void> | null = null

/** 读取当前最新 app 更新条目，用于异步结束后二次确认仍是已下载 */
export type GetLatestAppUpdate = () => ResourceUpdateMessage | undefined

/** 强制更新提醒的跨日状态 */
interface ForceReminderState {
  /** 对应的待安装版本 */
  version: string
  /** 强制更新就绪时刻 */
  startAt: number
  /** 上次实际弹出时刻；缺省表示还没弹过 */
  lastShownAt?: number
}

function launchStorageKey(version?: string) {
  return `${LAUNCH_SHOWN_KEY_PREFIX}${version || 'unknown'}`
}

function legacyShownStorageKey(version?: string) {
  return `${LEGACY_SHOWN_KEY_PREFIX}${version || 'unknown'}`
}

function forceStateStorageKey(version?: string) {
  return `${FORCE_STATE_KEY_PREFIX}${version || 'unknown'}`
}

/** 安装包已落地：必须是 app + downloaded，下载中（含 100%）一律不算就绪 */
export function isAppUpdateReadyToAnnounce(item?: ResourceUpdateMessage | null): item is ResourceUpdateMessage {
  if (!item || item.type !== 'app' || item.status !== 'downloaded') {
    return false
  }
  if (typeof item.percent === 'number' && item.percent < 100) {
    return false
  }
  return true
}

/** 服务端是否将该 app 包标为强制更新 */
export function isAppForceUpgrade(item?: ResourceUpdateMessage | null): boolean {
  return Boolean(item?.originUpgradeData?.forceUpgrade)
}

/**
 * 新特性正文只来自 userGetAppFeatureTipsCreate（IPC: app:getLastUpdateFeature）。
 * 无 content 则不弹，避免用 getAppUpgradeCreate 的升级摘要冒充公告。
 */
async function collectFeatureTips(locale: string) {
  const feature = await globalThis.electronAPI.send('app:getLastUpdateFeature')
  return getLocalizedFeatureTips(feature?.newFeatureTips, locale)
}

function hasLaunchShown(version?: string) {
  try {
    return sessionStorage.getItem(launchStorageKey(version)) === '1'
      || sessionStorage.getItem(legacyShownStorageKey(version)) === '1'
  }
  catch {
    return false
  }
}

function markLaunchShown(version?: string) {
  try {
    sessionStorage.setItem(launchStorageKey(version), '1')
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist launch shown flag', error)
  }
}

function readStoredForceState(version: string): ForceReminderState | null {
  try {
    const raw = localStorage.getItem(forceStateStorageKey(version))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as ForceReminderState
    if (parsed?.version !== version || typeof parsed.startAt !== 'number') {
      return null
    }

    return {
      version,
      startAt: parsed.startAt,
      lastShownAt: typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : undefined,
    }
  }
  catch {
    return null
  }
}

function writeForceState(state: ForceReminderState) {
  try {
    localStorage.setItem(forceStateStorageKey(state.version), JSON.stringify(state))
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist force reminder state', error)
  }
}

/**
 * 首次发现强制更新即记下就绪时间戳，否则 3 天窗口会在每次启动被重算成「现在」而永不结束。
 */
function rememberForceStartAt(version: string, now: number): ForceReminderState {
  const existing = readStoredForceState(version)
  if (existing) {
    return existing
  }

  const state: ForceReminderState = {
    version,
    startAt: now,
  }
  writeForceState(state)
  return state
}

function markLastShownAt(state: ForceReminderState, now: number): ForceReminderState {
  const next = {
    ...state,
    lastShownAt: now,
  }
  writeForceState(next)
  return next
}

function markReminderShown(
  version: string,
  reason: UpgradeReminderReason,
  isForceUpgrade: boolean,
  now = Date.now(),
) {
  if (reason === 'launch') {
    markLaunchShown(version)
  }

  // 启动弹窗也写入 lastShownAt，避免刚弹完轮询立刻再走 8 小时间隔
  if (isForceUpgrade) {
    markLastShownAt(rememberForceStartAt(version, now), now)
  }
}

function resolveReminder(item: ResourceUpdateMessage, now = Date.now()) {
  const version = item.version || 'unknown'
  const isForceUpgrade = isAppForceUpgrade(item)
  const forceState = isForceUpgrade
    ? rememberForceStartAt(version, now)
    : { startAt: undefined, lastShownAt: undefined }

  return resolveAppUpgradeReminderReason({
    isForceUpgrade,
    launchShown: hasLaunchShown(version),
    startAt: forceState.startAt,
    lastShownAt: forceState.lastShownAt,
    now: new Date(now),
  })
}

/**
 * 客户端安装包就绪后尝试弹出「更新概览」。
 * 非强制：每个 APP 进程会话只弹一次（启动时）。
 * 强制：启动必弹；就绪后 3 天内距上次弹出满 8 小时再补弹，错过的间隔不回放。
 */
export async function tryShowPreUpgradeFeatureTips(
  updateItem: ResourceUpdateMessage,
  locale: string,
  getLatestAppUpdate?: GetLatestAppUpdate,
): Promise<void> {
  // 下载中 / 失败：作废进行中的弹出，避免 check 返回的过期 downloaded 在进度回来后仍弹
  if (!isAppUpdateReadyToAnnounce(updateItem)) {
    showGeneration++
    return
  }
  if (!resolveReminder(updateItem)) {
    return
  }
  if (inFlight) {
    return inFlight
  }

  const generation = ++showGeneration

  inFlight = (async () => {
    try {
      const tips = await collectFeatureTips(locale)
      if (generation !== showGeneration) {
        return
      }
      if (!tips.length) {
        console.log('[PreUpgradeTips] userGetAppFeatureTipsCreate has no localized content, skip dialog')
        return
      }

      const latest = getLatestAppUpdate?.() ?? updateItem
      if (!isAppUpdateReadyToAnnounce(latest)) {
        return
      }

      const reason = resolveReminder(latest)
      if (!reason) {
        return
      }

      markReminderShown(latest.version || 'unknown', reason, isAppForceUpgrade(latest))
      emitter.emit('showAppUpgradeDialog', {
        tips,
        actionMode: 'upgrade',
        updateItem: toRaw(latest),
      })
    }
    catch (error) {
      console.error('[PreUpgradeTips] failed', error)
    }
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}
