import { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'

export class BrowserManager {
  /** 已经打开的浏览器集合 */
  private openedBrowserMap = new Map<string, BrowserItem>()

  /** 启动浏览器 */
  async launch(winInfo: WindowItemType) {
    const browserItem = new BrowserItem(winInfo)
    await browserItem.launch()
    this.openedBrowserMap.set(winInfo.dirId!, browserItem)
  }

  /** 关闭浏览器 */
  async close(dirId: string) {
    const browserItem = this.openedBrowserMap.get(dirId)
    if (browserItem) {
      await browserItem.close()
      this.openedBrowserMap.delete(dirId)
    }
  }

  /** 批量启动浏览器 */
  async batchLaunch(winInfoList: WindowItemType[]) {
    for await (const winInfo of winInfoList) {
      this.launch(winInfo)
    }
  }

  /** 批量关闭浏览器 */
  async batchClose() {
    for await (const dirId of this.openedBrowserMap.keys()) {
      await this.close(dirId)
    }
  }
}
