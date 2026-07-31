/**
 * 网页版：连续 15 分钟无用户操作后请求 `/version`，若远程版本高于构建时的
 * `import.meta.env.VITE_VERSION`（semver），则刷新页面以加载新资源。
 *
 * 仅由 main.ts 在浏览器网页分支中动态加载，Electron 壳内不执行。
 */
import { compareVersions } from 'compare-versions'

const IDLE_MS = (import.meta.env.DEV ? 5 : 15) * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'pointerdown'] as const

let idleTimer: ReturnType<typeof setTimeout> | undefined
let started = false
/** 与主进程 appIdleState 对齐，仅在状态变化时发 IPC，避免 mousemove 等高频事件刷屏 */
let isIdle = false

function getLocalVersion(): string {
  return String(import.meta.env.VITE_VERSION ?? '').trim()
}

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok)
      return null
    const text = (await res.text()).trim()
    return text || null
  }
  catch {
    return null
  }
}

async function checkAndReloadIfStale() {
  const local = getLocalVersion()
  if (!local)
    return

  const remote = await fetchRemoteVersion()
  if (!remote)
    return

  try {
    if (compareVersions(local, remote) < 0)
      window.location.reload()
  }
  catch {
    // 非 semver 或 compare-versions 无法解析时忽略
  }
}

function setIdleState(idle: boolean) {
  if (isIdle === idle)
    return
  isIdle = idle
  // 从 4.0.0 版本开始，闲时自动安装新版本功能下线：https://zbvt20250214083819453.pingcode.com/pjm/workitems/P93maFCY
  // globalThis.electronAPI.send('app:setIdleState', idle).catch(() => {
  //   console.info('need app version 3.8.7')
  // })
}

function resetIdleTimer() {
  if (idleTimer)
    clearTimeout(idleTimer)

  setIdleState(false)

  idleTimer = setTimeout(() => {
    idleTimer = undefined
    setIdleState(true)
    void checkAndReloadIfStale()
  }, IDLE_MS)
}

function onActivity() {
  resetIdleTimer()
}

function start() {
  if (started)
    return
  started = true

  ACTIVITY_EVENTS.forEach(evt =>
    window.addEventListener(evt, onActivity, { passive: true }),
  )

  resetIdleTimer()
}

start()
