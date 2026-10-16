import { toRaw } from 'vue'
import type { GetVersionUpdateRemindListData } from '@roxy/backend-api'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { API } from '/@/api'
import { emitter } from '/@/utils/eventBus'
import { getUserAgentOs } from '/@/utils/basic'
import { getOsConfig } from '/@/electron-api-polyfill/utils/getOsConfig'
import { getLocalizedFeatureTips } from './confirm-app-quit-and-install'
import {
  applyRemindShown,
  armRemindSupplement,
  clearRemindSupplement,
  countVersionsBehind,
  createEmptyRemindState,
  ensureStrongRemindStart,
  isRemindConfigActive,
  pickRemindCopy,
  resolveRemindLevel,
  resolveVersionRemindDecision,
} from './upgrade-reminder-schedule'
import type {
  RemindCopySource,
  VersionRemindPersistedState,
  VersionRemindScheduleConfig,
} from './upgrade-reminder-schedule'

/** 配置和版本列表的内存缓存，避免每分钟钟点检查都打接口 */
const REMIND_CACHE_MS = 10 * 60 * 1000
/** 版本列表单页条数 */
const VERSION_PAGE_SIZE = 100
/** 版本列表最多翻页次数，防止异常 total 导致死循环 */
const VERSION_PAGE_LIMIT = 20

/** 本会话已弹过的强提醒启动档 */
const STRONG_LAUNCH_KEY_PREFIX = 'appUpgradeStrongLaunchShown:'
/** 本会话刚关掉的档位，避免关掉后立刻被补弹逻辑再次打开 */
const SUPPLEMENT_BLOCK_KEY_PREFIX = 'appUpgradeSupplementBlocked:'
/** 跨重启的提醒进度 */
const REMIND_STATE_KEY_PREFIX = 'appUpgradeRemindState:'

/** 进行中的弹出任务世代号；下载中事件会自增以作废尚未弹出的公告 */
let showGeneration = 0
let inFlight: Promise<void> | null = null
let remindCache: RemindSnapshot | null = null
/** 某一档已经确认没有可展示内容，避免每分钟重复拉新特性 */
let emptyContentKey = ''

/** 读取当前最新 app 更新条目，用于异步结束后二次确认仍是已下载 */
export type GetLatestAppUpdate = () => ResourceUpdateMessage | undefined

