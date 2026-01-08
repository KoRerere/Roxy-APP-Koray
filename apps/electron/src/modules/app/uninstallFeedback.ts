import type { BrowserWindow } from 'electron'
import { screen } from 'electron'
import { isPackaged, isWindows } from '/@/constants/common'
import { cancelQuit } from '/@/modules/app/utils'
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
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = Math.min(640, width - 40)
  const windowHeight = Math.min(800, height - 40)
  const mainWindow = getMainWindow()

  uninstallFeedbackWindow = createWindow({
    roxyWindowId: 'uninstall-feedback',
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    frame: isWindows,
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

  const uninstallUrl = await getWebEntryUrl(`uninstall${isPackaged ? '.html' : ''}`)
  await uninstallFeedbackWindow.loadURL(uninstallUrl)
  uninstallFeedbackWindow.setTitle($t('卸载反馈'))

  uninstallFeedbackWindow.on('ready-to-show', () => {
    uninstallFeedbackWindow?.show()
    uninstallFeedbackWindow?.focus()

    // 通知前端是否是卸载反馈模式
    if (isUninstallFeedbackMode) {
      uninstallFeedbackWindow?.webContents.send('app:uninstall-feedback-mode', true)
    }
  })

  uninstallFeedbackWindow.on('closed', () => {
    // 如果是卸载反馈模式且窗口被关闭，视为用户取消卸载
    if (isUninstallFeedbackMode) {
      cancelQuit()
    }
    uninstallFeedbackWindow = undefined
  })

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
