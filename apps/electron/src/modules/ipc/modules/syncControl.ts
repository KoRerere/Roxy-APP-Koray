
import { IPCMainInstance } from "/@/modules/ipc/types"
import { closeSynchronizerWindow, createSynchronizerWindow } from "/@/modules/sync-control/synchronizer"
import { getAllSyncControlBrowsers, getControlledBrowsers, getMainControlBrowser, getMainControlBrowserSize, getRoxySyncStartResult, getSyncWindowCount, startRoxySync, stopRoxySync } from "/@/modules/sync-control/bin"
import { browserManager } from "/@/modules/browser"
import { closeSynchronizerActionBarWindow, createSynchronizerActionBarWindow } from "/@/modules/sync-control/actionBar"
import { sendText, showAllWindows, syncSettings, windowArrange } from "/@/modules/sync-control/api"
import { closePreferencesDialogWindowWindow, openPreferencesDialog, resizePreferencesDialog } from "/@/modules/sync-control/dialog/preferences"
import { closeCustomLayoutsDialogWindow, openCustomLayoutDialog } from "/@/modules/sync-control/dialog/custom-layout"
import { closeBatchInputsDialogWindow, openBatchInputsDialog, resizeBatchInputsDialog } from "/@/modules/sync-control/dialog/batch-inputs"
import { isLocalWebServerURL } from "/@/modules/browser/browser-manager/constants"
import axios from "axios"
import { BrowserItem } from "/@/modules/browser/browser-manager/browserItem"
import { closeOpenSitesDialogWindow, openOpenSitesDialog } from "/@/modules/sync-control/dialog/open-sites"
import { closeSyncingWindowListWindow, openSyncingWindowList } from "/@/modules/sync-control/dialog/syncing-window-list"



