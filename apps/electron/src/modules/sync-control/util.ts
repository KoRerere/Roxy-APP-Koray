import { browserManager } from "/@/modules/browser"
import { createSynchronizerActionBarWindow } from "/@/modules/sync-control/actionBar"
import { getAllSyncControlBrowsers, getControlledBrowsers, getMainControlBrowser, startRoxySync, stopRoxySync } from "/@/modules/sync-control/bin"
import { closeSynchronizerWindow, createSynchronizerWindow } from "/@/modules/sync-control/synchronizer"
import { showAllWindows, windowArrange } from "/@/modules/sync-control/api"
import { isLocalWebServerURL } from "/@/modules/browser/browser-manager/constants"
import { closeOpenSitesDialogWindow } from "/@/modules/sync-control/dialog/open-sites"
import { BrowserItem } from "/@/modules/browser/browser-manager/browserItem"
import axios from "axios"
import { Page } from "puppeteer-core"

/** 同步控制工具 */
export class SyncControlUtil {
  /** 开始同步 */
  static start = async (dirIds: string[]) => {
    const pIds = Array.from(browserManager.openedBrowserMap.values())
      .reduce((acc, cur) => {
        if (dirIds.includes(cur.winInfo.dirId!) && cur.launchInfo?.pid) {
          acc.push(cur.launchInfo.pid)
          // 第一个PID为主窗口
          if (dirIds[0] === cur.winInfo.dirId) {
            acc = [...new Set([cur.launchInfo.pid, ...acc])]
          }
        }
        return acc
      }, [] as number[])
    const isSuccess = await startRoxySync(pIds)
    console.log('syncControl:start isSuccess:', isSuccess)
    if (isSuccess) {
      console.log('窗口同步程序执行成功，关闭同步器窗口，开始打开同步器操作栏窗口')
      closeSynchronizerWindow()
      createSynchronizerActionBarWindow()
    }
  }

  /** 停止同步 */
  static stop = async () => {
    console.log('停止同步窗口')
    stopRoxySync()
    setTimeout(() => {
      createSynchronizerWindow()
    }, 1000)
  }

  /** 显示所有窗口 */
  static showAllWindows = showAllWindows
  /** 窗口排列 */
  static doLayout = windowArrange
  /** 统一标签页 */
  static unifyTabs = async () => {
    console.log('统一标签页')
    const mainControlBrowser = getMainControlBrowser()
    const controlledBrowsers = getControlledBrowsers()
    if (mainControlBrowser) {
      const mainControlPages = await mainControlBrowser.getBrowser()?.pages()
      const mainControlPageCount = mainControlPages?.length
      // 关闭被控窗口的所有标签页
      const controlledBrowserPages = await Promise.all(controlledBrowsers.map(async browser => {
        const pages = await browser.getBrowser()?.pages() || []
        await Promise.all(pages.slice(mainControlPageCount).map(page => page.close()))
        return browser.getBrowser()?.pages()
      }))

      mainControlPages?.forEach((page, pageIndex) => {
        const pageURL = page.url()

        controlledBrowsers.forEach(async (item, browserIndex) => {
          const browser = item.getBrowser()
          const oldPages = controlledBrowserPages[browserIndex]
          const page = oldPages?.[pageIndex] || await browser?.newPage()

          const isLocalWebURL = isLocalWebServerURL(pageURL)
          // 如果是本地 web 服务
          if (isLocalWebURL) {
            const url = new URL(pageURL)
            url.searchParams.set('id', item.winInfo.dirId!)
            await page?.goto(url.toString())
          } else {
            await page?.goto(pageURL)
          }
        })
      })
    }
  }

  /** 关闭其他标签页 */
  static closeOtherTabs = async () => {
    console.log('关闭其他标签页')
    // https://chromedevtools.github.io/devtools-protocol/
    // http://127.0.0.1:61854/json/list
    const allSyncControlBrowsers = getAllSyncControlBrowsers()

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await this.getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      pages?.forEach(async page => {
        const { targetId } = await this.getPageTargetInfo(page)
        if (targetId !== activeTargetId) {
          await page.close()
        }
      })
    })
  }

  /** 关闭当前标签页 */
  static closeCurrentTab = async () => {
    console.log('关闭当前标签页')
    const allSyncControlBrowsers = getAllSyncControlBrowsers()

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await this.getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      if (pages?.length === 1) {
        console.log('只有一个标签页，不关闭')
        return
      }
      pages?.forEach(async page => {
        const { targetId } = await this.getPageTargetInfo(page)
        if (targetId === activeTargetId) {
          await page.close()
        }
      })
    })
  }

  /** 关闭空白标签页 */
  static closeBlankTabs = () => {
    console.log('关闭空白标签页')
    const blankTabs = ['chrome://newtab/', 'about:blank', 'chrome://new-tab-page/']
    // 例如：chrome://newtab/
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    allSyncControlBrowsers.forEach(async (browser) => {
      const pages = await browser?.getBrowser()?.pages()
      const totalPageCount = pages!.length
      // 如果只有一个标签页，不关闭
      if (totalPageCount === 1) {
        console.log('只有一个标签页，不关闭')
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
    console.log('打开网址:', payload)
    const { urls, replaceCurrentTab } = payload
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = replaceCurrentTab ? await this.getActivePageTargetId(browser) : undefined
      const pages = await browser?.getBrowser()?.pages()
      // 如果是替换当前标签页
      if (replaceCurrentTab) {
        pages?.forEach(async page => {
          const pageId = page.target()._targetId
          if (pageId === activeTargetId) {
            await page.goto(urls[0])
          }
        })
      }
      urls.slice(Number(replaceCurrentTab)).forEach(async url => {
        const page = await browser?.getBrowser()?.newPage()
        await page?.goto(url)
      })
    })
    closeOpenSitesDialogWindow()
  }

  /** 获取某个页面的 targetInfo */
  static getPageTargetInfo = async (page: Page) => {
    // 创建 CDP 会话
    const client = await page.createCDPSession();
    // 获取目标信息
    const targetInfo = await client.send('Target.getTargetInfo');
    return targetInfo.targetInfo;
  }

  /** 获取浏览器当前被激活的标签页的 targetId */
  static getActivePageTargetId = async (browser: BrowserItem) => {
    const baseUrl = browser?.launchInfo?.http
    const result = await axios.get(`http://${baseUrl}/json/list`)
    if (result.status === 200) {
      // 过滤掉 devtools:// 开头的标签页（针对移动端）
      const currentActivePage = result.data.filter(n => !n.url.startsWith('devtools://'))[0]
      return currentActivePage.webSocketDebuggerUrl.split('/').at(-1)
    } else {
      console.log(`${browser.winInfo.dirId} === 获取浏览器当前被激活的标签页的失败:`, result)
    }
  }
}
