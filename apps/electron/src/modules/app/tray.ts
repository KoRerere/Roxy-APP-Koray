import { app, BrowserWindow, dialog, Menu, MenuItem, nativeImage, Tray } from 'electron'
import path from 'node:path'
import { setTimeout as setTimeoutPromise } from 'node:timers/promises'
import { API } from '/@/api'
import { onNetworkNodeChanged } from '/@/api/getGatewayConfig'
import { isDev, isWindows } from '/@/constants/common'
import { getMainWindow, restoreOrCreateWindow } from '/@/modules/app/mainWindow'
import { isCustomProxyConfigured, proxyManager } from '/@/modules/app/proxy-manager'
import { relaunchApp } from '/@/modules/app/relaunch'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { browserManager } from '/@/modules/browser'
import { dictStore, onNetworkNodeUpdated } from '/@/modules/dict'
import { forceSaveConfig, store } from '/@/modules/store'
import { appUpdater } from '/@/modules/updater'
import { getProdWebDomain } from '/@/utils/getProdWebDomain'
import { formatAutoGateLatency, formatGateLatency, onGateLatencyUpdated, onProbeBatchComplete, refreshNodeLatencies } from '/@/utils/probe-gate-latency'

let tray: Tray
let trayContextMenu: Menu
let isTrayMenuOpen = false

/** gate -> 线路菜单项，用于异步更新延迟文案 */
const nodeMenuItems = new Map<string, { item: MenuItem, index: number }>()
/** 自动线路菜单项 */
let autoMenuItem: MenuItem | null = null

function getAutoLineLabel() {
  return `${$t('自动')} ${formatAutoGateLatency()}`
}

function getNodeLineLabel(index: number, gate: string) {
  return `${$t('线路 {number}', { number: index + 1 })} ${formatGateLatency(gate)}`
}

function syncAllNodeMenuLabels() {
  autoMenuItem && (autoMenuItem.label = getAutoLineLabel())
  nodeMenuItems.forEach(({ item, index }, gate) => {
    item.label = getNodeLineLabel(index, gate)
  })
}

/** 菜单即将展示时异步探测延迟，不阻塞菜单弹出 */
function probeLatenciesOnMenuShow() {
  // Windows 原生菜单改 label 不会重绘，文案在关闭菜单或探测完成后重建；macOS/Linux 可实时改 label
  if (process.platform !== 'win32') {
    syncAllNodeMenuLabels()
  }
  // setContextMenu 会接管右键，tray right-click 不一定触发，改由 menu-will-show 驱动
  refreshNodeLatencies()
}

/** Windows 用最新缓存重建菜单，供下次打开时展示；打开期间不 repop，避免子菜单位置跳动 */
function rebuildTrayContextMenuFromCache() {
  if (process.platform !== 'win32')
    return
  setTrayContextMenu()
}

function handleGateLatencyUpdated(_gate: string) {
  if (process.platform === 'win32')
    return
  autoMenuItem && (autoMenuItem.label = getAutoLineLabel())
  const entry = nodeMenuItems.get(_gate)
  if (entry) {
    entry.item.label = getNodeLineLabel(entry.index, _gate)
  }
}

/** 菜单关闭后或探测完成且菜单已关时重建，保证下次打开看到最新延迟 */
function handleProbeBatchComplete() {
  if (!isTrayMenuOpen) {
    rebuildTrayContextMenuFromCache()
  }
}

function setTrayContextMenu() {
  trayContextMenu = createContextMenu()
  tray?.setContextMenu(trayContextMenu)
}

/** 刷新托盘菜单（APP 网络配置变更后更新自定义代理 disabled 状态） */
export function refreshTrayContextMenu() {
  if (!tray) {
    return
  }
  setTrayContextMenu()
}

function createTrayIcon() {
  const resourcesDir = path.join(import.meta.dirname, '..', 'resources')
  if (process.platform === 'darwin') {
    // macOS 菜单栏：22/44px Template PNG + 透明底，系统会自动加载 @2x 并适配深浅色
    const image = nativeImage.createFromPath(path.join(resourcesDir, 'roxy-trayTemplate.png'))
    image.setTemplateImage(true)
    return image
  }
  return nativeImage.createFromPath(path.join(resourcesDir, 'roxy-tray.png'))
}

/** 创建托盘 */
export async function createTray() {
  await setTimeoutPromise()
  if (isUninstallFeedbackMode) {
    return
  }
  // 如果已经创建过托盘，直接返回
  if (tray) {
    return tray
  }

  // 新建托盘
  tray = new Tray(createTrayIcon())
  // 托盘名称
  tray.setToolTip(app.getName())

  setTrayContextMenu()

  // 双击触发
  tray.on('click', () => {
    restoreOrCreateWindow()
  })

  onGateLatencyUpdated(handleGateLatencyUpdated)
  onProbeBatchComplete(handleProbeBatchComplete)

  // 初始化时探测一次线路延迟
  refreshNodeLatencies()

  // 字典数据就绪后重建菜单并重新探测
  onNetworkNodeUpdated(() => {
    setTrayContextMenu()
    refreshNodeLatencies()
  })

  return tray
}

