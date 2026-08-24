import type { UnwrapRowsType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import type { QuitSyncProgressMessage } from '@roxy/electron-preload'
import type { LaunchBy } from '/@/modules/browser/browser-manager/browserItem'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { shallowReactive, watch } from '@vue/reactivity'
import { app } from 'electron'
import { debounce, isPlainObject } from 'es-toolkit'
import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import pLimit from 'p-limit'
import { API } from '/@/api'
import { Role } from '/@/constants/common'
import { isAppQuitting } from '/@/modules/app'
import { beginQuitSyncProgress, finishQuitSyncProgress, updateQuitSyncProgress } from '/@/modules/app/quitSyncProgress'
import { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
import { cacheToClear } from '/@/modules/browser/browser-manager/constants'
import { sendErrorMessage } from '/@/modules/browser/browser-manager/message'
import { getUserDataDirPath } from '/@/modules/browser/browser-manager/utils'
import { coreManager } from '/@/modules/browser/core-manager'
import { ipcSender } from '/@/modules/ipc/sender'
import { shortcutStore } from '/@/modules/shortcut-manager/ShortcutStore'
import { store } from '/@/modules/store'
import { scheduleRestoreClientNetworkSnapshotUpdate } from '/@/modules/store/restoreClientNetwork'
import { appUpdater } from '/@/modules/updater'
import { asyncDebounce, getCachePath, getProxyEntityLabels } from '/@/utils'
import { getCursorDisplayWorkArea } from '/@/utils/windowGridLayout'

const batchLaunchLimit = pLimit(5)

/** 退出/升级场景下的服务端同步参数 (大 payload + 多窗口) */
const QUIT_SYNC_BATCH_SIZE = 6
const QUIT_SYNC_TIMEOUT_MS = 45_000
const QUIT_SYNC_MAX_RETRIES = 3

/**
 * 退出/升级/登出时整体同步的兜底超时.
 * 防止个别窗口 close() 或服务端同步僵死, 导致整个退出流程被无限阻塞.
 * 实际超时 = 基础值 + 每窗口增量, 并以最大值封顶.
 */
const QUIT_SYNC_OVERALL_BASE_MS = 60_000
const QUIT_SYNC_OVERALL_PER_WINDOW_MS = 8_000
const QUIT_SYNC_OVERALL_MAX_MS = 5 * 60_000

/**
 * 单个窗口 close()/数据同步的兜底超时.
 * close() 依赖浏览器进程关闭后才 resolve; 若进程僵死, uploadDataPromiser 永不 settle,
 * 会导致 #batchUploadData 的 allSettled 无限等待 (普通关窗路径不经过 closeAll 的整体超时).
 * 这里给每个窗口的 task 单独加超时, 保证 allSettled 一定能结束、finally 清理一定执行.
 * 取值需大于正常的 saveCookies + browser.close + OSS 上传耗时, 仅用于防僵死.
 */
const SINGLE_WINDOW_CLOSE_TIMEOUT_MS = 2 * 60_000

/**
 * 单窗口加权进度权重: 一个窗口「关闭 + OSS 上传」了结计 0.7, 「接口同步」了结再计 0.3, 合计 1.0.
 * 整体进度 = 所有窗口完成度之和 / 总窗口数, 全程平滑且单调递增.
 */
const QUIT_SYNC_WEIGHT_CLOSE_OSS = 0.7
const QUIT_SYNC_WEIGHT_API = 0.3

/** 已购代理/设备异常状态文案；按 store.workspaceType 区分普通/电商术语 */
const OpenErrorMessageMap = {
  /** IP检测不通 */
  get 1() { return getProxyEntityLabels().openErrorByStatus[1] },
  /** 国家不一致 */
  get 2() { return getProxyEntityLabels().openErrorByStatus[2] },
  /** 已过期 */
  get 3() { return getProxyEntityLabels().openErrorByStatus[3] },
  /** 已退款 */
  get 4() { return getProxyEntityLabels().openErrorByStatus[4] },
  /** 退款中 */
  get 5() { return getProxyEntityLabels().openErrorByStatus[5] },
  /** 更换中 */
  get 6() { return getProxyEntityLabels().openErrorByStatus[6] },
}

export class BrowserManager {
  /** 已经打开过的空间 ID */
  #openedWorkspaceIds = new Set<number>()
  /** 需要定时同步窗口打开状态的空间 ID */
  get #needSyncWindowOpenStatusWorkspaceIds() {
    return [...this.#openedWorkspaceIds].filter(workspaceId => store.allWorkspaceId?.includes(workspaceId))
  }

  /** 正在打开中的浏览器集合 */
  openingBrowserMap = new Map<string, { browserItem: BrowserItem, launchPromise: Promise<void> }>()
  /** 已经打开的浏览器集合 */
  openedBrowserMap = shallowReactive(new Map<string, BrowserItem>())
  /** 频繁关闭窗口时，等待的上传数据队列 */
  uploadDataQueue = new Map<string, Promise<{ requestHeaders?: any, uploadParams?: any } | undefined>>()
  /** 获取已打开的浏览器列表 */
  get openedBrowserList() {
    return Array.from(this.openedBrowserMap.values(), (browserItem) => {
      return {
        ...browserItem.winInfo,
        $pId: browserItem.launchInfo?.pid,
        $proxyInfo: browserItem.beforeLaunchTask.proxyInfo ?? {},
      }
    })
  }

  constructor() {
    queueMicrotask(() => {
      this.#syncWindowStatus()
    })

    watch(this.openedBrowserMap, () => {
      ipcSender.browser.openedBrowserListChange(this.openedBrowserList)
      this.#recordOpenedBrowser()
    })
  }

  /** 如果开启了窗口自动恢复，则自动记录当前已打开的窗口 */
  #recordOpenedBrowser() {
    if (isAppQuitting()) {
      return
    }
    store.waitingRestoreWindow = this.openedBrowserMap.entries().reduce((acc, [dirId, browserItem]) => {
      acc[browserItem.winInfo.workspaceId!] = [...(acc[browserItem.winInfo.workspaceId!] || []), dirId]
      return acc
    }, {} as Record<string, string[]>)
    console.log('recordOpenedBrowser', store.waitingRestoreWindow)

    if (store.waitingRestoreWindowBounds && isPlainObject(store.waitingRestoreWindowBounds)) {
      Object.keys(store.waitingRestoreWindowBounds).forEach((dirId) => {
        if (!this.openedBrowserMap.has(dirId)) {
          Reflect.deleteProperty(store.waitingRestoreWindowBounds!, dirId)
        }
      })
    }

    scheduleRestoreClientNetworkSnapshotUpdate()
  }

  /** 根据 dirId 获取已经打开的浏览器 */
  async getOpenedBrowser(dirId: string) {
    if (this.openingBrowserMap.has(dirId)) {
      await this.openingBrowserMap.get(dirId)!.launchPromise
    }
    // 这里需要延迟到下一次事件循环，因为浏览器启动是异步的
    await setTimeout()
    console.log(`BrowserManager ${dirId} === Getting opened browser`)
    console.log('openedBrowserMap size:', this.openedBrowserMap.size)
    return this.openedBrowserMap.get(dirId)
  }

  /** 启动浏览器 */
  async launch(winInfo: WindowItemType, launchBy?: LaunchBy) {
    const dirId = winInfo.dirId
    console.log(`BrowserManager ${dirId} === Launching browser`)
    if (!dirId) {
      throw new Error('dirId is empty')
    }

    if (this.uploadDataQueue.has(dirId)) {
      console.log(`BrowserManager ${dirId} === Browser data is uploading`)
      await this.uploadDataQueue.get(dirId)
      await setTimeout(50)
      await this.launch(winInfo, launchBy)
      return
    }

    const openedBrowser = this.openedBrowserMap.get(dirId)
    // 如果浏览器已经打开, 则直接返回
    if (openedBrowser) {
      openedBrowser.beforeLaunchTask.sendSuccessMessage($t('浏览器已打开'), 100)
      await openedBrowser.launch()
      return
    }

    // 如果浏览器正在打开中，则等待浏览器启动完成
    if (this.openingBrowserMap.has(dirId)) {
      await this.openingBrowserMap.get(dirId)?.launchPromise
      return this.openedBrowserMap.get(dirId)?.launchInfo
    }
    else {
      const browserItem = new BrowserItem(winInfo, launchBy)
      // 则加入打开中的浏览器集合
      this.openingBrowserMap.set(dirId, {
        browserItem,
        launchPromise: browserItem.launch(),
      })
    }

    try {
      // 等待浏览器启动完成
      await this.openingBrowserMap.get(dirId)?.launchPromise
      const browserItem = this.openingBrowserMap.get(dirId)!.browserItem
      this.openedBrowserMap.set(dirId, browserItem)
      this.#openedWorkspaceIds.add(winInfo.workspaceId!)
      this.syncWindowOpenStatus()

      const onCloseHandler = async (uploadDataPromise?: Promise<{ requestHeaders?: any, uploadParams?: any }>) => {
        console.log(`BrowserManager ${dirId} === Browser disconnected`)
        browserItem.off(`close-${dirId}`, onCloseHandler)
        if (uploadDataPromise) {
          this.uploadDataQueue.set(dirId, uploadDataPromise)
          ipcSender.browser.onCloseSyncingData([dirId])
        }
        this.openedBrowserMap.delete(dirId)

        const sharedWorkspace = store.sharedWorkspaceList?.find(item => item.workspaceId === browserItem.winInfo.workspaceId)
        const isSharedWorkspaceOwner = sharedWorkspace?.role === Role.OWNER
        // 如果是空间拥有者的话，不能删
        if (!isSharedWorkspaceOwner && sharedWorkspace) {
          setTimeout().then(() => {
            rm(join(browserItem.userDataDir, 'Local State'), { force: true })
          })
        }

        // 退出/升级同步由 closeAll 的单次流程统一处理:
        // 此时若每个窗口 disconnect 再各自触发一次 #batchUploadData, debounce 会被多轮并发执行,
        // 导致同一批窗口数据被重复同步、共享进度计数器越界 (例如出现 32/20).
        if (!this.#ensureServerSync) {
          await this.#batchUploadData()

          const { coreVersion } = browserItem.winInfo
          // 如果没有任何浏览器在使用该内核，则尝试解压内核
          coreManager.getCoreManager(browserItem.coreType).tryUpzipCore(coreVersion)
        }

        // 内核关闭后可能进入空闲，尝试应用已就绪的 roxynet 新版本
        // 动态导入避免与 binUpdater 形成静态循环依赖
        import('/@/modules/updater/binUpdater')
          .then(m => m.roxynetBinUpdater.tryApplyPending())
          .catch(() => {})
      }
      // 当 Puppeteer 与浏览器实例断开连接时发出。这可能是因为：浏览器关闭/崩溃或调用Browser.disconnect(), 从已打开的浏览器集合中删除
      browserItem.on(`close-${dirId}`, onCloseHandler)

      return browserItem.launchInfo
    }
    catch (error) {
      console.error(`BrowserManager ${dirId} === Launch failed`, error)
      return Promise.reject(error)
    }
    finally {
      this.openingBrowserMap.delete(dirId)
    }
  }

  /** 通过全局启动池启动浏览器，最多同时启动 5 个 */
  async launchWithLimit(winInfo: WindowItemType, launchBy?: LaunchBy) {
    return batchLaunchLimit(() => this.launch(winInfo, launchBy))
  }

  /** 批量启动浏览器 */
  async batchLaunch(dirIds: string[], options?: {
    workspaceId?: number
    customParams?: any
    customParamsByDirId?: Record<string, any>/** 按 dirId 合并，优先级高于 customParams */
  }) {
    const { workspaceId, customParams, customParamsByDirId } = options ?? {}
    console.log(`BrowserManager === Batch launching browsers`, dirIds)

    // 批量启动可能持续数十秒，基准屏幕只在入口取一次，避免中途鼠标移动导致同批窗口散落在不同显示器
    const windowPositionBase = getCursorDisplayWorkArea()

    const mergeLaunchPayload = (winInfo: WindowItemType) => ({
      ...winInfo,
      windowPositionBase,
      ...customParams,
      ...(winInfo.dirId ? (customParamsByDirId?.[winInfo.dirId] ?? {}) : {}),
    })

    const firstBatch = dirIds.slice(0, 5)
    const remainingIds = dirIds.slice(5)

    const winInfoList = await this.getWindowList(firstBatch, workspaceId).catch(() => [])
    console.log('batchLaunch getWinInfoList', winInfoList.map(item => item.dirId))

    const launchTasks = winInfoList.map(winInfo => this.launchWithLimit(mergeLaunchPayload(winInfo)).catch((error) => {
      console.error(`BrowserManager ${winInfo.dirId} === Launch failed`, error)
    }))

    for (let i = 0; i < remainingIds.length; i += 15) {
      const batchIds = remainingIds.slice(i, i + 15)
      const batchWinInfoList = await this.getWindowList(batchIds, workspaceId).catch(() => [])

      const batchTasks = batchWinInfoList.map(winInfo => this.launchWithLimit(mergeLaunchPayload(winInfo)).catch((error) => {
        console.error(`BrowserManager ${winInfo.dirId} === Launch failed`, error)
      }))

      launchTasks.push(...batchTasks)
      await setTimeout(1500)
    }

    console.debug('launchTasks count', launchTasks.length)
    await Promise.allSettled(launchTasks)
    console.debug('Batch launch completed')
  }

  /** 批量重启浏览器 */
  async batchReLaunch(dirIds: string[]) {
    await this.batchClose(dirIds)
    await this.batchLaunch(dirIds)
  }

  /** 关闭浏览器 */
  private async close(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)
    if (browserItem) {
      return browserItem.close()
    }
  }

  /** 退出/升级路径: 使用更保守的批次/超时/重试策略同步服务端数据 (失败不阻断退出) */
  #ensureServerSync = false
  #quitSyncApiSynced = 0
  #quitSyncApiTotal = 0
  #quitSyncCloseFailed = 0
  /** 加权完成度累加值 (0 ~ #quitSyncTotalWindows), 与总窗口数一起算整体进度 */
  #quitSyncUnits = 0
  #quitSyncTotalWindows = 0

  /** 批量关闭浏览器 */
  batchClose(dirIds: string[]) {
    const ensureServerSync = this.#ensureServerSync
    dirIds.forEach((dirId) => {
      if (this.openedBrowserMap.has(dirId)) {
        const task = this.close(dirId)
        // 退出/升级/登出: 每个窗口「关闭 + OSS 上传」一了结就立刻推进 0.7,
        // 直接挂在原始 task 上(不经过 #batchUploadData 的 debounce 与 allSettled),
        // 保证进度随每个 OSS 完成实时、逐个增长, 而不是等全部完成后一起跳到 70%.
        if (ensureServerSync) {
          task
            .finally(() => {
              this.#quitSyncUnits += QUIT_SYNC_WEIGHT_CLOSE_OSS
              updateQuitSyncProgress(this.#quitSyncUnits, this.#quitSyncTotalWindows)
            })
            .catch(() => {})
        }
        this.uploadDataQueue.set(dirId, task)
      }
    })
    if (this.uploadDataQueue.size > 0) {
      return this.#batchUploadData()
    }
  }

  /**
   * 给单个窗口的 close/同步 task 套一个兜底超时.
   * 超时后以 rejected 返回 (该窗口本轮不再同步), 避免进程僵死时 allSettled 无限挂起.
   */
  #withCloseTimeout<T>(task: Promise<T>, dirId: string): Promise<T> {
    // task 可能在超时之后才 settle, 先吞掉它自身的 rejection, 防止 unhandledRejection.
    task.catch(() => {})
    return Promise.race([
      task,
      setTimeout(SINGLE_WINDOW_CLOSE_TIMEOUT_MS).then(() =>
        Promise.reject(new Error(`window ${dirId} close/sync timed out after ${SINGLE_WINDOW_CLOSE_TIMEOUT_MS}ms`)),
      ),
    ])
  }

  #batchUploadData = asyncDebounce(async () => {
    if (this.uploadDataQueue.size === 0) {
      return Promise.resolve([])
    }

    const dirIds = [...this.uploadDataQueue.keys()]
    const uploadDataQueue = [...this.uploadDataQueue.values()]

    ipcSender.browser.onCloseSyncingData(dirIds)

    // 关闭阶段的进度(每窗口 +0.7)已在 batchClose 中按真实 OSS 完成时机逐个上报, 这里只负责等待所有 task 了结.
    const results = await Promise.allSettled(
      uploadDataQueue.map((task, index) =>
        this.#withCloseTimeout(task, dirIds[index]!).catch((reason) => {
          console.warn(`Quit sync: failed to close window ${dirIds[index]}`, reason)
          throw reason
        }),
      ),
    )
    console.debug('batchClose results', results)

    if (this.#ensureServerSync) {
      this.#quitSyncCloseFailed = results.filter(item => item.status === 'rejected').length
    }

    const uploadParamsObj = Object.groupBy(results, (item) => {
      if (item.status === 'fulfilled' && item.value?.requestHeaders) {
        return JSON.stringify(item.value.requestHeaders)
      }
      return ''
    })

    console.debug('batchClose uploadParamsObj', uploadParamsObj)

    let apiWindowTotal = 0
    const uploadParamsList = Object.entries(uploadParamsObj).flatMap(([key, value]) => {
      if (key && value?.length) {
        const params = value.map(item => item.status === 'fulfilled' && item.value?.uploadParams).filter(Boolean)
        apiWindowTotal += params.length
        return [this.syncWindowData(params, JSON.parse(key), { ensureServerSync: this.#ensureServerSync })]
      }
      return []
    })

    if (this.#ensureServerSync) {
      this.#quitSyncApiSynced = 0
      this.#quitSyncApiTotal = apiWindowTotal
      // 不进入接口同步的窗口(close 失败 / 无数据)没有后续 0.3, 这里一次性补足, 保证进度最终能到 100%
      const nonApiWindows = this.#quitSyncTotalWindows - apiWindowTotal
      if (nonApiWindows > 0) {
        this.#quitSyncUnits += nonApiWindows * QUIT_SYNC_WEIGHT_API
        updateQuitSyncProgress(this.#quitSyncUnits, this.#quitSyncTotalWindows)
      }
    }

    const syncPromise = Promise.allSettled(uploadParamsList)

    return syncPromise.then((syncResults) => {
      // 显式记录被 allSettled 吞掉的 rejection, 避免同步失败时无任何日志
      syncResults.forEach((r) => {
        if (r.status === 'rejected') {
          console.error('syncWindowData group rejected (some windows not synced):', r.reason)
        }
      })
      return syncResults
    }).finally(() => {
      if (this.#ensureServerSync) {
        console.log(
          `Quit sync summary: closed ${dirIds.length - this.#quitSyncCloseFailed}/${dirIds.length}, `
          + `API synced ${this.#quitSyncApiSynced}/${this.#quitSyncApiTotal}`,
        )
        if (this.#quitSyncApiSynced < this.#quitSyncApiTotal || this.#quitSyncCloseFailed > 0) {
          console.warn(
            'Quit sync partial failure:',
            { closeFailed: this.#quitSyncCloseFailed, apiSynced: this.#quitSyncApiSynced, apiTotal: this.#quitSyncApiTotal },
          )
        }
      }
      dirIds.forEach((dirId) => {
        this.uploadDataQueue.delete(dirId)
        this.openedBrowserMap.delete(dirId)
      })
      ipcSender.browser.onClose(dirIds)
    })
  }, 300)

  /** 关闭所有已打开的浏览器 */
  async closeAll(options?: { ensureServerSync?: boolean, syncProgressReason?: QuitSyncProgressMessage['reason'] }) {
    const ensureServerSync = options?.ensureServerSync ?? false
    const cores = this.openedBrowserMap.values().map((n) => {
      return {
        coreType: n.coreType,
        coreVersion: n.winInfo.coreVersion,
      }
    })
    this.#ensureServerSync = ensureServerSync
    const total = this.openedBrowserMap.size
    if (ensureServerSync) {
      this.#quitSyncApiSynced = 0
      this.#quitSyncApiTotal = 0
      this.#quitSyncCloseFailed = 0
      this.#quitSyncUnits = 0
      this.#quitSyncTotalWindows = Math.max(total, 1)
    }
    if (ensureServerSync && total > 0) {
      const reason = options?.syncProgressReason ?? (appUpdater.isQuittingForUpdate ? 'update' : 'quit')
      beginQuitSyncProgress(total, reason)
    }
    try {
      const closeTask = this.batchClose([...this.openedBrowserMap.keys()])
      if (ensureServerSync && total > 0) {
        // 退出/升级/登出兜底超时: 个别窗口 close() 或服务端同步僵死时, 不能无限阻塞退出.
        // 超时后放行退出流程; 底层同步 promise 不取消, 仍会在后台尽量跑完.
        const overallTimeout = Math.min(
          QUIT_SYNC_OVERALL_BASE_MS + total * QUIT_SYNC_OVERALL_PER_WINDOW_MS,
          QUIT_SYNC_OVERALL_MAX_MS,
        )
        // batchClose 内部已用 allSettled, 理论不会 reject; 仍兜底 catch, 防止超时后该 promise 无人处理触发 unhandledRejection.
        Promise.resolve(closeTask).catch(() => {})
        return await Promise.race([
          closeTask,
          setTimeout(overallTimeout).then(() => {
            console.warn(`[closeAll] quit-sync timed out after ${overallTimeout}ms, releasing quit (sync continues in background)`)
            return undefined
          }),
        ])
      }
      return await closeTask
    }
    finally {
      this.#ensureServerSync = false
      // 等所有浏览器都关闭之后，尝试解压内核
      for (const { coreType, coreVersion } of cores) {
        await coreManager.getCoreManager(coreType).tryUpzipCore(coreVersion)
      }
      if (ensureServerSync) {
        finishQuitSyncProgress()
      }
    }
  }

  /** 停止打开后续窗口 */
  async stopOpen() {
    this.openingBrowserMap.clear()
  }

  /** 批量删除窗口 */
  async batchDelete(dirIds: string[]) {
    for (const dirId of dirIds) {
      this.removeLocalData(dirId)
      shortcutStore.remove(dirId)
    }
  }

  /** 删除本地浏览器数据 */
  async removeLocalData(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)

    if (browserItem) {
      await this.close(dirId)
      await this.#batchUploadData()
    }

    try {
      // 删除内核启动时产生的 V8 CachedData 等缓存文件
      const cachePath = join(getCachePath(), app.name, 'browser-cache', dirId)
      console.debug(`[BrowserManager] removeLocalData ${dirId} delete cache path`, cachePath)
      rm(cachePath, { recursive: true, force: true }).catch(() => {})
      // 删除本地浏览器数据目录
      await rm(getUserDataDirPath(dirId), { recursive: true, force: true })
      return { dirId, success: true }
    }
    catch (error) {
      console.error(`BrowserManager ${dirId} === Delete failed`, error)
      return { dirId, success: false }
    }
  }

  /** 清除本地缓存（扩展数据除外） */
  async removeLocalDataExcludeExtension(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)

    if (browserItem) {
      await this.close(dirId)
    }

    const userDataDir = getUserDataDirPath(dirId)

    const files = await readdir(userDataDir)

    const outPromises = files.map(async (file) => {
      if (file === 'Default') {
        const defaultDir = join(userDataDir, file)
        const defaultFiles = await readdir(defaultDir)
        const innerPromises = defaultFiles.map(async (defaultFile) => {
          if (!cacheToClear.includes(defaultFile)) {
            const filterDirPath = join(defaultDir, defaultFile)
            await rm(filterDirPath, { recursive: true })
          }
        })
        await Promise.all(innerPromises)
      }
      else {
        await rm(join(userDataDir, file), { recursive: true })
      }
    })

    await Promise.all(outPromises)
  }

  /** 清除超过指定时间的缓存 */
  async clearCacheByTimestamp({ days, clearType }: { days: number, clearType: 'partial' | 'all' }) {
    const browserCacheRootDir = getUserDataDirPath('')
    const thresholdMs = Number(days) * 24 * 60 * 60 * 1000

    const dirents = await readdir(browserCacheRootDir, { withFileTypes: true })

    const dirIds = (await Promise.all(
      dirents
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'RoxyExtensions')
        .map(async (dirent) => {
          const dirId = dirent.name
          if (this.openedBrowserMap.has(dirId) || this.openingBrowserMap.has(dirId))
            return null

          const profileDir = join(browserCacheRootDir, dirId)
          const targetFile = join(profileDir, 'close_timestamp')

          let lastUsedTime: number
          try {
            const content = await readFile(targetFile, 'utf-8')
            lastUsedTime = Number(content.trim().split('_')[0])
          }
          catch (error: any) {
            if (error?.code !== 'ENOENT') {
              console.warn('[BrowserManager] read close_timestamp failed:', { dirId, error })
              return null
            }
            try {
              lastUsedTime = (await stat(profileDir)).mtimeMs
            }
            catch {
              return null
            }
          }

          if (!Number.isFinite(lastUsedTime))
            return null

          return Date.now() - lastUsedTime > thresholdMs ? dirId : null
        }),
    )).filter((dirId): dirId is string => dirId != null)

    console.log('[BrowserManager] clearCacheByTimestamp', { days, clearType, count: dirIds.length })
    return Promise.allSettled(dirIds.map(dirId => clearType === 'all' ? this.removeLocalData(dirId) : this.removeLocalDataExcludeExtension(dirId)))
  }

  /** 自动清除超过指定时间的缓存 */
  autoClearByTimestamp() {
    if (!store.autoClearCache)
      return
    this.clearCacheByTimestamp({ days: store.clearCachePeriod, clearType: store.clearCacheType })
  }

  /** 获取窗口列表 */
  private async getWindowList(dirIds: string[], workspaceId?: number) {
    const commonParams = { page_index: 1, page_size: 500, isDelete: 0, sourceType: 'open' }
    const winInfoList = await API.window.userGetWindowInfoV2List({ ...commonParams, dirIds: dirIds.join(',') }, {
      headers: { workspaceId },
      timeout: 20 * 1000,
    })
      .then((res) => {
        // 达到窗口打开次数限制
        if (res.code === 417) {
          ipcSender.browser.windowOpenLimit(res)
        }
        if (res.code !== 0) {
          throw new Error(res.msg)
        }
        dirIds.forEach((dirId) => {
          if (!res.data.rows.some(item => item.dirId === dirId)) {
            sendErrorMessage($t('窗口/数据不存在，请刷新页面后重试'), dirId)
          }
        })

        return res.data.rows.reduce((acc, item) => {
          if (!item.buyProxyStatus || item.buyProxyStatus === 0) {
            acc.push(item)
          }
          else {
            const errorMessage = OpenErrorMessageMap[item.buyProxyStatus]
            sendErrorMessage(errorMessage, item.dirId!)
          }
          return acc
        }, [] as UnwrapRowsType<UserGetWindowInfoV2ListData>)
          .sort((a, b) => (a.windowSortNum ?? 0) - (b.windowSortNum ?? 0))
      })
      .catch((error) => {
        console.error(`BrowserManager === Failed to get window info`, dirIds, error)
        dirIds.forEach((dirId) => {
          sendErrorMessage($t('获取窗口信息失败'), dirId, error)
        })
        return Promise.reject(error)
      })
    return winInfoList
  }

  /** 同步窗口数据; 退出/升级场景使用更小批次、更长超时与重试 (失败仅记录, 不阻断退出) */
  async syncWindowData(
    uploadParams: Record<string, any>[],
    headers: any,
    options: { ensureServerSync?: boolean } = {},
  ) {
    const ensureServerSync = options.ensureServerSync ?? this.#ensureServerSync
    const batchSize = ensureServerSync ? QUIT_SYNC_BATCH_SIZE : 10
    const timeout = ensureServerSync ? QUIT_SYNC_TIMEOUT_MS : 15_000
    const maxRetries = ensureServerSync ? QUIT_SYNC_MAX_RETRIES : 1

    console.debug('syncWindowData uploadParams', uploadParams)
    console.debug('syncWindowData headers', headers)
    console.debug('syncWindowData ensureServerSync', ensureServerSync, { batchSize, timeout, maxRetries })

    const batches: Record<string, any>[][] = []
    for (let i = 0; i < uploadParams.length; i += batchSize) {
      batches.push(uploadParams.slice(i, i + batchSize))
    }
    console.debug('syncWindowData batches', batches.length)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!
      console.debug('syncWindowData batch', batch.map(item => item.id))
      const syncedCount = await this.#syncWindowDataBatch(batch, headers, { timeout, maxRetries })
      if (ensureServerSync) {
        // syncedCount 仅用于日志汇总(成功数); 进度按「已了结窗口数」推进(无论成功/失败), 避免接口失败时进度卡住
        this.#quitSyncApiSynced += syncedCount
        this.#quitSyncUnits += batch.length * QUIT_SYNC_WEIGHT_API
        // 进度上报失败不能中断后续批次同步
        try {
          updateQuitSyncProgress(this.#quitSyncUnits, this.#quitSyncTotalWindows)
        }
        catch (error) {
          console.warn('syncWindowData progress update failed (ignored):', error)
        }
      }
    }
  }

  async #syncWindowDataBatch(
    batch: Record<string, any>[],
    headers: any,
    options: { timeout: number, maxRetries: number },
  ): Promise<number> {
    const windowIds = batch.map(item => item.id).filter(Boolean)
    let lastError: unknown
    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        const res = await API.window.userMdfWindowSyncV2Create(batch, {
          headers,
          timeout: options.timeout,
        })
        if (res?.code !== 0) {
          throw new Error(`user_mdf_window_sync_v2 failed: code=${res?.code}, msg=${res?.msg}`)
        }
        console.log('user_mdf_window_sync_v2 uploadData', res)
        return batch.length
      }
      catch (error) {
        lastError = error
        console.error(
          `user_mdf_window_sync_v2 uploadData error (attempt ${attempt}/${options.maxRetries}, windows: ${windowIds.join(',')}):`,
          error,
        )
        if (attempt < options.maxRetries) {
          await setTimeout(2000 * attempt)
        }
      }
    }

    if (lastError) {
      console.warn(
        `user_mdf_window_sync_v2 uploadData failed after retries (windows: ${windowIds.join(',')}), continuing quit:`,
        lastError,
      )
    }
    return 0
  }

  /** 每隔 5分钟 定时同步窗口状态 */
  async #syncWindowStatus() {
    setInterval(this.reportWindowOpenStatus, 1000 * 60 * 5)
    this.reportWindowOpenStatus()
  }

  /** 上报窗口打开状态 */
  reportWindowOpenStatus = () => {
    const groupByWorkspaceId = Object.groupBy([...this.openedBrowserMap.values()], item => item.winInfo.workspaceId!)
    // 没有打开任何窗口，也做同步。只是参数ids为 空数组。
    this.#needSyncWindowOpenStatusWorkspaceIds.forEach((wId) => {
      if (!groupByWorkspaceId[wId]) {
        groupByWorkspaceId[wId] = []
      }
    })

    // 确保每次都能定时上报
    if (store.workspaceId && !groupByWorkspaceId[store.workspaceId]) {
      groupByWorkspaceId[store.workspaceId] = []
    }

    Object.entries(groupByWorkspaceId).forEach(([workspaceId, browserItems]) => {
      const ids = browserItems!.map(item => item.winInfo.id!)
      API.window.userModifyWindowReportTimeCreate({ ids }, { headers: { workspaceId } }).then(() => {
        console.log(`Scheduled sync window status`, ids)
      }).catch((e) => {
        console.error(`Window ids:`, ids)
        console.error(`Scheduled sync window status failed`, e)
      })
    })
  }

  /** 同步窗口打开状态 */
  syncWindowOpenStatus = debounce(async () => {
    const browserItems = [...this.openedBrowserMap.values()]
    const needSyncItems = browserItems.filter(item => !item.isSyncedWindowOpenStatus)
    const groupByWorkspaceId = Object.groupBy(needSyncItems, item => item.winInfo.workspaceId!)

    Object.entries(groupByWorkspaceId).forEach(([workspaceId, browserItems]) => {
      const params = browserItems!.map(item => ({ id: item.winInfo.id, openStatus: true }))
      API.window.userMdfWindowSyncV2Create(params, { headers: { workspaceId } }).then(() => {
        console.log(`Sync window open status on launch`, params)
        browserItems?.forEach((item) => {
          item.isSyncedWindowOpenStatus = true
        })
      })
    })
  }, 1000 * 3)
}
