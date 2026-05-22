import type { BrowserWindow } from 'electron'
import { screen, session } from 'electron'
import { isPackaged, isWindows } from '/@/constants/common'
import { cancelQuit, executeUninstall } from '/@/modules/app/utils'
import { createWindow } from '/@/utils/browser-window'
import { getMainWindow, getWebEntryUrl } from './mainWindow'

let uninstallFeedbackWindow: BrowserWindow | undefined

/** 是否是卸载反馈模式（由卸载程序启动） */
export const isUninstallFeedbackMode = process.argv.includes('--uninstall-feedback')

/**
 * 创建卸载反馈窗口
 */
export async function createUninstallFeedbackWindow(): Promise<BrowserWindow> {
  console.log('createUninstallFeedbackWindow 1')
  if (uninstallFeedbackWindow && !uninstallFeedbackWindow.isDestroyed()) {
    uninstallFeedbackWindow.focus()
    return uninstallFeedbackWindow
  }
  console.log('createUninstallFeedbackWindow 2')
  const mainWindow = getMainWindow()

  uninstallFeedbackWindow = createWindow({
    roxyWindowId: 'uninstall-feedback',
    width: 720,
    height: 400,
    resizable: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    roundedCorners: false,
    autoHideMenuBar: true,
    show: false,
    modal: true,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const targetId = uninstallFeedbackWindow.webContents.id

  console.log('createUninstallFeedbackWindow 3')
  const uninstallUrl = await getWebEntryUrl(`uninstall${isPackaged ? '.html' : ''}`)
  console.log('Uninstall feedback URL:', uninstallUrl)
  session.defaultSession.webRequest.onCompleted((details) => {
    if (
      details.webContentsId === targetId // 只关心这个窗口
      && details.resourceType === 'mainFrame'
      && details.statusCode === 404
    ) {
      console.log('该窗口主页面 404:', details.url)
      // 兜底处理
      executeUninstall()
    }
  })
  uninstallFeedbackWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.error('Load failed:', code, desc, url)
    executeUninstall()
  })
  await uninstallFeedbackWindow.loadURL(uninstallUrl).catch((error) => {
    console.error('Failed to load uninstall feedback URL:', error)
    executeUninstall()
  })
  console.log('createUninstallFeedbackWindow 4')
  uninstallFeedbackWindow.setTitle($t('卸载反馈'))

  uninstallFeedbackWindow?.show()
  uninstallFeedbackWindow?.focus()

  uninstallFeedbackWindow.on('closed', () => {
    uninstallFeedbackWindow?.isDestroyed()
    console.log('Uninstall feedback window closed')
    // 如果是卸载反馈模式且窗口被关闭，视为用户取消卸载
    cancelQuit()
    uninstallFeedbackWindow = undefined
  })
  console.log('createUninstallFeedbackWindow 5')

  return uninstallFeedbackWindow
}

/**
 * 关闭卸载反馈窗口
 */
export function closeUninstallFeedbackWindow() {
  if (uninstallFeedbackWindow && !uninstallFeedbackWindow.isDestroyed()) {
    uninstallFeedbackWindow.close()
    uninstallFeedbackWindow = undefined
  }
}

/**
 * 获取卸载反馈窗口实例
 */
export function getUninstallFeedbackWindow(): BrowserWindow | undefined {
  return uninstallFeedbackWindow
}