/**
 * 构建网络线路子菜单
 * 从字典获取可用节点列表，当前选中项通过 store.lastSelectedNetworkNode 持久化
 */
function buildNetworkNodeSubmenu(): Menu {
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
    setTrayContextMenu()

    const site = value === 'auto' ? await getProdWebDomain(true) : `https://${value.site}`

    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isVisible()) {
        return
      }
      window.loadURL(site)
    })
  }

  nodeMenuItems.clear()
  autoMenuItem = null

  autoMenuItem = new MenuItem({
    label: getAutoLineLabel(),
    type: 'radio',
    checked: current === 'auto',
    click: () => selectNode('auto'),
  })

  const nodeItems = nodes.map((node, index) => {
    const item = new MenuItem({
      label: getNodeLineLabel(index, node.gate),
      type: 'radio',
      checked: typeof current === 'object' && current.gate === node.gate,
      click: () => selectNode(node),
    })
    nodeMenuItems.set(node.gate, { item, index })
    return item
  })

  const menu = new Menu()
  menu.append(autoMenuItem)
  nodeItems.forEach(item => menu.append(item))
  return menu
}

/**
 * 构建 APP 网络设置子菜单
 */
function buildAppNetworkSubmenu(): Menu {
  const current = store.appNetwork ?? 'local'
  const customConfigured = isCustomProxyConfigured()

  async function selectNetwork(mode: typeof store.appNetwork) {
    store.appNetwork = mode
    await proxyManager.applyAppNetwork()
    setTrayContextMenu()
  }

  const menu = new Menu()
  menu.append(new MenuItem({
    label: $t('本地网络'),
    type: 'radio',
    checked: current === 'local',
    click: () => selectNetwork('local'),
  }))
  menu.append(new MenuItem({
    label: $t('系统代理'),
    type: 'radio',
    checked: current === 'system',
    click: () => selectNetwork('system'),
  }))
  menu.append(new MenuItem({
    label: $t('自定义代理'),
    type: 'radio',
    checked: current === 'custom',
    enabled: customConfigured,
    click: () => selectNetwork('custom'),
  }))
  return menu
}

/** 创建托盘菜单 */
function createContextMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: $t('重启'),
      click: async () => {
        if (store.autoRestoreWindow === 2) {
          await showAutoRestoreWindowDialog()
        }

        // 用户选择了下次启动时恢复窗口
        store.needRestoreWindow = store.autoRestoreWindow === 1

        await forceSaveConfig()

        // 重启时是否走安装:
        // - Windows: 托盘重启默认带 skipPendingUpdate，会跳过冷启动安装；forceUpgrade 时必须当场 upgradeNow，
        //   若本会话尚未 hydrate 已下载包，则不带 skip 重启，交给下次冷启动安装
        // - 非 Windows: 有可用更新则 quitAndInstall（含 forceUpgrade / 普通自动更新）
        let shouldUpgradeOnRestart = false
        if (isWindows) {
          if (appUpdater.isForceUpgradePending()) {
            if (appUpdater.getUpdateMessageData().status === 'downloaded') {
              shouldUpgradeOnRestart = true
            }
            else {
              console.log('[tray] forceUpgrade pending without hydrated package, relaunch without skip')
              relaunchApp({ skipPendingUpdate: false })
              return
            }
          }
        }
        else {
          // macOS 上原先的 `quitAndInstall + setTimeout(1000) + app.relaunch+app.quit`:
          //   - quitAndInstall 是异步的, 可能在 1s 内还没真正接管退出
          //   - autoUpdater 在没有可下载更新时会 reject/no-op, 一旦走到兜底分支,
          //     SIGKILL 杀死 relaunch 中介子进程会导致 macOS 上重启彻底失效
          try {
            shouldUpgradeOnRestart = await appUpdater.hasUpdate()
          }
          catch (error) {
            console.error('[tray] hasUpdate check failed, fallback to plain relaunch:', error)
          }
        }

        if (shouldUpgradeOnRestart) {
          console.log('[tray] restart with update, calling upgradeNow')
          appUpdater.upgradeNow().catch((error) => {
            console.error('[tray] upgradeNow failed, fallback to relaunch:', error)
            // Windows 强制升级失败时不带 skip，让下次冷启动仍能装上
            relaunchApp({ skipPendingUpdate: isWindows ? !appUpdater.isForceUpgradePending() : true })
          })
          return
        }

        console.log('[tray] restart without update, calling relaunch + quit')
        relaunchApp({ skipPendingUpdate: true })
      },
    },
    {
      label: $t('刷新'),
      click: () => {
        getMainWindow()?.reload()
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
        // 不在此处销毁窗口/托盘: forceUpgrade 时走 upgradeNow，否则交给 before-quit 同步后退出
        appUpdater.quitApp()
      },
    },
  ])

  menu.on('menu-will-show', () => {
    isTrayMenuOpen = true
    probeLatenciesOnMenuShow()
  })
  menu.on('menu-will-close', () => {
    isTrayMenuOpen = false
    rebuildTrayContextMenuFromCache()
  })

  return menu
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
