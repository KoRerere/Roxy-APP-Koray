import { app } from 'electron'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { IPCMainInstance } from '/@/modules/ipc/types'
import { appConfig } from '/@/constants'
import { browserManager, chromeCoreManager } from '/@/modules/browser'
import { DefaultBrowserInstaller } from '/@/modules/shortcut-manager/DefaultBrowserInstaller'
import { ShortcutManager } from '/@/modules/shortcut-manager/ShortcutManager'
import { store } from '/@/modules/store'
import { resourceUpdater } from '/@/modules/updater'

async function pathExists(p: string) {
  try {
    await access(p)
    return true
  }
  catch {
    return false
  }
}

export function setupBrowserIpc(ipcMain: IPCMainInstance) {
  /** 批量启动浏览器 */
  ipcMain.on('browser:batchLaunch', (_event, dirIds) => {
    return browserManager.batchLaunch(dirIds)
  })

  /** 批量关闭浏览器 */
  ipcMain.on('browser:batchClose', (_event, dirIds: string[]) => {
    return browserManager.batchClose(dirIds)
  })

  /** 关闭所有浏览器 */
  ipcMain.on('browser:closeAll', (_event) => {
    return browserManager.closeAll()
  })

  /** 批量重启浏览器 */
  ipcMain.on('browser:batchRelaunch', (_event, dirIds) => {
    return browserManager.batchReLaunch(dirIds)
  })

  /** 批量删除本地浏览器 */
  ipcMain.on('browser:batchRemove', (_event, dirIds) => {
    return browserManager.batchDelete(dirIds)
  })

  /** 根据进程 PID 判断进程是否存在 */
  ipcMain.on('browser:isProcessExists', (_event, dirIds) => {
    return Promise.all(dirIds.map(async (dirId) => {
      const browserItem = browserManager.openedBrowserMap.get(dirId)
      const isExists = Boolean(await browserItem?.beforeLaunchTask.reconnectBrowser())
      if (!isExists) {
        browserItem?.handleOnDisconnected()
      }
      return isExists
    }))
  })

  /** 获取正在使用中的内核 */
  ipcMain.on('browser:usingCores', (_event) => {
    return [...chromeCoreManager.usingCores]
  })

  /** 获取所有已打开的窗口 */
  ipcMain.on('browser:getOpenedBrowser', (_event) => {
    return browserManager.openedBrowserList
  })

  /** 获取所有已打开的窗口数量 */
  ipcMain.on('browser:getOpenedBrowserCount', (_event, targetWorkspaceId?: number) => {
    return browserManager.openedBrowserList
      .filter(item => targetWorkspaceId ? item.workspaceId === targetWorkspaceId : true)
      .length
  })

  /** 获取所有已打开的窗口的消息 */
  ipcMain.on('browser:getOpenedBrowserMessage', (_event) => {
    return [
      ...browserManager.openedBrowserMap.values(),
      ...browserManager.openingBrowserMap.values().map(item => item.browserItem),
    ].map(browserItem => browserItem.lastMessage!)
  })

  /**
   * 清除浏览器缓存
   * @param type 清除类型
   * excludeExtension 清除本地缓存，保留插件
   * all 清除本地缓存
   */
  ipcMain.on('browser:clearCache', async (_event, payload) => {
    const { clearType, dirIds } = payload
    if (clearType === 'all') {
      // 清除本地缓存
      console.log('Clearing local cache', dirIds)
      return Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalData(dirId)))
    }
    else if (clearType === 'partial') {
      // 清除本地缓存，保留插件
      console.log('Clearing local cache, keeping extensions', dirIds)
      return Promise.allSettled(dirIds.map(dirId => browserManager.removeLocalDataExcludeExtension(dirId)))
    }
  })

  ipcMain.on('browser:clearCacheByTimestamp', async (_event, payload) => {
    return browserManager.clearCacheByTimestamp(payload)
  })

  /** 设为默认浏览器 */
  ipcMain.on('browser:setAsDefaultBrowser', async (_event, windowItem) => {
    try {
      const dirId = windowItem.dirId
      if (!dirId) {
        console.error('[browser:setAsDefaultBrowser] dirId is required')
        return
      }

      const { windowName, workspaceId = store.workspaceId, __orderName } = windowItem

      const execName = windowName && windowName !== app.getName()
        ? windowName
        : __orderName

      const installer = new DefaultBrowserInstaller()
      await installer.installAndRegister({ dirId, workspaceId, execName, isSetAsDefaultBrowser: true })
    }
    catch (err) {
      console.error('[browser:setAsDefaultBrowser] failed:', err)
    }
  })

  /** 获取默认浏览器 */
  ipcMain.on('browser:getDefaultBrowser', (_event) => {
    return store.defaultBrowserDirId
  })

  /** 创建桌面快捷方式 */
  ipcMain.on('browser:createDesktopShortcut', async (_event, windowItem) => {
    try {
      const dirId = windowItem.dirId
      if (!dirId) {
        console.error('[browser:createDesktopShortcut] dirId is required')
        return
      }

      const { windowName, workspaceId = store.workspaceId, __orderName } = windowItem

      const execName = windowName && windowName !== app.getName()
        ? windowName
        : __orderName

      const installer = new DefaultBrowserInstaller()
      await installer.installAndRegister({ dirId, workspaceId, execName, isSetAsDefaultBrowser: false })
    }
    catch (err) {
      console.error('[browser:createDesktopShortcut] failed:', err)
    }
  })
}
