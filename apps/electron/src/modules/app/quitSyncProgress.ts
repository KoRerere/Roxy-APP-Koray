import type { QuitSyncProgressMessage } from '@roxy/electron-preload'
import { getMainWindow } from '/@/modules/app/mainWindow'
import { ipcSender } from '/@/modules/ipc/sender'
import { appUpdater } from '/@/modules/updater'

let lastPayload: QuitSyncProgressMessage = { visible: false }
let windowTotal = 0

function emit(partial: Partial<QuitSyncProgressMessage>) {
  lastPayload = { ...lastPayload, ...partial }
  // 进度上报绝不能抛错: 退出过程中窗口/渲染进程可能正在销毁,
  // 一旦抛错会沿 updateQuitSyncProgress -> syncWindowData 循环向上传播, 导致剩余窗口数据同步被中断.
  try {
    ipcSender.app.quitSyncProgress(lastPayload)
  }
  catch (error) {
    console.warn('[quitSyncProgress] send ipc failed (ignored):', error)
  }

  try {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) {
      return
    }
    if (lastPayload.visible && lastPayload.total && lastPayload.total > 0) {
      const { current = 0, total } = lastPayload
      // 单一整体进度: 已完成的加权窗口数 / 总窗口数
      win.setProgressBar(Math.min(1, current / total))
    }
    else {
      win.setProgressBar(-1)
    }
  }
  catch (error) {
    console.warn('[quitSyncProgress] setProgressBar failed (ignored):', error)
  }
}

/** 开始退出/升级/退出登录前的窗口数据同步 (total 为待同步窗口数) */
export function beginQuitSyncProgress(total: number, reason?: QuitSyncProgressMessage['reason']) {
  windowTotal = Math.max(total, 1)
  // 退出/升级可能在主窗口最小化或隐藏到托盘时触发, 这里确保进度遮罩可见
  try {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.setSkipTaskbar(false)
      if (win.isMinimized()) {
        win.restore()
      }
      win.show()
      win.focus()
    }
  }
  catch (error) {
    console.warn('[quitSyncProgress] show main window failed (ignored):', error)
  }
  emit({
    visible: true,
    reason: reason ?? (appUpdater.isQuittingForUpdate ? 'update' : 'quit'),
    current: 0,
    total: windowTotal,
  })
}

/**
 * 更新整体同步进度.
 * units 为「已完成的加权窗口数」: 单个窗口关闭+OSS 完成计 0.7, 接口同步了结再 +0.3, 满 1.0.
 * 因此 units 可能为小数, 前端按 round 显示 x/total, 进度条用 units/total。
 */
export function updateQuitSyncProgress(units: number, total?: number) {
  if (!lastPayload.visible) {
    return
  }
  const totalValue = total ?? windowTotal
  emit({
    // clamp: 分子不超过分母, 避免重复累加导致进度越界
    current: Math.min(Math.max(units, 0), totalValue),
    total: totalValue,
  })
}

/** 结束进度展示 */
export function finishQuitSyncProgress() {
  emit({ visible: false, current: 0, total: 0 })
}
