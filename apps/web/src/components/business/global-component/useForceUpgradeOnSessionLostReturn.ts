import { debounce } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { isNewerVersion } from '/@/utils/common'
import { clearSessionLost, isSessionLostOverDelay } from '/@/utils/sessionLost'

/**
 * 监听用户「回到 APP」的行为，在满足条件时触发强制升级弹窗。
 *
 * 触发条件（同时满足）：
 * - 曾掉登录态（sessionStorage 有记录）且已满 1 小时
 * - 当前未登录
 * - 远程版本高于本地版本（compare-versions）
 *
 * 「回到 APP」包括：主窗口聚焦、页面从后台切回、点击/按键等操作。
 */
export function useForceUpgradeOnSessionLostReturn(tryShow: (remoteVersion: string) => void | Promise<void>) {
  const userStore = useUserStore()
  const isChecking = ref(false)

  const debouncedTryShow = debounce(async () => {
    if (!globalThis.isElectron || isChecking.value)
      return

    // 未满 1 小时不弹窗（掉登录态当下也不会弹，需等用户再次使用 APP）
    if (!isSessionLostOverDelay())
      return

    isChecking.value = true
    try {
      const updateInfo = await globalThis.electronAPI.send('app:checkForUpdates')
      const remoteVersion = updateInfo?.version
      const localVersion = userStore.appVersion || await globalThis.electronAPI.send('app:getAppVersion')

      if (!isNewerVersion(remoteVersion, localVersion))
        return

      await tryShow(remoteVersion!)
      // 已展示过，避免每次聚焦都重复弹窗
      clearSessionLost()
    }
    finally {
      isChecking.value = false
    }
  }, 300)

  function onUserReturn() {
    debouncedTryShow()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible')
      onUserReturn()
  }

  onMounted(() => {
    // 主窗口聚焦（Electron 主进程 focus 事件）
    globalThis.electronAPI.on('window:on-focus', onUserReturn)
    // 从其他应用/标签页切回
    document.addEventListener('visibilitychange', onVisibilityChange)
    // 在页面内操作（点击、按键等）
    const interactionEvents = ['click', 'keydown', 'pointerdown'] as const
    for (const event of interactionEvents) {
      document.addEventListener(event, onUserReturn, { capture: true, passive: true })
    }

    // 启动时若已满足条件（例如掉线后很久才打开 APP），也尝试一次
    onUserReturn()
  })

  onBeforeUnmount(() => {
    debouncedTryShow.cancel()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    for (const event of ['click', 'keydown', 'pointerdown'] as const) {
      document.removeEventListener(event, onUserReturn, { capture: true })
    }
  })
}
