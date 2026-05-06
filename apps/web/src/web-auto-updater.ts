/**
 * Web/PWA：vite-plugin-pwa 检测到新版本时展示刷新横幅；
 * 含「关闭后静默再提示」与「新版本就绪且长时间无操作则自动刷新」。
 */
import { registerSW } from 'virtual:pwa-register'

let checkSWUpdate = () => { }
/**
 * 空闲自动刷新：SW 已有 waiting 版本（已下载、待接管）时，
 * 若页面连续无用户交互超过此时长，则自动调用 updateWeb，避免长期停留在旧版本。
 */
const WEB_IDLE_AUTO_UPDATE_MS = 15 * 60 * 1000

/** 是否存在「新版本已就绪但未 activate」的 waiting worker；为 true 时空闲倒计时生效 */
let hasPendingWebUpdate = false
const initTime = Date.now()

/** 空闲自动刷新定时器：到时且无新的交互则执行 updateWeb */
let idleAutoUpdateTimer: ReturnType<typeof setTimeout> | undefined
/** 卸载空闲监听时移除 window 上的交互事件 */
let idleActivityCleanup: (() => void) | undefined

/** 任意一次视为「有操作」后，重新从当前时刻起算空闲时长 */
function resetIdleAutoUpdateTimer() {
  if (!hasPendingWebUpdate)
    return

  if (idleAutoUpdateTimer)
    clearTimeout(idleAutoUpdateTimer)

  idleAutoUpdateTimer = setTimeout(() => {
    idleAutoUpdateTimer = undefined
    if (hasPendingWebUpdate)
      void updateWeb()
  }, WEB_IDLE_AUTO_UPDATE_MS)
}

/** 用户主动刷新、空闲到时刷新或组件卸载时：关闭倒计时并卸下监听 */
function stopIdleAutoUpdate() {
  hasPendingWebUpdate = false
  if (idleAutoUpdateTimer) {
    clearTimeout(idleAutoUpdateTimer)
    idleAutoUpdateTimer = undefined
  }
  idleActivityCleanup?.()
  idleActivityCleanup = undefined
}

/**
 * onNeedRefresh 表示插件检测到可更新的 SW（通常已进入 installing/waiting）。
 * 仅注册一次监听：页面有任何典型交互则重置空闲窗口（时长见 WEB_IDLE_AUTO_UPDATE_MS）。
 */
function startIdleAutoUpdateIfNeeded() {
  if (hasPendingWebUpdate && idleActivityCleanup)
    return

  hasPendingWebUpdate = true

  // passive：滚动/触摸等不阻塞主线程；涵盖常见「用户在用页面」信号
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'pointerdown'] as const
  const onActivity = () => resetIdleAutoUpdateTimer()

  activityEvents.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }))
  idleActivityCleanup = () => {
    activityEvents.forEach(evt => window.removeEventListener(evt, onActivity))
  }

  resetIdleAutoUpdateTimer()
}

// 显式注册 SW，才能接到 vite-plugin-pwa 的更新提示回调。
const updateSW = registerSW({
  async onNeedRefresh() {
    console.log('onNeedRefresh')

    // 如果页面初始化后，3 秒内收到更新，新版本已下载但未激活，则立即刷新页面
    if (Date.now() - initTime < 1000 * 3) {
      updateWeb()
      return
    }

    // 非「冷启动立即刷新」场景：后台已有新版本，开启空闲自动更新以防用户忽略横幅
    startIdleAutoUpdateIfNeeded()
  },
  onRegisteredSW(swUrl, registration) {
    console.log('onRegisteredSW', swUrl, registration)
    /**
     * 周期性触发 registration.update()，便于尽早发现服务端新 SW（仍须用户刷新或空闲策略才会接管）。
     */
    checkSWUpdate = async () => {
      if (!(!registration?.installing && navigator))
        return
      if ('connection' in navigator && !navigator.onLine)
        return
      await registration?.update()
    }
    setInterval(checkSWUpdate, 60 * 1000)
  },
})

/** skipWaiting + 刷新页面；开始前清理空闲逻辑，避免重复触发 */
async function updateWeb() {
  stopIdleAutoUpdate()
  await updateSW(true)
}
