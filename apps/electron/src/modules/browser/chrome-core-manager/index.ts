import type {
  UnwrapRowsType,
  UnwrapRowType,
  UserGetCoreUpgradeCreateData,
} from '@roxy/backend-api'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { compare } from 'compare-versions'
import { readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { appConfig } from '/@/constants/appConfig'
import { isDev, isMac, isWindows } from '/@/constants/common'
import { browserManager } from '/@/modules/browser/browser-manager'
import { ipcSender } from '/@/modules/ipc/sender'
import { store } from '/@/modules/store'
import { downloadZipFile, fileExists, findProcessByHandle, unzipFile } from '/@/utils'

export const chromeCoreManager = new (class ChromeCoreManager {
  pendingCoreDir = join(appConfig.chromeBinDir, 'pending')
  oldCoreDir = join(appConfig.chromeBinDir, 'old')
  /** 上一次的内核版本信息 */
  lastCoreVersionList: Record<string, string> = {}

  /** 拉取内核 promise */
  private fetchAvailableCoreListPromise: Promise<UserGetCoreUpgradeCreateData> | null
    = null

  /** 内核执行程序文件名称 */
  private chromeBinName = isMac
    ? 'RoxyChrome.app/Contents/MacOS/RoxyChrome'
    : `RoxyChrome${isWindows ? '.exe' : ''}`

  /** 是否有内核正在解压中 */
  private unzippingPromiser: PromiseWithResolvers<void> | null = null
  /** 等待解压的内核 */
  pendingUnzipCoreMap = new Map<string, () => Promise<any>>()
  /** 正在下载中的内核 */
  private downloadingMap = new Map<string, Promise<any>>()
  /** msgCallback task map */
  private msgCallbackTaskMap = new Map<string, ((payload: Partial<ResourceUpdateMessage>) => void)[]>()
  /** 正在使用中的内核 */
  get usingCores() {
    const cores = [...browserManager.openedBrowserMap.values()].map(
      browserItem => browserItem.winInfo.coreVersion,
    )
    return new Set(cores)
  }

  /** 能够被当前系统使用的内核列表 */
  private availableCoreList: UnwrapRowsType<UserGetCoreUpgradeCreateData> = []

  constructor() {
    queueMicrotask(() => {
      this.fetchAvailableCoreList().then(async () => {
        // 本地是否存在内核，不存在时静默下载最新内核
        const exeExistsList = await Promise.all(this.availableCoreList.map(async (core) => {
          return fileExists(this.genCoreExePath(core.coreVersion!))
        }))
        const isNotExistsCore = exeExistsList.every(exists => !exists)
        console.log('isNotExistsCore', isNotExistsCore)
        // 如果本地不存在内核，则下载最新内核
        if (isNotExistsCore) {
          const [latestCore] = this.availableCoreList.toSorted((a, b) => b.coreVersion - a.coreVersion)
          if (latestCore?.coreVersion) {
            this.downloadCore({ coreVersion: latestCore.coreVersion, silent: true })
          }
        }
      })
    })

    if (isDev) {
      setInterval(() => {
        this.autoDownloadCore()
      }, 5 * 60 * 1000)
    }
  }

  /** 获取内核列表（供前端展示用） */
  async getCoreList(): Promise<ResourceUpdateMessage[]> {
    if (!this.availableCoreList.length) {
      await this.fetchAvailableCoreList()
    }
    const arr = this.availableCoreList.map(
      async (core): Promise<ResourceUpdateMessage> => {
        return {
          ...core,
          type: 'kernel',
          version: core.version,
          coreVersion: core.coreVersion,
          status: await this.getCoreStatus(core),
        }
      },
    )
    return Promise.all(arr)
  }

  private async getCoreStatus(core: UnwrapRowType<UserGetCoreUpgradeCreateData>) {
    const isExists = await fileExists(this.genCoreDir(core.coreVersion!))
    if (!isExists)
      return 'uninstalled'

    return this.checkCoreVersion(core)
  }

  private async checkCoreVersion(core: UnwrapRowType<UserGetCoreUpgradeCreateData>) {
    try {
      const coreDir = this.genCoreDir(core.coreVersion!)
      const localCoreVersion = await readFile(join(coreDir, 'version'), 'utf-8').catch(() => '0.0.0')
      const isPendingUnzip = await this.checkCoreIsPendingUnzip(core)

      // 如果等待解压的内核存在，并且版本大于等于远程版本，则返回下载完成
      if (isPendingUnzip) {
        return 'downloaded'
      }

      // 如果本地内核版本小于远程版本，则返回需要更新
      if (compare(localCoreVersion.trim(), core.version!, '<')) {
        return 'update'
      }
      // 如果本地内核版本大于等于远程版本，则返回下载完成
      return 'downloaded'
    }
    catch (error) {
      console.error('getCoreExePath error', error)
      return 'uninstalled'
    }
  }

  /** 检查内核是否在等待解压 */
  private async checkCoreIsPendingUnzip(core: UnwrapRowType<UserGetCoreUpgradeCreateData>) {
    const pendingCoreVersion = await readFile(join(this.genPendingCoreDir(core.coreVersion!), 'version'), 'utf-8').catch(() => '0.0.0')
    const pendingExeExists = await fileExists(join(this.genPendingCoreDir(core.coreVersion!), this.chromeBinName))
    // 如果等待解压的内核存在，并且版本大于等于远程版本，则返回下载完成
    return pendingExeExists && compare(pendingCoreVersion.trim(), core.version!, '>=')
  }

  /** 根据内核版本获取内核所在目录 */
  private genCoreDir(coreVersion: string) {
    const { chromeBinDir } = appConfig
    return join(chromeBinDir, coreVersion)
  }

  private genPendingCoreDir(coreVersion?: string) {
    return join(this.pendingCoreDir, coreVersion ?? '')
  }

  private genOldCoreDir(coreVersion?: string) {
    return join(this.oldCoreDir, coreVersion ?? '')
  }

  /** 根据内核版本组成内核执行文件路径 */
  private genCoreExePath(coreVersion: string) {
    return join(this.genCoreDir(coreVersion), this.chromeBinName)
  }

  /** 根据内核版本获取内核驱动文件路径 */
  genCoreDriverPath(coreVersion: string) {
    return join(
      this.genCoreDir(coreVersion),
      isWindows ? 'chromedriver.exe' : 'chromedriver',
    )
  }

  /** 获取指定的可用内核 */
  getAvailableCore(coreVersion: string) {
    return this.availableCoreList.find(
      core => core.coreVersion === coreVersion,
    )
  }

  /** 拉取当前系统可用的内核列表 */
  async fetchAvailableCoreList() {
    console.log('fetchAvailableCoreList', osConfig)
    this.fetchAvailableCoreListPromise ||= API.base.getCoreUpgradeCreate({
      ...osConfig,
    })
    const result = await this.fetchAvailableCoreListPromise
      .catch((err) => {
        console.error('fetchAvailableCoreList error', err)
        return Promise.reject(err)
      })
      .finally(() => {
        this.fetchAvailableCoreListPromise = null
      })
    console.debug('user_get_core_upgrade', result.data)
    this.availableCoreList = result.data?.rows || []

    if (this.availableCoreList.length) {
      this.lastCoreVersionList = result.data?.rows?.reduce((acc, core) => {
        acc[core.coreVersion!] = core.version!
        return acc
      }, {} as Record<string, string>) || {}
      console.debug('chromeCoreManager.lastCoreVersionList', this.lastCoreVersionList)
    }

    if (this.availableCoreList.length) {
      ipcSender.app.coreListUpdate(await this.getCoreList())
    }

    this.autoDownloadCore()

    return result
  }

  /** 自动静默下载内核 */
  async autoDownloadCore() {
    if (!store.autoUpdateKernel) {
      return
    }

    for (const core of this.availableCoreList) {
      if (core.coreVersion) {
        const isPendingUnzip = await this.checkCoreIsPendingUnzip(core)
        if (isPendingUnzip) {
          // 如果内核不在使用中，则立即执行解压任务
          if (!this.usingCores.has(core.coreVersion)) {
            await this.unzipToCoreDirTask(core.coreVersion)
          }
          continue
        }
        const status = await this.getCoreStatus(core)
        if (status !== 'update') {
          continue
        }
        await this.downloadCore({ coreVersion: core.coreVersion, silent: true, unzipAfterDownload: false })
      }
    }
  }

  /** 根据内核版本获取对应的内核执行文件 */
  async getCoreExePath(
    coreVersion: string,
    msgCallback?: (payload: Partial<ResourceUpdateMessage>) => void,
    silent = false,
  ) {
    if (!this.availableCoreList.length) {
      await this.fetchAvailableCoreList().catch((error) => {
        msgCallback?.({ description: $t('获取内核列表失败') })
        return Promise.reject(error)
      })
    }

    const availableCore = this.getAvailableCore(coreVersion)

    if (!availableCore) {
      throw new Error($t('当前系统不支持使用{version}内核', { version: coreVersion }))
    }

    const exePath = this.genCoreExePath(coreVersion)

    // 如果该内核已经在使用中，则直接返回
    if (this.usingCores.has(coreVersion)) {
      return exePath
    }

    // 如果该内核正在等待解压，则先执行解压任务
    await this.pendingUnzipCoreMap.get(coreVersion)?.()?.catch?.(() => {})

    const coreDir = this.genCoreDir(coreVersion)
    const isExeExists = await fileExists(exePath)
    const isVersionFileExists = await fileExists(join(coreDir, 'version'))

    // 如果本地不存在该内核或版本文件不存在，则下载
    if (!isExeExists || !isVersionFileExists) {
      // 等待下载完成
      await this.downloadCore({ coreVersion, msgCallback, silent })
    }

    const status = await this.checkCoreVersion(availableCore)
    if (status === 'update') {
      ipcSender.app.resourceUpdate({
        ...availableCore,
        type: 'kernel',
        version: availableCore.version,
        coreVersion: availableCore.coreVersion,
        status: 'update',
      })

      if (store.autoUpdateKernel && availableCore.coreVersion) {
        this.downloadCore({ coreVersion: availableCore.coreVersion, silent: true, unzipAfterDownload: false })
      }
    }

    console.log('getCoreExePath', exePath)

    return exePath
  }

  /** 将解压后的内核移动到内核目录 */
  private unzipToCoreDirTask = async (coreVersion: string) => {
    await fileExists(this.pendingCoreDir, true)
    await fileExists(this.oldCoreDir, true)
    console.log('unzipToCoreDirTask start', coreVersion)
    // 将本地内核移动到旧内核目录
    await rename(this.genCoreDir(coreVersion), this.genOldCoreDir(coreVersion)).catch((error) => {
      console.error('rename to oldCoreDir error', error)
    })
    // 将解压后的内核移动到内核目录
    await rename(this.genPendingCoreDir(coreVersion), this.genCoreDir(coreVersion)).catch((error) => {
      console.error('rename pendingCoreDir to coreDir error', error)
    })
    // 删除旧内核目录
    await rm(this.genOldCoreDir(coreVersion), { recursive: true, force: true }).catch((error) => {
      console.error('rm oldCoreDir error', error)
    })
    this.pendingUnzipCoreMap.delete(coreVersion)
  }

  /** 下载内核 */
  async downloadCore(options: {
    coreVersion: string
    msgCallback?: (payload: Partial<ResourceUpdateMessage>) => void
    silent?: boolean
    unzipAfterDownload?: boolean
  }) {
    const { coreVersion, msgCallback, silent, unzipAfterDownload = true } = options
    if (this.downloadingMap.has(coreVersion)) {
      if (msgCallback) {
        if (this.msgCallbackTaskMap.has(coreVersion)) {
          this.msgCallbackTaskMap.get(coreVersion)?.push(msgCallback)
        }
        else {
          this.msgCallbackTaskMap.set(coreVersion, [msgCallback])
        }
      }
      const promise = this.downloadingMap.get(coreVersion)
      promise && Reflect.set(promise, 'silent', silent)
      return promise
    }

    const availableCore = this.getAvailableCore(coreVersion)

    if (!availableCore) {
      throw new Error($t('当前系统不支持使用{version}内核', { version: coreVersion }))
    }

    const outputZipPath = join(appConfig.chromeBinDir, `${coreVersion}.zip`)
    // getter 里的 this，永远指向“访问这个属性的对象”
    const that = this
    const payload: ResourceUpdateMessage = {
      type: 'kernel',
      status: 'downloading',
      percent: 0,
      description: $t('正在下载 {coreVersion} 内核', { coreVersion }),
      version: availableCore.version,
      coreVersion,
      get silent() {
        return Reflect.get(that.downloadingMap.get(coreVersion) || {}, 'silent') ?? silent
      },
    }

    const doMsgCallbacks = () => {
      ipcSender.app.resourceUpdate(payload)
      msgCallback?.(payload)
      if (this.msgCallbackTaskMap.has(coreVersion)) {
        this.msgCallbackTaskMap.get(coreVersion)?.forEach((callback) => {
          callback(payload)
        })
      }
    }

    const unzipToPendingCoreDirTask = async () => {
      console.log('unzipToPendingCoreDirTask start', coreVersion)
      // 如果已经有内核在解压，等待解压完成后再执行解压任务
      if (this.unzippingPromiser) {
        await this.unzippingPromiser.promise
        return unzipToPendingCoreDirTask()
      }

      this.unzippingPromiser = Promise.withResolvers<void>()

      const timer = setTimeout(() => {
        this.unzippingPromiser?.resolve()
        this.unzippingPromiser = null
      }, 15 * 1000)

      try {
        await fileExists(this.pendingCoreDir, true)
        await fileExists(this.oldCoreDir, true)
        payload.description = $t('正在解压内核')
        doMsgCallbacks()
        // 解压缩内核
        await unzipFile(outputZipPath, this.genPendingCoreDir())
        // 如果内核不在使用中，则立即执行解压任务
        if (!this.usingCores.has(coreVersion)) {
          await this.unzipToCoreDirTask(coreVersion)
        }
        else {
          this.pendingUnzipCoreMap.set(coreVersion, () => this.unzipToCoreDirTask(coreVersion))
        }
        payload.description = $t('内核解压完成')
        payload.percent = 100
        doMsgCallbacks()
        // 异步删除下载的 zip 文件，不需要等待
        rm(outputZipPath)
      }
      catch (error) {
        console.error('unzipTask error', error)
        return Promise.reject(error)
      }
      finally {
        clearTimeout(timer)
        this.unzippingPromiser?.resolve()
        this.unzippingPromiser = null
      }
    }

    const downloadTask = async () => {
      try {
        console.log('downloadCore start', coreVersion)
        // 下载内核
        await downloadZipFile(
          availableCore.downloadUrl!,
          outputZipPath,
          (progress) => {
            // console.log(`Download progress: ${progress}%`)
            payload.percent = Math.min(progress, 99)
            payload.status = 'downloading'
            payload.description = $t('正在下载内核')
            doMsgCallbacks()
          },
        ).catch((error) => {
          console.error('downloadCore downloadZipFile error', error)
          payload.status = 'failed'
          payload.description = $t('下载内核失败')
          doMsgCallbacks()
          return Promise.reject(new Error(payload.description))
        })
        await unzipToPendingCoreDirTask()
        payload.status = 'downloaded'
        payload.description = $t('内核下载完成')
        doMsgCallbacks()
      }
      catch (error: any) {
        console.dir(error, { depth: null })
        console.error('downloadCore error', error)
        if (error?.code === 'EBUSY') {
          // const processIds = await getProcessIdsByExePath(this.genCoreDir(coreVersion));
          const processIds = await findProcessByHandle(this.genCoreDir(coreVersion))
          console.log('findProcessByHandle', processIds)
          if (processIds) {
            try {
              processIds.forEach(({ pid }) => {
                process.kill(pid)
              })
            }
            catch (error) {
              console.error('killProcess error', error)
            }

            if (payload.status === 'downloaded' && await fileExists(outputZipPath)) {
              await setTimeoutPromise(3000)
              try {
                console.log('unzipTask start')
                await this.unzipToCoreDirTask(coreVersion)
                console.log('unzipTask end')
                return
              }
              catch (error) {
                console.error('unzipTask error', error)
                return Promise.reject(error)
              }
            }
          }
        }
        else if (error?.code === 'ENOENT' || error?.message?.includes('no such file or directory')) {
          payload.status = 'failed'
          payload.description = $t('内核解压异常，请检查是否被其他程序错误拦截')
          doMsgCallbacks()
          error.message = $t('内核解压异常，请检查是否被其他程序错误拦截')
          rm(this.genCoreDir(coreVersion), {
            recursive: true,
            force: true,
          })
        }
        else {
          payload.status = 'failed'
          payload.description = $t('获取内核失败，{tech}', { tech: '{tech}' })
          doMsgCallbacks()
        }
        return Promise.reject(error)
      }
      finally {
        // 无论成功与否，记得将其从下载队列中移除
        this.downloadingMap.delete(coreVersion)
        this.msgCallbackTaskMap.delete(coreVersion)
      }
    }

    this.downloadingMap.set(coreVersion, downloadTask())
    return this.downloadingMap.get(coreVersion)
  }

  /** 删除指定内核 */
  async deleteCore(coreVersion: string) {
    if (this.usingCores.has(coreVersion)) {
      return Promise.reject($t('当前内核正在使用中，无法删除'))
    }
    await rm(this.genCoreDir(coreVersion), { recursive: true, force: true })
  }
})()
