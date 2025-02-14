import { preferenceSettings, PreferenceSettings } from "/@/modules/sync-control/model"
import { API } from "/@/api"
import { globalShortcut } from "electron"
import { SyncControlUtil } from "/@/modules/sync-control/util"
import { ipcMain } from "/@/modules/ipc"
import { openBatchInputsDialog } from "/@/modules/sync-control/dialog/batch-inputs"
import { openOpenSitesDialog } from "/@/modules/sync-control/dialog/open-sites"
import { openSyncingWindowList } from "/@/modules/sync-control/dialog/syncing-window-list"
import { openPreferencesDialog } from "/@/modules/sync-control/dialog/preferences"

type ShortcutKey = keyof PreferenceSettings['shortcutKey']['windows']

export type ShortcutKeyRegisterResult = Record<ShortcutKey, { accelerator: string, status: boolean }>

const platform = process.platform === 'darwin' ? 'mac' : 'windows'

const originShortcutKey = preferenceSettings.shortcutKey[platform]

/** 快捷键绑定 */
const shortcutKeyBindingMap: Record<ShortcutKey, string> = {
  ...originShortcutKey,
}

const shortcutKeyCallbackMap: Record<ShortcutKey, () => any> = {
  /** 开始同步 */
  // startSync: () => {
  //   console.log('开始同步 的快捷键被触发')
  //   ipcMain.send('syncControl:start')
  // },
  /** 停止同步 */
  stopSync: () => {
    console.log('停止同步 的快捷键被触发')
    SyncControlUtil.stop()
  },
  /** 显示所有窗口 */
  showAllWindows: () => {
    console.log('显示所有窗口 的快捷键被触发')
    SyncControlUtil.showAllWindows()
  },
  /** 窗口排列 - 宫格布局 */
  gridLayout: () => {
    console.log('窗口排列 的快捷键被触发')
    SyncControlUtil.doLayout({ type: 'grid' })
  },
  /** 窗口排列 - 堆叠布局 */
  stackLayout: () => {
    console.log('窗口排列 的快捷键被触发')
    SyncControlUtil.doLayout({ type: 'stack' })
  },
  /** 批量输入 */
  openBatchInputDialog: () => {
    console.log('批量输入 的快捷键被触发')
    openBatchInputsDialog()
  },
  /** 延迟点击 开/关 */
  // toggleClickDelay: () => {
  //   console.log('延迟点击 开/关 的快捷键被触发')
  //   ipcMain.send('syncControl:toggleClickDelay')
  // },
  /** 延迟输入 开/关 */
  // toggleInputDelay: () => {
  //   console.log('延迟输入 开/关 的快捷键被触发')
  //   ipcMain.send('syncControl:toggleInputDelay')
  // },
  /** 相同文本输入 */
  // openSameTextDialog: () => {
  //   console.log('相同文本输入 的快捷键被触发')
  //   openBatchInputsDialog({ tab: 'same' })
  // },
  // /** 随机数字输入 */
  // openRandomNumberDialog: () => {
  //   console.log('随机数字输入 的快捷键被触发')
  //   openBatchInputsDialog({ tab: 'random' })
  // },
  /** 统一标签页 */
  // unifiedTabs: () => {
  //   console.log('统一标签页 的快捷键被触发')
  //   SyncControlUtil.unifyTabs()
  // },
  /** 关闭其他标签页 */
  closeOtherTabs: () => {
    console.log('关闭其他标签页 的快捷键被触发')
    SyncControlUtil.closeOtherTabs()
  },
  /** 关闭当前标签页 */
  closeCurrentTab: () => {
    console.log('关闭当前标签页 的快捷键被触发')
    SyncControlUtil.closeCurrentTab()
  },
  /** 关闭空白标签页 */
  closeBlankTabs: () => {
    console.log('关闭空白标签页 的快捷键被触发')
    SyncControlUtil.closeBlankTabs()
  },
  /** 显示同步窗口列表 */
  openSyncWindowList: () => {
    console.log('显示同步窗口列表 的快捷键被触发')
    openSyncingWindowList()
  },
  /** 打开网址 */
  openSites: () => {
    console.log('打开网址 的快捷键被触发')
    openOpenSitesDialog()
  },
  /** 同步偏好设置 */
  openPreferenceSettings: () => {
    console.log('同步偏好设置 的快捷键被触发')
    openPreferencesDialog()
  },
}

/** 注册全局快捷键 */
export async function registerGlobalShortcut(shortcutKey?: PreferenceSettings['shortcutKey']) {
  // 如果没有传入快捷键，则从用户配置中获取
  if (!shortcutKey) {
    // 获取用户配置
    const { code, data } = await API.base.userGetUserConfigList()
    const remotePreferenceSettings = data.preferenceSettings as PreferenceSettings
    shortcutKey = {
      ...preferenceSettings.shortcutKey,
      ...remotePreferenceSettings?.shortcutKey,
    }
  }

  /** 解绑之前的绑定关系 */
  Object.values(shortcutKeyBindingMap).forEach(accelerator => {
    if (accelerator) {
      accelerator = accelerator.split(' + ').join('+')
      globalShortcut.unregister(accelerator)
    }
  })

  const shortcutKeys = shortcutKey[platform]
  console.log('shortcutKeys:', shortcutKeys)
  const registerResult = Object.entries(shortcutKeys).reduce((acc, [key, value]) => {
    if (!value) {
      acc[key] = {
        accelerator: '',
        status: false
      }
      return acc
    }

    const accelerator = value.split(' + ').join('+')
    acc[key] = {
      accelerator,
      status: shortcutKeyCallbackMap[key] ? globalShortcut.register(accelerator, shortcutKeyCallbackMap[key]) : false
    }
    return acc
  }, {} as ShortcutKeyRegisterResult)

  Object.assign(shortcutKeyBindingMap, shortcutKeys)

  console.log('窗口同步器快捷键注册结果:', registerResult)
  return registerResult
}

/** 检测指定的快捷键是否已被占用 */
export function checkShortcutKeysIsOccupied(shortcutKey: PreferenceSettings['shortcutKey']) {
  const shortcutKeys = shortcutKey[platform]

  return Object.entries(shortcutKeys).reduce((acc, [key, value]) => {

    if (!value) {
      acc[key] = {
        accelerator: '',
        status: false
      }
      return acc
    }

    const accelerator = value.split(' + ').join('+')

    // globalShortcut.register 方法会返回一个布尔值，指示快捷键是否成功注册。
    // 如果返回 false，意味着该快捷键可能已经被其他应用占用。虽然这不是一个完美的检测方法，但它是 Electron 提供的唯一方式。
    const status = globalShortcut.isRegistered(accelerator) || globalShortcut.register(accelerator, shortcutKeyCallbackMap[key])

    acc[key] = {
      accelerator,
      // status 为 true 时表示快捷键未被占用
      status
    }

    // 如果不是注册过的快捷键，则检测完成后解绑
    if (status && shortcutKeyBindingMap[key] !== value) {
      globalShortcut.unregister(accelerator)
    }

    return acc
  }, {} as ShortcutKeyRegisterResult)
}
