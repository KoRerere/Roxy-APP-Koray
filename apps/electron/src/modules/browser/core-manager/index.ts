import { isDev } from '/@/constants/common'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { ipcSender } from '/@/modules/ipc/sender'
import { fileExists } from '/@/utils'
import { CoreManagerUtils } from './CoreManagerUtils'

export const coreManager = new (class CoreManager {
  chromeCoreManager = new CoreManagerUtils(CoreType.Chrome)
  firefoxCoreManager = new CoreManagerUtils(CoreType.Firefox)

  constructor() {
    setTimeout(() => {
      this.fetchAvailableCoreList().then(async () => {
        const availableCoreList = this.chromeCoreManager.availableCoreList
        // 本地是否存在内核，不存在时静默下载最新内核
        const exeExistsList = await Promise.all(availableCoreList.map(async (core) => {
          return fileExists(this.chromeCoreManager.genCoreExePath(core.coreVersion!))
        }))
        const isNotExistsCore = exeExistsList.every(exists => !exists)
        console.log('isNotExistsCore', isNotExistsCore)
        // 如果本地不存在内核，则下载最新内核
        if (isNotExistsCore) {
          const [latestCore] = availableCoreList.toSorted((a, b) => Number(b.coreVersion) - Number(a.coreVersion))
          if (latestCore?.coreVersion) {
            this.chromeCoreManager.downloadCore({ coreVersion: latestCore.coreVersion, silent: true }).catch((error) => {
              console.error('download latest core on startup error', error)
            })
          }
        }
      })
    })
  }

  getCoreManager(coreType: CoreType) {
    if (coreType === CoreType.Firefox) {
      return this.firefoxCoreManager
    }
    return this.chromeCoreManager
  }

  /** 拉取当前系统可用的内核列表 */
  async fetchAvailableCoreList() {
    return Promise.all([
      this.chromeCoreManager.fetchAvailableCoreList(),
      isDev ? this.firefoxCoreManager.fetchAvailableCoreList() : Promise.resolve(),
    ])
  }

  async getCoreList() {
    const result = await Promise.all([
      this.chromeCoreManager.getCoreList(),
      isDev ? this.firefoxCoreManager.getCoreList() : Promise.resolve(),
    ])
    return result.flat().filter(Boolean)
  }

  async cleanOldCore() {
    await Promise.all([
      this.chromeCoreManager.cleanOldCore(),
      this.firefoxCoreManager.cleanOldCore(),
    ])
  }
})()
