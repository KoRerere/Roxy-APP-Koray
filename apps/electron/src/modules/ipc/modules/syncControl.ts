
import { IPCMainInstance } from "/@/modules/ipc/types"
import { closeSynchronizerWindow, createSynchronizerWindow } from "/@/modules/sync-control/synchronizer"
import { getAllSyncControlBrowsers, getMainControlBrowser, getMainControlBrowserSize, getRoxySyncStartResult, getSyncWindowCount, } from "/@/modules/sync-control/bin"
import { sendText, syncSettings } from "/@/modules/sync-control/api"
import { closePreferencesDialogWindowWindow, openPreferencesDialog, resizePreferencesDialog } from "/@/modules/sync-control/dialog/preferences"
import { closeCustomLayoutsDialogWindow, openCustomLayoutDialog } from "/@/modules/sync-control/dialog/custom-layout"
import { closeBatchInputsDialogWindow, openBatchInputsDialog, resizeBatchInputsDialog } from "/@/modules/sync-control/dialog/batch-inputs"
import { closeOpenSitesDialogWindow, openOpenSitesDialog } from "/@/modules/sync-control/dialog/open-sites"
import { closeSyncingWindowListWindow, openSyncingWindowList } from "/@/modules/sync-control/dialog/syncing-window-list"
import { checkShortcutKeysIsOccupied, registerGlobalShortcut } from "/@/modules/sync-control/shortcutKey"
import { globalShortcut } from "electron"
import { SyncControlUtil } from "/@/modules/sync-control/util"


export function closeSyncControl() {
  closeSynchronizerWindow()
  globalShortcut.unregisterAll()
}

/** 窗口同步器相关 */
export function setupSyncControlIpc(ipcMain: IPCMainInstance) {
  /** 打开窗口同步器 */
  ipcMain.on('syncControl:open', () => {
    console.log('打开窗口同步器')
    // return openPreferencesDialog()
    // return createSynchronizerActionBarWindow()
    // openCustomLayoutDialog()
    createSynchronizerWindow()
    registerGlobalShortcut()
    // openBatchInputsDialog()
  })

  /** 关闭窗口同步器 */
  ipcMain.on('syncControl:close', (event) => {
    console.log('关闭窗口同步器')
    closeSyncControl()
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
    SyncControlUtil.start(dirIds)
  })

  /** 停止同步窗口 */
  ipcMain.on('syncControl:stop', (event,) => {
    SyncControlUtil.stop()
  })

  /** 宫格布局、堆叠布局、自定义布局 */
  ipcMain.on('syncControl:doLayout', (event, payload) => {
    console.log('宫格布局、堆叠布局、自定义布局:', payload)
    return SyncControlUtil.doLayout(payload)
  })

  /** 显示所有窗口 */
  ipcMain.on('syncControl:showAll', (event) => {
    console.log('显示所有窗口')
    return SyncControlUtil.showAllWindows()
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
    await SyncControlUtil.unifyTabs()
  })

  /** 关闭其他标签页 */
  ipcMain.on('syncControl:closeOtherTabs', async (event) => {
    await SyncControlUtil.closeOtherTabs()
  })

  /** 关闭当前标签页 */
  ipcMain.on('syncControl:closeCurrentTab', async (event) => {
    await SyncControlUtil.closeCurrentTab()
  })

  /** 关闭空白标签页 */
  ipcMain.on('syncControl:closeBlankTabs', async (event) => {
    await SyncControlUtil.closeBlankTabs()
  })

  /** 打开网址 */
  ipcMain.on('syncControl:openSites', async (event, payload) => {
    await SyncControlUtil.openSites(payload)
  })

  /** 打开 打开网址弹窗 */
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

  /** 注册快捷键 */
  ipcMain.on('syncControl:registerShortcut', async (event, payload) => {
    console.log('注册快捷键:', payload)
    return registerGlobalShortcut(payload)
  })

  /** 检测快捷键是否被占用 */
  ipcMain.on('syncControl:checkShortcutKeysIsOccupied', async (event, payload) => {
    console.log('检测快捷键是否被占用:', payload)
    const result = checkShortcutKeysIsOccupied(payload)
    console.log('检测快捷键是否被占用 result:', result)
    return result
  })
}



