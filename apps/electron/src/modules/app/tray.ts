import { app, BrowserWindow, dialog, Menu, Tray } from 'electron'
import path from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import { API } from '/@/api'
import { onNetworkNodeChanged } from '/@/api/getGatewayConfig'
import { isDev } from '/@/constants/common'
import { getMainWindow, restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { browserManager } from '/@/modules/browser'
import { dictStore, onNetworkNodeUpdated } from '/@/modules/dict'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { closeAllWindows } from '/@/utils/browser-window'
import { getProdWebDomain } from '/@/utils/getProdWebDomain'

let tray: Tray
/** 创建托盘 */
export async function createTray() {
  await setTimeoutPromise()
  if (isUninstallFeedbackMode) {
    return
  }
  // 如果已经创建过托盘，直接返回, 因为
  if (tray) {
    tray.setContextMenu(createContextMenu())
    return tray
  }

  const iconPath = path.join(import.meta.dirname, '..', 'resources/roxy-tray.png')
  // 新建托盘
  tray = new Tray(iconPath)
  // 托盘名称
  tray.setToolTip(app.getName())

  // 载入托盘菜单
  tray.setContextMenu(createContextMenu())
  // 双击触发
  tray.on('click', () => {
    restoreOrCreateWindow()
  })

  // 字典数据就绪后刷新「切换线路」子菜单
  onNetworkNodeUpdated(() => {
    tray.setContextMenu(createContextMenu())
  })

  return tray
}

/**
 * 构建网络线路子菜单
 * 从字典获取可用节点列表，当前选中项通过 store.lastSelectedNetworkNode 持久化
 */
function buildNetworkNodeSubmenu(): Electron.MenuItemConstructorOptions[] {
  const nodes = dictStore.network_node
  const current = store.lastSelectedNetworkNode

  /** 选择线路并刷新托盘菜单 */
  async function selectNode(value: typeof store.lastSelectedNetworkNode) {
    // 测试环境不支持切换线路
    if (isDev) {
      const win = getMainWindow()
      const messageBoxOptions: Electron.MessageBoxOptions = {
        type: 'info',
        title: $t('提示'),
        message: '测试环境不支持切换线路',
        defaultId: 0,
      }
      if (win) {
        await dialog.showMessageBox(win, messageBoxOptions)
      }
      else {
        await dialog.showMessageBox(messageBoxOptions)
      }
      return
    }

    store.lastSelectedNetworkNode = value
    onNetworkNodeChanged()
    tray.setContextMenu(createContextMenu())

    const site = value === 'auto' ? await getProdWebDomain(true) : `https://${value.site}`

    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isVisible()) {
        return
      }
      window.loadURL(site)
    })
  }

  return [
    // 自动选择选项
    {
      label: $t('自动'),
      type: 'radio',
      checked: current === 'auto',
      click: () => selectNode('auto'),
    },
    // 从字典动态生成各节点选项，label 取 gate 主机名首段（如 "hz.gate.roxybrowser.cn" → "hz"）
    ...nodes.map<Electron.MenuItemConstructorOptions>((node, index) => ({
      label: $t('线路 {number}', { number: index + 1 }),
      type: 'radio',
      checked: typeof current === 'object' && current.gate === node.gate,
      click: () => selectNode(node),
    })),
  ]
}

/** 创建托盘菜单 */
function createContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: $t('重启客户端'),
      click: async () => {
        if (store.autoRestoreWindow === 2) {
          await showAutoRestoreWindowDialog()
        }

        // 用户选择了下次启动时恢复窗口
        store.needRestoreWindow = store.autoRestoreWindow === 1

        await forceSaveConfig()

        // 先判断是否有可用更新, 再分支:
        //   有更新 -> 走 autoUpdater.quitAndInstall(), 由 autoUpdater 在合适的时机驱动 quit
        //   无更新 -> 走纯重启路径 app.relaunch() + app.quit(), 不再依赖 setTimeout race
        // macOS 上原先的 `quitAndInstall + setTimeout(1000) + app.relaunch+app.quit`:
        //   - quitAndInstall 是异步的, 可能在 1s 内还没真正接管退出
        //   - autoUpdater 在没有可下载更新时会 reject/no-op, 一旦走到兜底分支,
        //     SIGKILL 杀死 relaunch 中介子进程会导致 macOS 上重启彻底失效
        let hasUpdate = false
        try {
          hasUpdate = await appUpdater.hasUpdate()
        }
        catch (error) {
          console.error('[tray] hasUpdate check failed, fallback to plain relaunch:', error)
        }

        if (hasUpdate) {
          console.log('[tray] restart with update, calling quitAndInstall')
          appUpdater.quitAndInstall().catch((error) => {
            console.error('[tray] quitAndInstall failed, fallback to plain relaunch:', error)
            app.relaunch()
            app.quit()
          })
          return
        }

        console.log('[tray] restart without update, calling relaunch + quit')
        app.relaunch()
        app.quit()
      },
    },
    {
      label: $t('切换线路'),
      submenu: buildNetworkNodeSubmenu(),
    },
    {
      label: $t('显示'),
      click: () => {
        restoreOrCreateWindow()
      },
    },
    {
      label: $t('退出'),
      click: () => {
        tray.destroy()
        closeAllWindows()
        app.quit()
      },
    },
  ])
}

export function getTray() {
  return tray
}

async function showAutoRestoreWindowDialog() {
  // 如果当前没有打开的浏览器，则不显示对话框
  if (browserManager.openedBrowserMap.size === 0) {
    return
  }

  const win = getMainWindow()!

  const { response, checkboxChecked } = await dialog.showMessageBox(
    win,
    {
      type: 'warning',
      buttons: [$t('是'), $t('否')],
      title: $t('提示'),
      message: $t('下一次打开时是否恢复窗口？'),
      checkboxLabel: $t('记住我的选择'),
      checkboxChecked: false,
      defaultId: 0,
    },
  )

  win.setEnabled(true)
  win.focus()
  console.log('showAutoRestoreWindowDialog', response, checkboxChecked)
  const isAutoRestoreWindow = response === 0 ? 1 : 0
  // 记住用户的选择
  if (checkboxChecked) {
    await API.base.userSetUserConfigCreate({
      autoRestoreWindow: isAutoRestoreWindow,
    }).catch(console.error)
  }

  store.autoRestoreWindow = isAutoRestoreWindow
}