/** 一次拉取到的提醒配置和版本列表 */
interface RemindSnapshot {
  /** 拉取时刻，用于 10 分钟内复用 */
  fetchedAt: number
  /** 判定用的时间规则 */
  config: VersionRemindScheduleConfig
  /** 当前系统已发布版本号 */
  versions: string[]
  /** 普通提醒文案 */
  normalCopy?: RemindCopySource
  /** 强提醒文案 */
  strongCopy?: RemindCopySource
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

/**
 * 客户端安装包就绪后，按版本提醒配置决定是否弹出。
 * 正文仍来自新特性接口；配置标题和说明显示在正文上方。两边都空则不弹。
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
  if (inFlight) {
    return inFlight
  }

  const generation = ++showGeneration

  inFlight = (async () => {
    try {
      const snapshot = await loadRemindSnapshot()
      if (generation !== showGeneration || !snapshot) {
        return
      }

      const localVersion = await globalThis.electronAPI.send('app:getAppVersion')
      const behindCount = countVersionsBehind(localVersion, snapshot.config.latestVersion, snapshot.versions)
      if (behindCount == null) {
        console.log('[PreUpgradeTips] version list cannot be compared, skip dialog')
        return
      }

      const latestVersion = snapshot.config.latestVersion || 'unknown'
      const now = new Date()
      let state = readRemindState(latestVersion)
      // 3 天窗口从配置生效后第一次判定为强提醒起算，未启用时不开始计时
      if (
        isRemindConfigActive(snapshot.config, now)
        && resolveRemindLevel(behindCount, snapshot.config.behindVersions) === 'strong'
      ) {
        const withStart = ensureStrongRemindStart(state, now.getTime())
        if (withStart !== state) {
          state = withStart
          writeRemindState(state)
        }
      }

      const decision = resolveVersionRemindDecision({
        config: snapshot.config,
        behindCount,
        now,
        state,
        strongLaunchShown: hasStrongLaunchShown(latestVersion),
        supplementBlockedSlotId: readSupplementBlock(latestVersion),
      })
      if (!decision) {
        return
      }

      const contentKey = `${latestVersion}:${decision.slotId}:${locale}`
      if (emptyContentKey === contentKey) {
        return
      }

      const tips = await collectFeatureTips(locale)
      if (generation !== showGeneration) {
        return
      }

      const remindCopy = pickRemindCopy(
        decision.level === 'strong' ? snapshot.strongCopy : snapshot.normalCopy,
        locale,
      )
      if (!tips.length && !remindCopy) {
        emptyContentKey = contentKey
        console.log('[PreUpgradeTips] remind copy and feature tips are both empty, skip dialog')
        return
      }

      const latest = getLatestAppUpdate?.() ?? updateItem
      if (!isAppUpdateReadyToAnnounce(latest)) {
        return
      }

      const confirmed = resolveVersionRemindDecision({
        config: snapshot.config,
        behindCount,
        now: new Date(),
        state: readRemindState(latestVersion),
        strongLaunchShown: hasStrongLaunchShown(latestVersion),
        supplementBlockedSlotId: readSupplementBlock(latestVersion),
      })
      if (!confirmed || confirmed.slotId !== decision.slotId || confirmed.reason !== decision.reason) {
        return
      }

      const nowMs = Date.now()
      writeRemindState(applyRemindShown(readRemindState(latestVersion), confirmed, nowMs))
      if (confirmed.reason === 'launch') {
        markStrongLaunchShown(latestVersion)
      }

      emitter.emit('showAppUpgradeDialog', {
        tips,
        actionMode: 'upgrade',
        updateItem: toRaw(latest),
        remindCopy: remindCopy ?? undefined,
        onDismiss: () => {
          // 补弹本身被关掉后不再连环补。普通档关掉即本周期已提醒，再登记会在非提醒日补出第二天
          if (confirmed.reason === 'supplement' || confirmed.level === 'normal') {
            return
          }
          writeRemindState(armRemindSupplement(readRemindState(latestVersion), confirmed.slotId))
          markSupplementBlocked(latestVersion, confirmed.slotId)
        },
        onConfirmUpgrade: () => {
          writeRemindState(clearRemindSupplement(readRemindState(latestVersion)))
        },
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

/**
 * 新特性正文只来自 userGetAppFeatureTipsCreate（IPC: app:getLastUpdateFeature）。
 * 没有正文时仍可只展示配置文案。
 */
async function collectFeatureTips(locale: string) {
  const feature = await globalThis.electronAPI.send('app:getLastUpdateFeature')
  return getLocalizedFeatureTips(feature?.newFeatureTips, locale)
}

/** 10 分钟内复用配置和版本列表。任一接口失败则本次不弹，也不写入缓存 */
async function loadRemindSnapshot(): Promise<RemindSnapshot | null> {
  if (remindCache && Date.now() - remindCache.fetchedAt < REMIND_CACHE_MS) {
    return remindCache
  }

  const { os, osBit } = remindListOs()
  const [configResult, versions] = await Promise.all([
    API.base.getVersionUpdateRemindList(),
    fetchPublishedVersions(os, osBit),
  ])
  if (configResult.code !== 0 || !configResult.data || !versions) {
    console.log('[PreUpgradeTips] remind config or version list unavailable, skip dialog')
    return null
  }

  const snapshot = toRemindSnapshot(configResult.data, versions)
  remindCache = snapshot
  return snapshot
}

/** 分页拉当前系统的已发布版本。中途失败返回 null，避免用残缺列表把强提醒判轻 */
async function fetchPublishedVersions(os: string, osBit: string): Promise<string[] | null> {
  const versions: string[] = []
  for (let page = 1; page <= VERSION_PAGE_LIMIT; page += 1) {
    const result = await API.appStatistics.getVersionListList({
      os,
      osBit,
      page_index: String(page),
      page_size: String(VERSION_PAGE_SIZE),
    })
    if (result.code !== 0 || !result.data?.rows) {
      return null
    }

    for (const row of result.data.rows) {
      if (row.version) {
        versions.push(row.version)
      }
    }
    if (result.data.rows.length < VERSION_PAGE_SIZE) {
      break
    }
    if (page === VERSION_PAGE_LIMIT) {
      console.log('[PreUpgradeTips] version list truncated, skip dialog')
      return null
    }
  }
  return versions
}

/** 版本列表的 os 与后台约定为 Windows / macOS / Linux */
function remindListOs(): { os: string, osBit: string } {
  const name = getUserAgentOs()
  const osBit = getOsConfig().osBit
  if (/mac/i.test(name)) {
    return { os: 'macOS', osBit }
  }
  if (/linux/i.test(name)) {
    return { os: 'Linux', osBit }
  }
  return { os: 'Windows', osBit }
}

/** 把接口数据收成判定配置和两套文案 */
function toRemindSnapshot(data: GetVersionUpdateRemindListData['data'], versions: string[]): RemindSnapshot {
  return {
    fetchedAt: Date.now(),
    config: {
      exists: data.exists,
      enabled: data.enabled,
      latestVersion: data.latestVersion || '',
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      longTerm: data.longTerm,
      behindVersions: data.triggerRule?.behindVersions ?? 3,
      cycleDays: data.normalRemind?.cycleDays ?? 0,
      dailyTimes: data.normalRemind?.dailyTimes ?? 0,
      remindTime: data.normalRemind?.remindTime || '',
    },
    versions,
    normalCopy: data.normalRemind,
    strongCopy: data.strongRemind,
  }
}

/** 读取进度。版本对不上或结构损坏时当作没弹过 */
function readRemindState(latestVersion: string): VersionRemindPersistedState {
  try {
    const raw = localStorage.getItem(remindStateKey(latestVersion))
    if (!raw) {
      return createEmptyRemindState(latestVersion)
    }
    const parsed = JSON.parse(raw) as VersionRemindPersistedState
    if (parsed?.latestVersion !== latestVersion || !Array.isArray(parsed.shownNormalSlots)) {
      return createEmptyRemindState(latestVersion)
    }
    return {
      latestVersion,
      strongStartAt: typeof parsed.strongStartAt === 'number' ? parsed.strongStartAt : undefined,
      lastOfficialShownAt: typeof parsed.lastOfficialShownAt === 'number' ? parsed.lastOfficialShownAt : undefined,
      shownNormalSlots: parsed.shownNormalSlots.filter(id => typeof id === 'string'),
      pendingSupplementSlotId: typeof parsed.pendingSupplementSlotId === 'string' ? parsed.pendingSupplementSlotId : undefined,
      consumedSupplementSlotIds: Array.isArray(parsed.consumedSupplementSlotIds)
        ? parsed.consumedSupplementSlotIds.filter(id => typeof id === 'string')
        : [],
    }
  }
  catch {
    return createEmptyRemindState(latestVersion)
  }
}

/** 写入提醒进度 */
function writeRemindState(state: VersionRemindPersistedState) {
  try {
    localStorage.setItem(remindStateKey(state.latestVersion), JSON.stringify(state))
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist remind state', error)
  }
}

/** 本会话是否已弹过强提醒启动档 */
function hasStrongLaunchShown(latestVersion: string): boolean {
  try {
    return sessionStorage.getItem(strongLaunchKey(latestVersion)) === '1'
  }
  catch {
    return false
  }
}

/** 记下本会话的强提醒启动档，避免轮询立刻再弹 */
function markStrongLaunchShown(latestVersion: string) {
  try {
    sessionStorage.setItem(strongLaunchKey(latestVersion), '1')
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist strong launch flag', error)
  }
}

/** 本会话被关掉、不能立刻补的档位 */
function readSupplementBlock(latestVersion: string): string | undefined {
  try {
    return sessionStorage.getItem(supplementBlockKey(latestVersion)) || undefined
  }
  catch {
    return undefined
  }
}

/** 同一会话内关掉后不再补弹，下次进入客户端才补 */
function markSupplementBlocked(latestVersion: string, slotId: string) {
  try {
    sessionStorage.setItem(supplementBlockKey(latestVersion), slotId)
  }
  catch (error) {
    console.error('[PreUpgradeTips] failed to persist supplement block', error)
  }
}

/** 进度存储键 */
function remindStateKey(latestVersion: string) {
  return `${REMIND_STATE_KEY_PREFIX}${latestVersion}`
}

/** 强提醒启动档的会话键 */
function strongLaunchKey(latestVersion: string) {
  return `${STRONG_LAUNCH_KEY_PREFIX}${latestVersion}`
}

/** 补弹屏蔽的会话键 */
function supplementBlockKey(latestVersion: string) {
  return `${SUPPLEMENT_BLOCK_KEY_PREFIX}${latestVersion}`
}
