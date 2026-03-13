import type { BrowserItem } from '/@/modules/browser/browser-manager/browserItem'
// 注意：此文件使用了 Chrome 特定的 CDP 功能（createCDPSession）
// 如需支持 Firefox，需要创建对应的实现
import type { Page } from '/@/modules/browser/browser-manager/chrome-wrapper'
import axios from 'axios'
import { setTimeout } from 'node:timers/promises'
import { browserManager } from '/@/modules/browser'
import { isLocalWebServerURL } from '/@/modules/browser/browser-manager/constants'
import { createSynchronizerActionBarWindow } from '/@/modules/sync-control/actionBar'
import { showAllWindows, startSyncControl, stopSyncControl, windowArrange } from '/@/modules/sync-control/api'
import { getAllSyncControlBrowsers, getControlledBrowsers, getMainControlBrowser, startRoxySync, stopRoxySync } from '/@/modules/sync-control/bin'
import { closeOpenSitesDialogWindow } from '/@/modules/sync-control/dialog/open-sites'
import { closeSynchronizerWindow, createSynchronizerWindow } from '/@/modules/sync-control/synchronizer'
import { safeParseJSON } from '/@/utils'

/** 同步控制工具 */
export class SyncControlUtil {
  /** 开始同步 */
  static start = async (dirIds: string[]) => {
    // 按 dirIds 顺序获取 PID，第一个为主控窗口
    const pIds = dirIds.reduce((acc, dirId) => {
      const browser = browserManager.openedBrowserMap.get(dirId)
      if (browser?.launchInfo?.pid) {
        acc.push(browser.launchInfo.pid)
      }
      return acc
    }, [] as number[])
    const isSuccess = await startRoxySync(pIds)
    console.log('syncControl:start isSuccess:', isSuccess)
    if (isSuccess) {
      console.log('Window sync program executed successfully, closing synchronizer window, opening synchronizer action bar window')
      closeSynchronizerWindow()
      createSynchronizerActionBarWindow()
    }
  }

  /** 停止同步 */
  static stop = async (isShowSyncingWindowListDialog = true) => {
    console.log('Stopping sync windows', isShowSyncingWindowListDialog)
    stopRoxySync()
    if (isShowSyncingWindowListDialog) {
      await setTimeout(100)
      createSynchronizerWindow()
    }
  }

  /** 显示所有窗口 */
  static showAllWindows = showAllWindows
  /** 窗口排列 */
  static doLayout = windowArrange
  /** 统一标签页 */
  static unifyTabs = async () => {
    console.log('Unifying tabs')
    const mainControlBrowser = getMainControlBrowser()
    const controlledBrowsers = getControlledBrowsers()
    if (mainControlBrowser) {
      const { tabs } = await mainControlBrowser.getBrowser()?.client.Browser.getTabs().catch((err) => {
        console.error('mainControlBrowser Browser.getTabs() error: ', err)
        return Promise.reject(err)
      })
      console.debug('tabs', typeof tabs, tabs)
      const mainBrowserPages = safeParseJSON(tabs)
      console.debug('mainBrowserPages', mainBrowserPages)
      // 关闭被控窗口的所有标签页
      const controlledBrowserPages = await Promise.all(controlledBrowsers.map(async (browser) => {
        const pages = await browser.getBrowser()?.pages() || []
        pages.slice(mainBrowserPages.length).forEach(page => page.close())
        return pages.slice(0, mainBrowserPages.length)
      })).catch((err) => {
        console.error('controlledBrowsers.map error: ', err)
        return Promise.reject(err)
      })
      mainBrowserPages.forEach((tab, pageIndex) => {
        const pageURL = tab.url

        controlledBrowsers.forEach(async (item, browserIndex) => {
          const browser = item.getBrowser()
          const oldPages = controlledBrowserPages[browserIndex]
          console.log('oldPages', oldPages.map(n => n.url()))
          let finalURL = pageURL
          const page = oldPages?.[pageIndex]

          const isLocalWebURL = isLocalWebServerURL(pageURL)
          // 如果是本地 web 服务
          if (isLocalWebURL) {
            const url = new URL(pageURL)
            url.searchParams.set('id', item.winInfo.dirId!)
            finalURL = url.toString()
          }
          console.log('finalURL', finalURL)
          if (page) {
            if (page.url() !== finalURL) {
              await page.goto(finalURL)
            }
          }
          else {
            await browser?.newPage(finalURL)
          }
        })
      })
    }
  }

