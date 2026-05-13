/**
 * 网页版：连续 15 分钟无用户操作后请求 `/version`，若远程版本高于构建时的
 * `import.meta.env.VITE_VERSION`（semver），则刷新页面以加载新资源。
 *
 * 仅由 main.ts 在浏览器网页分支中动态加载，Electron 壳内不执行。
 */
import { compareVersions } from 'compare-versions'

const IDLE_MS = (import.meta.env.DEV ? 2 : 15) * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'pointerdown'] as const

let idleTimer: ReturnType<typeof setTimeout> | undefined
let started = false

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

function resetIdleTimer() {
  if (idleTimer)
    clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    idleTimer = undefined
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
