import type {
  UnwrapRowsType,
  UserGetCoreUpgradeCreateData,
} from '@roxy/backend-api'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { BrowserType } from '/@/modules/browser/browser-manager/adapter'
import { rm } from 'node:fs/promises'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { isDev } from '/@/constants/common'
import { ipcSender } from '/@/modules/ipc/sender'
import { fileExists } from '/@/utils'
import { CoreManagerUtils } from './CoreManagerUtils'

export const coreManager = new (class CoreManager {
  private chromeCoreManager = new CoreManagerUtils('chrome')
  private firefoxCoreManager = new CoreManagerUtils('firefox')
  /** 上一次的 chrome 内核版本信息 */
  lastChromeCoreVersionList: Record<string, string> = {}
  /** 上一次的 firefox 内核版本信息 */
  lastFirefoxCoreVersionList: Record<string, string> = {}

  /** 拉取内核 promise */
  private fetchAvailableCoreListPromise: Promise<UserGetCoreUpgradeCreateData> | null
    = null

  /** 能够被当前系统使用的内核列表 */
  private availableCoreList: UnwrapRowsType<UserGetCoreUpgradeCreateData> = []

  constructor() {
    setTimeout(() => {
      this.fetchAvailableCoreList().then(async () => {
        // 本地是否存在内核，不存在时静默下载最新内核
        const exeExistsList = await Promise.all(this.availableCoreList.map(async (core) => {
          return fileExists(this.chromeCoreManager.genCoreExePath(core.coreVersion!))
        }))
        const isNotExistsCore = exeExistsList.every(exists => !exists)
        console.log('isNotExistsCore', isNotExistsCore)
        // 如果本地不存在内核，则下载最新内核
        if (isNotExistsCore) {
          const [latestCore] = this.availableCoreList.toSorted((a, b) => Number(b.coreVersion) - Number(a.coreVersion))
          if (latestCore?.coreVersion) {
            this.chromeCoreManager.downloadCore({ coreVersion: latestCore.coreVersion, silent: true }).catch((error) => {
              console.error('download latest core on startup error', error)
            })
          }
        }
      })
    })
  }

  getCoreManager(coreType: BrowserType) {
    if (coreType === 'chrome') {
      return this.chromeCoreManager
    }
    else if (coreType === 'firefox') {
      return this.firefoxCoreManager
    }
    throw new Error(`Unsupported core type: ${coreType}`)
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
          status: await this.getCoreManager(core.coreType).getCoreStatus(core),
        }
      },
    )
    return Promise.all(arr)
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
    this.availableCoreList = result.data?.rows || this.availableCoreList || []
    this.availableCoreList.forEach((n) => {
      n.coreType = 'chrome'
    })

    if (isDev) {
      this.availableCoreList.push({
        coreType: 'firefox',
        coreVersion: '135',
        downloadUrl: 'https://lumibrowser-test.oss-cn-shenzhen.aliyuncs.com/public/package/core/Windows/64/firefox/135/1.0/135.zip',
        releaseTime: '2026-01-28 10:20:38',
        upgradeContent: '',
        upgradeDesc: '',
        upgradeTitle: '',
        version: '1.0',
      })
    }

    if (this.availableCoreList.length) {
      this.availableCoreList.forEach((core) => {
        if (core.coreType === 'chrome') {
          this.lastChromeCoreVersionList[core.coreVersion!] = core.version!
        }
        else if (core.coreType === 'firefox') {
          this.lastFirefoxCoreVersionList[core.coreVersion!] = core.version!
        }
      })

      console.debug('coreManager.lastChromeCoreVersionList', this.lastChromeCoreVersionList)
      console.debug('coreManager.lastFirefoxCoreVersionList', this.lastFirefoxCoreVersionList)
    }

    if (this.availableCoreList.length) {
      ipcSender.app.coreListUpdate(await this.getCoreList())
    }

    this.autoDownloadCore()
    this.getCoreManager('chrome').setAvailableCoreList(this.availableCoreList)
    this.getCoreManager('firefox').setAvailableCoreList(this.availableCoreList)

    return result
  }

  autoDownloadCore() {
    this.getCoreManager('chrome').autoDownloadCore()
    this.getCoreManager('firefox').autoDownloadCore()
  }

  async cleanOldCore() {
    await rm(this.chromeCoreManager.oldCoreDir, { recursive: true, force: true }).catch(() => {})
    await rm(this.firefoxCoreManager.oldCoreDir, { recursive: true, force: true }).catch(() => {})
  }
})()
