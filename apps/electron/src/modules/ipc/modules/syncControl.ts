
import { detectNetwork, getSystemProxy, proxyDetection, tryRefreshUrl } from "/@/utils"
import { delRoxynetProxy } from "/@/modules/roxynet"
import { IPCMainInstance } from "/@/modules/ipc/types"
import { closeSynchronizerWindow, createSynchronizerWindow } from "/@/modules/sync-control/synchronizer"
import { getRoxySyncAPIBaseURL, getRoxySyncStartResult, startRoxySync, stopRoxySync } from "/@/modules/sync-control/bin"
import { browserManager } from "/@/modules/browser"
import { createSynchronizerActionBarWindow } from "/@/modules/sync-control/actionBar"
import { showAllWindows, syncSettings, windowArrange } from "/@/modules/sync-control/api"
import { openPreferencesDialog } from "/@/modules/sync-control/dialog/preferences"



/** 窗口同步器相关 */
export function setupSyncControlIpc(ipcMain: IPCMainInstance) {
  /** 打开窗口同步器 */
  ipcMain.on('syncControl:open', () => {
    console.log('打开窗口同步器')
    return openPreferencesDialog()
    // return createSynchronizerActionBarWindow()
    createSynchronizerWindow()
  })

  /** 关闭窗口同步器 */
  ipcMain.on('syncControl:close', (event) => {
    console.log('关闭窗口同步器')
    return delRoxynetProxy(dirId)
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
    const pIds = Array.from(browserManager.openedBrowserMap.values()).filter(n => dirIds.includes(n.winInfo.dirId!)).map(browserItem => browserItem.launchInfo?.pid)
    const isSuccess = await startRoxySync(pIds)
    console.log('syncControl:start isSuccess:', isSuccess)
    if (isSuccess) {
      console.log('窗口同步程序执行成功，关闭同步器窗口，开始打开同步器操作栏窗口')
      createSynchronizerActionBarWindow()
      closeSynchronizerWindow()
    }
  })

  /** 停止同步窗口 */
  ipcMain.on('syncControl:stop', (event,) => {
    console.log('停止同步窗口')
    stopRoxySync()
    createSynchronizerWindow()
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
  ipcMain.on('syncControl:openPreferencesDialog', (event) => {
    console.log('打开偏好设置弹窗')
    openPreferencesDialog()
  })
}
