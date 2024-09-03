import { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
import { sendSuccessMessage } from '/@/modules/browser/browser-manager/message'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { ipcMain } from '/@/modules/ipc'

export class BrowserManager {
  /** 正在打开中的浏览器集合 */
  private openingBrowserMap = new Map<string, Promise<void>>()
  /** 已经打开的浏览器集合 */
  openedBrowserMap = new Map<string, BrowserItem>()

  /** 根据 dirId 获取已经打开的浏览器 */
  async getOpenedBrowser(dirId: string) {
    const { promise, resolve } = Promise.withResolvers<BrowserItem>()
    if (this.openingBrowserMap.has(dirId)) {
      await this.openingBrowserMap.get(dirId)
    }
    // 这里需要延迟到下一次事件循环，因为浏览器启动是异步的
    setTimeout(() => resolve(this.openedBrowserMap.get(dirId)!))
    return promise
  }

  /** 启动浏览器 */
  async launch(winInfo: WindowItemType) {
    const openedBrowser = this.openedBrowserMap.get(winInfo.dirId!)
    // 如果浏览器已经打开, 则直接返回
    if (openedBrowser) {
      sendSuccessMessage({
        dirId: openedBrowser.winInfo.dirId!,
        percent: 100,
        message: '浏览器已打开',
      })
      await openedBrowser.launch()
      return
    }

    const browserItem = new BrowserItem(winInfo)
    // 如果浏览器没有打开
    if (!this.openingBrowserMap.has(winInfo.dirId!)) {
      // 则加入打开中的浏览器集合
      this.openingBrowserMap.set(winInfo.dirId!, browserItem.launch())
    }
    // 等待浏览器启动完成
    await this.openingBrowserMap.get(winInfo.dirId!)!.finally(() => {
      this.openingBrowserMap.delete(winInfo.dirId!)
    })
    this.openedBrowserMap.set(winInfo.dirId!, browserItem)
    // 监听浏览器关闭事件, 从已打开的浏览器集合中删除
    browserItem.getBrowser()?.on('disconnected', () => {
      console.log(`BrowserManager ${winInfo.dirId} === 浏览器已关闭`)
      this.openedBrowserMap.delete(winInfo.dirId!)
      ipcMain.send('browser:on-close', winInfo.dirId!)
    })
  }

  /** 批量启动浏览器 */
  async batchLaunch(winInfoList: WindowItemType[]) {
    for (const winInfo of winInfoList) {
      await this.launch(winInfo).catch((error) => {
        console.error(`BrowserManager ${winInfo.dirId} === 启动失败`, error)
      })
    }
  }

  /** 批量重启浏览器 */
  async batchReLaunch(winInfoList: WindowItemType[]) {
    await this.batchClose(winInfoList.map(winInfo => winInfo.dirId!))
    await this.batchLaunch(winInfoList)
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
    for (const dirId of dirIds) {
      await this.close(dirId).catch((error) => {
        console.error(`BrowserManager ${dirId} === 关闭失败`, error)
      })
    }
  }

  /** 停止打开后续窗口 */
  async stopOpen() {
    this.openingBrowserMap.clear()
  }

  /** 批量删除窗口 */
  async batchDelete(dirIds: string[]) {
    for (const dirId of dirIds) {
      const browserItem = this.openedBrowserMap.get(dirId)
      try {
        await this.close(dirId)
        await browserItem?.removeLocalData()
      }
      catch (error) {
        console.error(`BrowserManager ${dirId} === 删除失败`, error)
      }
    }
  }
}
