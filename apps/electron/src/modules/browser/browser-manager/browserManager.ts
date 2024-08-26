import { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'

export class BrowserManager {
  /** 正在打开中的浏览器集合 */
  private openingBrowserMap = new Map<string, Promise<void>>()
  /** 已经打开的浏览器集合 */
  private openedBrowserMap = new Map<string, BrowserItem>()

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
    // 如果浏览器已经打开, 则直接返回
    if (this.openedBrowserMap.has(winInfo.dirId!)) {
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
    browserItem.browser?.on('disconnected', () => {
      console.log(`BrowserManager ${winInfo.dirId} === 浏览器已关闭`)
      this.openedBrowserMap.delete(winInfo.dirId!)
    })
  }

  /** 关闭浏览器 */
  async close(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)
    if (browserItem) {
      const browserProcess = browserItem.browser?.process()
      await browserItem.close()
      this.openedBrowserMap.delete(dirId)
      // 有些时候浏览器进程被关闭了，但是 puppeteer 进程还在，这里需要手动关闭
      if (browserProcess?.pid) {
        try {
          process.kill(browserProcess.pid)
        }
        catch (_) {
          // console.log(`kill browser process`, error);
        }
      }
    }
  }

  /** 批量启动浏览器 */
  async batchLaunch(winInfoList: WindowItemType[]) {
    for (const winInfo of winInfoList) {
      await this.launch(winInfo)
    }
  }

  /** 批量关闭浏览器 */
  async batchClose() {
    for await (const dirId of this.openedBrowserMap.keys()) {
      await this.close(dirId)
    }
  }

  /** 停止打开后续窗口 */
  async stopOpen() {
    this.openingBrowserMap.clear()
  }
}
