import { readFile, rm } from 'node:fs/promises'
import { appConfig } from '/@/constants/appConfig'
import { downloadZipFile, fileExists, isMac, unzipFile } from '/@/utils'
import { dirname, join } from 'node:path'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import type { UserGetCoreUpgradeCreateData } from '@roxy/backend-api'

export const chromeCoreManager = new class ChromeCoreManager {
  /** 内核执行程序文件名称 */
  private chromeBinName = isMac ? 'lumibrowser.app' : 'lumibrowser.exe'

  /** 正在下载中的内核 */
  private downloadingMap = new Map<string, Promise<any>>()

  /** 正在使用中的内核 */
  private usingMap = new Set<string>()

  /** 能够被当前系统使用的内核列表 */
  private availableCoreList: UserGetCoreUpgradeCreateData['data']['rows'] = []

  constructor() {
    this.fetchAvailableCoreList()
    // 定时更新可用内核列表
    setInterval(() => {
      this.fetchAvailableCoreList()
    }, 1000 * 60 * 5)
  }

  /** 根据内核版本获取内核所在目录 */
  private genCoreDir(coreVersion: string) {
    const { chromeBinDir } = appConfig
    return join(chromeBinDir, coreVersion)
  }

  /** 根据内核版本组成内核执行文件路径 */
  private genCoreExePath(coreVersion: string) {
    return join(this.genCoreDir(coreVersion), this.chromeBinName)
  }

  /** 获取指定的可用内核 */
  getAvailableCore(coreVersion: string) {
    return this.availableCoreList.find(core => core.coreVersion === coreVersion)
  }

  /** 更新 `this.localCoreMap` 的值 */
  // async updateLocalCoreMap() {
  //   const { chromeBinDir } = appConfig
  //   const coreVersionKeys = Array.from(this.localCoreMap.keys())
  //   // 读取内核缓存目录下的所有文件
  //   const files = await readdir(chromeBinDir, { withFileTypes: true })
  //   const promises = files.map(async (file) => {
  //     if (file.isDirectory()) {
  //       // 目录名即为内核版本号
  //       const coreVersion = file.name
  //       // 内核目录
  //       const coreDir = join(chromeBinDir, coreVersion)
  //       const exePath = join(coreDir, this.chromeBinName)
  //       try {
  //         const version = await readFile(join(coreDir, 'version'), 'utf-8')
  //         this.localCoreMap.set(coreVersion, { version, exePath })
  //       }
  //       catch (error) {
  //         console.error('updateLocalCoreMap error', error)
  //         this.localCoreMap.delete(coreVersion)
  //       }
  //     }
  //     else {
  //       // 删除内核缓存目录下的非目录文件
  //       rm(join(chromeBinDir, file.name))
  //     }
  //   })

  //   // 过滤掉不存在的内核
  //   coreVersionKeys.forEach((coreVersion) => {
  //     if (!this.localCoreMap.has(coreVersion)) {
  //       this.localCoreMap.delete(coreVersion)
  //     }
  //   })

  //   return Promise.all(promises)
  // }

  /** 拉取当前系统可用的内核列表 */
  async fetchAvailableCoreList() {
    const result = await API.base.userGetCoreUpgradeCreate({ ...osConfig })
    this.availableCoreList = result.data.rows
    return this.availableCoreList
  }

  /** 根据内核版本获取对应的内核执行文件 */
  async getCoreExePath(coreVersion: string) {
    const exePath = this.genCoreExePath(coreVersion)

    // 如果该内核已经在使用中，则直接返回
    if (this.usingMap.has(coreVersion)) {
      return exePath
    }

    const isExists = await fileExists(exePath)

    // 如果本地不存在该内核，则下载
    if (!isExists) {
      // 如果是第一次下载该内核，则将该内核加入下载队列
      if (!this.downloadingMap.has(coreVersion)) {
        this.downloadingMap.set(coreVersion, this.downloadCore(coreVersion))
      }
      // 等待下载完成
      await this.downloadingMap.get(coreVersion)
    }

    const coreDir = dirname(exePath)
    const availableCore = this.getAvailableCore(coreVersion)

    if (!availableCore) {
      throw new Error('当前系统不支持使用该内核')
    }

    try {
      // 本地内核版本
      const localCoreVersion = await readFile(join(coreDir, 'version'), 'utf-8')
      // 如果本地内核版本与远程内核版本不一致
      if (localCoreVersion.trim() !== availableCore.version) {
        // 重新下载
        this.downloadingMap.set(coreVersion, this.downloadCore(coreVersion))
        await this.downloadingMap.get(coreVersion)
      }
    }
    catch (error) {
      console.error('getCoreExePath error', error)
      return Promise.reject(error)
    }

    console.log('getCoreExePath', exePath)

    return exePath
  }

  /** 下载内核 */
  async downloadCore(coreVersion: string) {
    if (this.downloadingMap.has(coreVersion)) {
      return this.downloadingMap.get(coreVersion)
    }

    const availableCore = this.getAvailableCore(coreVersion)

    if (!availableCore) {
      throw new Error('当前系统不支持使用该内核')
    }

    const outputZipPath = join(appConfig.chromeBinDir, `${coreVersion}.zip`)

    try {
      // 下载内核
      await downloadZipFile(availableCore.downloadUrl, outputZipPath)
      // 删除本地内核
      await rm(this.genCoreDir(coreVersion), { recursive: true, force: true })
      // 解压缩内核
      await unzipFile(outputZipPath, appConfig.chromeBinDir)
      // 异步删除下载的 zip 文件，不需要等待
      rm(outputZipPath)
    }
    catch (error) {
      console.error('downloadCore error', error)
      return Promise.reject(error)
    }
    finally {
      this.downloadingMap.delete(coreVersion)
    }
  }
}()
