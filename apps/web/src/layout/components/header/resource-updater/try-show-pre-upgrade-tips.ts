import { toRaw } from 'vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { emitter } from '/@/utils/eventBus'
import { getLocalizedFeatureTips } from './confirm-app-quit-and-install'

/** sessionStorage：某版本前置公告已展示后，本浏览器会话内不再自动弹 */
const SHOWN_KEY_PREFIX = 'preUpgradeTipsShown:'

/** 进行中的弹出任务世代号；下载中事件会自增以作废尚未弹出的公告 */
let showGeneration = 0
let inFlight: Promise<void> | null = null

/** 读取当前最新 app 更新条目，用于异步结束后二次确认仍是已下载 */
export type GetLatestAppUpdate = () => ResourceUpdateMessage | undefined

function shownStorageKey(version?: string) {
  return `${SHOWN_KEY_PREFIX}${version || 'unknown'}`
}

function hasShown(version?: string) {
  try {
    return sessionStorage.getItem(shownStorageKey(version)) === '1'
  }
  catch {
    return false
  }
}

function markShown(version?: string) {
  try {
    sessionStorage.setItem(shownStorageKey(version), '1')
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist shown flag', error)
  }
}

/** 安装包已落地：必须是 app + downloaded，下载中（含 100%）一律不算就绪 */
export function isAppUpdateReadyToAnnounce(item?: ResourceUpdateMessage | null): item is ResourceUpdateMessage {
  if (!item || item.type !== 'app' || item.status !== 'downloaded')
    return false
  if (typeof item.percent === 'number' && item.percent < 100)
    return false
  return true
}

/**
 * 新特性正文只来自 userGetAppFeatureTipsCreate（IPC: app:getLastUpdateFeature）。
 * 无 content 则不弹，避免用 getAppUpgradeCreate 的升级摘要冒充公告。
 */
async function collectFeatureTips(locale: string) {
  const feature = await globalThis.electronAPI.send('app:getLastUpdateFeature')
  return getLocalizedFeatureTips(feature?.newFeatureTips, locale)
}

/**
 * 客户端安装包下载完成后尝试弹出「更新概览」。
 * 下载中的推送会作废尚未弹出的任务；异步拉 tips 结束后仍以最新 status 为准。
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
  if (hasShown(updateItem.version))
    return
  if (inFlight)
    return inFlight

  const generation = ++showGeneration

  inFlight = (async () => {
    try {
      const tips = await collectFeatureTips(locale)
      if (generation !== showGeneration)
        return
      if (!tips.length) {
        console.log('[PreUpgradeTips] userGetAppFeatureTipsCreate has no localized content, skip dialog')
        return
      }

      const latest = getLatestAppUpdate?.() ?? updateItem
      if (!isAppUpdateReadyToAnnounce(latest) || hasShown(latest.version))
        return

      markShown(latest.version)
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
