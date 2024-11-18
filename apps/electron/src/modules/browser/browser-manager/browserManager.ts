import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { API } from '/@/api'
import { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
import { cacheToClear } from '/@/modules/browser/browser-manager/constants'
import { getUserDataDirPath } from '/@/modules/browser/browser-manager/utils'
import { ipcMain } from '/@/modules/ipc'

export class BrowserManager {
  /** 正在打开中的浏览器集合 */
  private openingBrowserMap = new Map<string, Promise<void>>()
  /** 已经打开的浏览器集合 */
  openedBrowserMap = new Map<string, BrowserItem>()

  constructor() {
    this.#syncWindowStatus()
  }

  /** 根据 dirId 获取已经打开的浏览器 */
  async getOpenedBrowser(dirId: string) {
    if (this.openingBrowserMap.has(dirId)) {
      await this.openingBrowserMap.get(dirId)
    }
    // 这里需要延迟到下一次事件循环，因为浏览器启动是异步的
    await setTimeout()
    console.log(`BrowserManager ${dirId} === 获取已打开的浏览器`)
    console.log(this.openedBrowserMap.size)
    return this.openedBrowserMap.get(dirId)
  }

  /** 启动浏览器 */
  async launch(winInfo: WindowItemType) {
    const dirId = winInfo.dirId
    if (!dirId) {
      throw new Error('dirId 不能为空')
    }

    const openedBrowser = this.openedBrowserMap.get(dirId)
    // 如果浏览器已经打开, 则直接返回
    if (openedBrowser) {
      openedBrowser.beforeLaunchTask.sendSuccessMessage($t('浏览器已打开'), 100)
      await openedBrowser.launch()
      return
    }

    const browserItem = new BrowserItem(winInfo)
    // 如果浏览器没有打开
    if (!this.openingBrowserMap.has(dirId)) {
      // 则加入打开中的浏览器集合
      this.openingBrowserMap.set(dirId, browserItem.launch())
    }
    // 等待浏览器启动完成
    await this.openingBrowserMap.get(dirId)!.finally(() => {
      this.openingBrowserMap.delete(dirId)
    })
    this.openedBrowserMap.set(dirId, browserItem)
    // 当 Puppeteer 与浏览器实例断开连接时发出。这可能是因为：浏览器关闭/崩溃或调用Browser.disconnect(), 从已打开的浏览器集合中删除
    browserItem.on(`close-${dirId}`, async () => {
      console.log(`BrowserManager ${dirId} === 浏览器已断开连接`)
      this.openedBrowserMap.delete(dirId)
      ipcMain.send('browser:on-close', dirId)
      await setTimeout(100)
      // 因为无法保证浏览器是否真的关闭，所以这里需要尝试重新连接
      const canConnect = await browserItem.beforeLaunchTask?.reconnectBrowser()
      // 如果可以连接，则重新加入已打开的浏览器集合
      if (canConnect) {
        this.openedBrowserMap.set(dirId, browserItem)
        this.launch(winInfo)
      }
      else {
        browserItem.off(dirId)
      }
    })

    return browserItem.launchInfo
  }

  /** 批量启动浏览器 */
  async batchLaunch(dirIds: string[]) {
    const isNeedBatchReq = dirIds.length > 8
    const firstBatch = isNeedBatchReq ? dirIds.slice(0, 5) : dirIds
    const secondBatch = isNeedBatchReq ? dirIds.slice(5) : []

    const commonParams = { page_index: 1, page_size: 500, isDelete: 0 }
    const winInfoList = await API.window.userGetWindowInfoV2List({ ...commonParams, dirIds: firstBatch.join(',') }).then(res => res.data.rows)
    const secondPromise = secondBatch.length ? API.window.userGetWindowInfoV2List({ ...commonParams, dirIds: secondBatch.join(',') }).then(res => res.data.rows) : []

    for (const winInfo of winInfoList) {
      await this.launch(winInfo).catch((error) => {
        console.error(`BrowserManager ${winInfo.dirId} === 启动失败`, error)
      })
    }

    for (const winInfo of await secondPromise) {
      await this.launch(winInfo).catch((error) => {
        console.error(`BrowserManager ${winInfo.dirId} === 启动失败`, error)
      })
    }
  }

  /** 批量重启浏览器 */
  async batchReLaunch(dirIds: string[]) {
    await this.batchClose(dirIds)
    await this.batchLaunch(dirIds)
  }

  /** 关闭浏览器 */
  async close(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)
    if (browserItem) {
      await browserItem.close().finally(() => {
        this.openedBrowserMap.delete(dirId)
      })
    }
  }

  /** 批量关闭浏览器 */
  async batchClose(dirIds: string[]) {
    const closePromises = dirIds.map(dirId => this.close(dirId))
    return Promise.allSettled(closePromises)
  }

  /** 关闭所有已打开的浏览器 */
  async closeAll() {
    const closePromises = [...this.openedBrowserMap.keys()].map(dirId => this.close(dirId))
    return Promise.allSettled(closePromises)
  }

  /** 停止打开后续窗口 */
  async stopOpen() {
    this.openingBrowserMap.clear()
  }

  /** 批量删除窗口 */
  async batchDelete(dirIds: string[]) {
    for (const dirId of dirIds) {
      this.removeLocalData(dirId)
    }
  }

  /** 删除本地浏览器数据 */
  async removeLocalData(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)

    if (browserItem) {
      await this.close(dirId)
    }

    try {
      // 删除本地浏览器数据目录
      await rm(getUserDataDirPath(dirId), { recursive: true, force: true })
      return { dirId, success: true }
    }
    catch (error) {
      console.error(`BrowserManager ${dirId} === 删除失败`, error)
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

  /** 每隔 5分钟 定时同步窗口状态 */
  async #syncWindowStatus() {
    setInterval(() => {
      const ids = [...this.openedBrowserMap.values()].map(item => item.winInfo.id!)
      API.window.userModifyWindowReportTimeCreate({ ids }).then(() => {
        console.log(`定时同步窗口状态`, ids)
      }).catch((e) => {
        console.error(`窗口 ids:`, ids)
        console.error(`定时同步窗口状态失败`, e)
      })
    }, 1000 * 60 * 5)
  }
}
