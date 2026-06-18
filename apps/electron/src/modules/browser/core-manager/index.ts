import type { UnwrapRowsType, UserGetCoreUpgradeCreateData } from '@roxy/backend-api'
import { CoreType } from '/@/modules/browser/browser-manager/adapter'
import { fileExists } from '/@/utils'
import { CoreManagerUtils } from './CoreManagerUtils'

export type ResolveCoreParamsResult
  = | { ok: true, coreType: CoreType, coreVersion: string }
    | { ok: false, error: string }

/** 解析 OpenAPI / 导入等场景传入的内核类型，非法值返回 null */
function parseCoreType(coreType?: string): CoreType | null {
  if (!coreType) {
    return CoreType.Chrome
  }
  const normalized = String(coreType).trim().toLowerCase()
  if (normalized === 'firefox') {
    return CoreType.Firefox
  }
  if (normalized === 'chrome') {
    return CoreType.Chrome
  }
  return null
}

/** 从当前系统可用内核列表中取版本号最大的内核版本 */
function getLatestCoreVersion(availableCoreList: UnwrapRowsType<UserGetCoreUpgradeCreateData>) {
  const [latestCore] = availableCoreList.toSorted((a, b) => Number(b.coreVersion) - Number(a.coreVersion))
  return latestCore?.coreVersion ?? ''
}

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

  async autoDownloadCore() {
    await Promise.all([
      this.chromeCoreManager.autoDownloadCore(),
      this.firefoxCoreManager.autoDownloadCore(),
    ])
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
      this.firefoxCoreManager.fetchAvailableCoreList(),
    ])
  }

  async getCoreList() {
    const result = await Promise.all([
      this.chromeCoreManager.getCoreList(),
      this.firefoxCoreManager.getCoreList(),
    ])
    return result.flat().filter(Boolean)
  }

  async cleanOldCore() {
    await Promise.all([
      this.chromeCoreManager.cleanOldCore(),
      this.firefoxCoreManager.cleanOldCore(),
    ])
  }

  /**
   * 根据用户传入的 coreType / coreVersion 解析并校验内核参数。
   * 校验依据为当前操作系统下 availableCoreList（与客户端内核管理一致）。
   */
  async resolveCoreParams(
    coreType?: string,
    coreVersion?: string,
    options: { fillDefaults?: boolean } = {},
  ): Promise<ResolveCoreParamsResult> {
    const { fillDefaults = false } = options
    const hasCoreType = coreType !== undefined && coreType !== null && String(coreType).trim() !== ''
    const hasCoreVersion = coreVersion !== undefined && coreVersion !== null && String(coreVersion).trim() !== ''

    if (!fillDefaults && !hasCoreType && !hasCoreVersion) {
      return { ok: true, coreType: CoreType.Chrome, coreVersion: '' }
    }

    const parsedCoreType = parseCoreType(hasCoreType ? String(coreType) : undefined)
    if (!parsedCoreType) {
      return { ok: false, error: $t('coreType 仅支持 Chrome 或 Firefox') }
    }

    const coreManagerUtils = this.getCoreManager(parsedCoreType)
    if (!coreManagerUtils.availableCoreList.length) {
      await coreManagerUtils.fetchAvailableCoreList()
    }

    const availableCoreList = coreManagerUtils.availableCoreList
    if (!availableCoreList.length) {
      return { ok: false, error: $t('当前系统暂无可用的 {coreType} 内核', { coreType: parsedCoreType }) }
    }

    if (hasCoreVersion) {
      const normalizedCoreVersion = String(coreVersion).trim()
      const matchedCore = coreManagerUtils.getAvailableCore(normalizedCoreVersion)
      if (!matchedCore?.coreVersion) {
        const availableVersions = availableCoreList
          .map(core => core.coreVersion)
          .filter(Boolean)
          .join('、')
        return {
          ok: false,
          error: $t('当前系统不支持 {coreType} {coreVersion} 内核，可用版本：{versions}', {
            coreType: parsedCoreType,
            coreVersion: normalizedCoreVersion,
            versions: availableVersions,
          }),
        }
      }
      return { ok: true, coreType: parsedCoreType, coreVersion: matchedCore.coreVersion }
    }

    if (!fillDefaults) {
      return { ok: true, coreType: parsedCoreType, coreVersion: '' }
    }

    const latestCoreVersion = getLatestCoreVersion(availableCoreList)
    if (!latestCoreVersion) {
      return { ok: false, error: $t('当前系统暂无可用的 {coreType} 内核', { coreType: parsedCoreType }) }
    }

    return { ok: true, coreType: parsedCoreType, coreVersion: latestCoreVersion }
  }
})()