  /** 关闭其他标签页 */
  static closeOtherTabs = async () => {
    console.log('Closing other tabs')
    // https://chromedevtools.github.io/devtools-protocol/
    // http://127.0.0.1:61854/json/list
    const allSyncControlBrowsers = getAllSyncControlBrowsers()

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await this.getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      pages?.forEach(async (page) => {
        const { targetId } = await this.getPageTargetInfo(page)
        if (targetId !== activeTargetId) {
          await page.close()
        }
      })
    })
  }

  /** 关闭当前标签页 */
  static closeCurrentTab = async () => {
    console.log('Closing current tab')
    const allSyncControlBrowsers = getAllSyncControlBrowsers()

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await this.getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      if (pages?.length === 1) {
        console.log('Only one tab, not closing')
        return
      }
      pages?.forEach(async (page) => {
        const { targetId } = await this.getPageTargetInfo(page)
        if (targetId === activeTargetId) {
          await page.close()
        }
      })
    })
  }

  /** 关闭空白标签页 */
  static closeBlankTabs = () => {
    console.log('Closing blank tabs')
    const blankTabs = ['chrome://newtab/', 'about:blank', 'chrome://new-tab-page/']
    // 例如：chrome://newtab/
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    allSyncControlBrowsers.forEach(async (browser) => {
      const pages = await browser?.getBrowser()?.pages()
      const totalPageCount = pages!.length
      // 如果只有一个标签页，不关闭
      if (totalPageCount === 1) {
        console.log('Only one tab, not closing')
        return
      }

      let closeCount = 0
      // 最少保留要一个标签页
      for (let i = 0; i < totalPageCount; i++) {
        if (closeCount >= totalPageCount - 1) {
          break
        }

        const page = pages?.[i]
        const pageURL = page?.url()
        if (blankTabs.includes(pageURL)) {
          page?.close()
          closeCount++
        }
      }
    })
  }

  /** 打开网址 */
  static openSites = async (payload: { urls: string[], replaceCurrentTab: boolean }) => {
    console.log('Opening URLs:', payload)
    const { urls, replaceCurrentTab } = payload
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = replaceCurrentTab ? await this.getActivePageTargetId(browser) : undefined
      const pages = await browser?.getBrowser()?.pages()
      // 如果是替换当前标签页
      if (replaceCurrentTab) {
        pages?.forEach(async (page) => {
          const pageId = page.target()._targetId
          if (pageId === activeTargetId) {
            await page.goto(urls[0])
          }
        })
      }
      urls.slice(Number(replaceCurrentTab)).forEach(async (url) => {
        const page = await browser?.getBrowser()?.newPage()
        await page?.goto(url)
      })
    })
    closeOpenSitesDialogWindow()
  }

  /** 获取某个页面的 targetInfo */
  static getPageTargetInfo = async (page: Page) => {
    // 创建 CDP 会话
    const client = await page.createCDPSession()
    // 获取目标信息
    const targetInfo = await client.send('Target.getTargetInfo')
    return targetInfo.targetInfo
  }

  /** 获取浏览器当前被激活的标签页的 targetId */
  static getActivePageTargetId = async (browser: BrowserItem) => {
    // 过滤掉 devtools:// 开头的标签页（针对移动端）
    const currentActivePage = await this.getCurrentActivePage(browser)
    return currentActivePage.webSocketDebuggerUrl.split('/').at(-1)
  }

  /** 获取浏览器当前被激活的标签页 */
  static getCurrentActivePage = async (browser: BrowserItem) => {
    const baseUrl = browser?.launchInfo?.http
    const result = await axios.get(`http://${baseUrl}/json/list`)
    if (result.status === 200) {
      // 过滤掉 devtools:// 开头的标签页（针对移动端）
      const currentActivePage = result.data.filter(n => !n.url.startsWith('devtools://'))[0]
      return currentActivePage
    }
    else {
      console.log(`${browser.winInfo.dirId} === Failed to get browser's currently active tab:`, result)
    }
  }

  static pause = async () => {
    console.log('Pausing sync')
    return stopSyncControl()
  }

  static resume = async () => {
    console.log('Resuming sync')
    return startSyncControl()
  }
}