/** 窗口同步器相关 */
export function setupSyncControlIpc(ipcMain: IPCMainInstance) {
  /** 打开窗口同步器 */
  ipcMain.on('syncControl:open', () => {
    console.log('打开窗口同步器')
    // return openPreferencesDialog()
    // return createSynchronizerActionBarWindow()
    // openCustomLayoutDialog()
    createSynchronizerWindow()
    // openBatchInputsDialog()
  })

  /** 关闭窗口同步器 */
  ipcMain.on('syncControl:close', (event) => {
    console.log('关闭窗口同步器')
    closeSynchronizerWindow()
  })

  /**
   *
   * 开始同步窗口
   *
   * 注意：如果主窗口关闭，退出同步
   * 设置主窗口颜色： await cdpSesssion.send('Browser.setColor',{rgb:"FFFF6347"});
   * 还原背景颜色： await cdpSesssion.send('Browser.setColor',{rgb:""});
   * 1. 启动同步
        命令：
        roxy-sync.exe --pids=pid1,pid2,pid3...  --settings=base64(settings结构)

        参数说明：
        pids 需要同步的窗口的pid 用,分割， 第一个PID为主窗口
        settings 为同步相关的设置，settings结构 base64编码

        启动成功后,会输出监听的端口以及显示器信息，格式如下:
        start success:{"listening":64550,"monitors":[{"height":1040,"index":0,"width":1920}]}

        如果没有取到，就认为启动失败
   * */
  ipcMain.on('syncControl:start', async (event, dirIds) => {
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
  })

  /** 停止同步窗口 */
  ipcMain.on('syncControl:stop', (event,) => {
    console.log('停止同步窗口')
    stopRoxySync()
    setTimeout(() => {
      createSynchronizerWindow()
    }, 1000)
  })

  /** 宫格布局、堆叠布局、自定义布局 */
  ipcMain.on('syncControl:doLayout', (event, payload) => {
    console.log('宫格布局、堆叠布局、自定义布局:', payload)
    return windowArrange(payload)
  })

  /** 显示所有窗口 */
  ipcMain.on('syncControl:showAll', (event) => {
    console.log('显示所有窗口')
    return showAllWindows()
  })

  /** 动态修改同步设置 */
  ipcMain.on('syncControl:changeSyncSettings', (event, payload) => {
    console.log('动态修改同步设置:', payload)
    return syncSettings(payload)
  })

  /** 打开偏好设置弹窗 */
  ipcMain.on('syncControl:openPreferencesDialog', (event, payload) => {
    console.log('打开偏好设置弹窗')
    openPreferencesDialog(payload)
  })

  /** 关闭偏好设置弹窗 */
  ipcMain.on('syncControl:closePreferencesDialog', (event) => {
    console.log('关闭偏好设置弹窗')
    closePreferencesDialogWindowWindow()
  })


  /** 动态改变偏好设置弹窗弹窗大小 */
  ipcMain.on('syncControl:resizePreferencesDialog', (event, payload) => {
    console.log('动态改变偏好设置弹窗弹窗大小:', payload)
    resizePreferencesDialog(payload)
  })

  /** 获取当前同步窗口的个数 */
  ipcMain.on('syncControl:getSyncWindowCount', (event) => {
    console.log('获取当前同步窗口的个数')
    return getSyncWindowCount()
  })

  /** 打开自定义布局弹窗 */
  ipcMain.on('syncControl:openCustomLayoutDialog', (event) => {
    console.log('打开自定义布局弹窗')
    openCustomLayoutDialog()
  })

  /** 关闭自定义布局弹窗 */
  ipcMain.on('syncControl:closeCustomLayoutDialog', (event) => {
    console.log('关闭自定义布局弹窗')
    closeCustomLayoutsDialogWindow()
  })

  /** 获取同步器启动返回的结果 */
  ipcMain.on('syncControl:getSyncStartResult', (event) => {
    console.log('获取同步器启动返回的结果')
    return getRoxySyncStartResult()
  })

  /** 打开批量输入文本弹窗 */
  ipcMain.on('syncControl:openBatchInputsDialog', (event) => {
    console.log('打开批量输入文本弹窗')
    openBatchInputsDialog()
  })

  /** 关闭批量输入文本弹窗 */
  ipcMain.on('syncControl:closeBatchInputsDialog', (event) => {
    console.log('关闭批量输入文本弹窗')
    closeBatchInputsDialogWindow()
  })

  /** 动态改变匹配输入文本弹窗大小 */
  ipcMain.on('syncControl:resizeBatchInputsDialog', (event, payload) => {
    console.log('动态改变匹配输入文本弹窗大小:', payload)
    resizeBatchInputsDialog(payload)
  })

  /** 开始执行批量输入文本 */
  ipcMain.on('syncControl:batchInputText', async (event, payload) => {
    console.log('开始执行批量输入文本:', payload)
    const result = await sendText(payload)
    console.log('开始执行批量输入文本 result:', result)
    return result
  })

  /** 获取主控浏览器大小 */
  ipcMain.on('syncControl:getMainControlBrowserSize', async (event) => {
    return getMainControlBrowserSize()
  })

  /** 统一标签页 */
  ipcMain.on('syncControl:unifyTabs', async (event) => {
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
  })

  /** 关闭其他标签页 */
  ipcMain.on('syncControl:closeOtherTabs', async (event) => {
    console.log('关闭其他标签页')
    // https://chromedevtools.github.io/devtools-protocol/
    // http://127.0.0.1:61854/json/list
    const allSyncControlBrowsers = getAllSyncControlBrowsers()

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      pages?.forEach(async page => {
        const pageId = page.target()._targetId
        if (pageId !== activeTargetId) {
          await page.close()
        }
      })
    })
  })

  /** 关闭当前标签页 */
  ipcMain.on('syncControl:closeCurrentTab', (event) => {
    console.log('关闭当前标签页')
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    globalThis.getAllSyncControlBrowsers = getAllSyncControlBrowsers

    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = await getActivePageTargetId(browser)
      const pages = await browser?.getBrowser()?.pages()
      if (pages?.length === 1) {
        console.log('只有一个标签页，不关闭')
        return
      }
      pages?.forEach(async page => {
        const pageId = page.target()._targetId
        if (pageId === activeTargetId) {
          await page.close()
        }
      })
    })
  })

  const blankTabs = ['chrome://newtab/', 'about:blank', 'chrome://new-tab-page/']
  /** 关闭空白标签页 */
  ipcMain.on('syncControl:closeBlankTabs', (event) => {
    console.log('关闭空白标签页')
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
        const pageURL = page.url()
        if (blankTabs.includes(pageURL)) {
          page.close()
          closeCount++
        }
      }
    })
  })

  /** 打开网址 */
  ipcMain.on('syncControl:openSites', (event, payload) => {
    console.log('打开网址:', payload)
    const { urls, replaceCurrentTab } = payload
    const allSyncControlBrowsers = getAllSyncControlBrowsers()
    allSyncControlBrowsers.forEach(async (browser) => {
      const activeTargetId = replaceCurrentTab ? await getActivePageTargetId(browser) : undefined
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
  })

  /** 打开打开网址弹窗 */
  ipcMain.on('syncControl:openOpenSitesDialog', (event) => {
    console.log('打开打开网址弹窗')
    openOpenSitesDialog()
  })

  /** 关闭打开网址弹窗 */
  ipcMain.on('syncControl:closeOpenSitesDialog', (event) => {
    console.log('关闭打开网址弹窗')
    closeOpenSitesDialogWindow()
  })


  /** 显示所有正在同步的窗口列表弹窗 */
  ipcMain.on('syncControl:openSyncingWindowListDialog', (event) => {
    console.log('显示所有正在同步的窗口列表')
    openSyncingWindowList()
  })

  /** 关闭所有正在同步的窗口列表弹窗 */
  ipcMain.on('syncControl:closeSyncingWindowListDialog', (event) => {
    console.log('关闭所有正在同步的窗口列表')
    closeSyncingWindowListWindow()
  })

  /** 获取主控窗口 dirId */
  ipcMain.on('syncControl:getMainControlDirId', (event) => {
    console.log('获取主控窗口 dirId')
    return getMainControlBrowser()?.winInfo.dirId
  })

  /** 获取所有群控中的窗口 */
  ipcMain.on('syncControl:getAllSyncingWindows', (event) => {
    console.log('获取所有群控中的窗口')
    return getAllSyncControlBrowsers().map(browser => ({
      ...browser.winInfo,
      $pId: browser.launchInfo?.pid,
    }))
  })
}


/** 获取浏览器当前被激活的标签页的 targetId */
export async function getActivePageTargetId(browser: BrowserItem) {
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
