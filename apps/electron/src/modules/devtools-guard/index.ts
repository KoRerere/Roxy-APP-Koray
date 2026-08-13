import type { Input, WebContents } from 'electron'
import { app, BrowserWindow } from 'electron'
import { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'
import inspector from 'node:inspector'
import { ROXY_MAIN_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { isDev, isPackaged } from '/@/constants/common'
import { relaunchApp } from '/@/modules/app/relaunch'
import { promptDevToolsSecret } from './unlockWindow'

/**
 * 内置解锁口令的 sha256，源码中不出现明文，避免直接被检索到。
 */
const UNLOCK_SECRET_HASH = 'e2a32ae208a9e553bf769e0169e47d92a251dc2c9bcc95242e093244349bcd3e'

/** 连击触发解锁弹窗所需的次数 */
const UNLOCK_COMBO_HITS = 5
/** 连击有效窗口期（毫秒），超时则重新计数 */
const UNLOCK_COMBO_WINDOW_MS = 3000

/**
 * 诊断模式启动参数，值为 mintDiagnosticsToken() 生成的时效令牌。
 *
 * 令牌由口令 hash 与时间片派生，没有口令无法伪造，且很快过期，
 * 因此这个参数本身不构成"任何人加个启动参数就能开 DevTools"的口子。
 */
const DIAGNOSTICS_ARG = '--roxy-diagnostics'

/**
 * Node 网络检查开关。
 *
 * 这是 Node CLI flag 而非 Chromium switch：app.commandLine.appendSwitch 对它无效，
 * 也不允许放进 NODE_OPTIONS，只有在进程启动时出现在 argv 上才会让 http/https
 * 模块向 inspector 广播 Network 域事件，所以进入诊断模式必须重启进程。
 *
 * @see https://www.electronjs.org/docs/latest/api/command-line-switches#--experimental-network-inspection
 */
const NETWORK_INSPECTION_FLAG = '--experimental-network-inspection'

/** 令牌有效期（毫秒），过期后需要重新走连击 + 口令流程 */
const DIAGNOSTICS_TOKEN_TTL_MS = 10 * 60 * 1000

/** 按时间片派生诊断令牌 */
function deriveDiagnosticsToken(timeSlice: number) {
  return createHash('sha256').update(`${UNLOCK_SECRET_HASH}:${timeSlice}`, 'utf8').digest('hex')
}

/** 签发当前时间片的诊断令牌 */
function mintDiagnosticsToken() {
  return deriveDiagnosticsToken(Math.floor(Date.now() / DIAGNOSTICS_TOKEN_TTL_MS))
}

/** 校验 argv 中的诊断令牌；容忍一个时间片的偏移，避免恰好跨片时重启失败 */
function hasValidDiagnosticsToken() {
  const raw = process.argv.find(arg => arg.startsWith(`${DIAGNOSTICS_ARG}=`))?.slice(DIAGNOSTICS_ARG.length + 1)
  if (!raw) {
    return false
  }

  const actual = Buffer.from(raw, 'utf8')
  const currentSlice = Math.floor(Date.now() / DIAGNOSTICS_TOKEN_TTL_MS)
  return [currentSlice, currentSlice - 1].some((timeSlice) => {
    const expected = Buffer.from(deriveDiagnosticsToken(timeSlice), 'utf8')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  })
}

/**
 * 解锁状态。启动时可能已由上一个进程带着有效令牌重启进入诊断模式，
 * 运行中也可以通过连击 + 口令就地翻转。
 *
 * 之所以允许运行时翻转，是因为锁定不再依赖创建期不可变的
 * webPreferences.devTools，而是由 setupDevToolsGuard 在 JS 层维持，
 * 因此不存在"窗口已创建但能力对不上"的中间态，无需重建窗口。
 */
let unlocked = hasValidDiagnosticsToken()

/** 解锁弹窗是否已在展示中，避免连击过程中重复弹出 */
let unlockPromptOpen = false

/**
 * 客户端主界面的开发者工具是否处于可用状态。
 *
 * 未打包时恒为 true，保证日常开发体验不变；打包版默认关闭，
 * 仅在开发人员通过隐藏连击 + 口令进入诊断模式后才放开。
 */
export function isDevToolsUnlocked() {
  return !isPackaged || unlocked
}

/** Node 网络检查是否已在本进程生效（决定 DevTools 里有没有 Network 数据） */
export function isNetworkInspectionEnabled() {
  return process.argv.includes(NETWORK_INSPECTION_FLAG)
}

/**
 * 按需开启主进程 Node 调试器。
 *
 * 打包版默认不监听任何调试端口（9238 等），只有诊断模式下才主动开启，
 * 因此正式发布版启动后不存在可连接的 Node 调试接口。
 */
export function enableInspector() {
  if (!isDevToolsUnlocked()) {
    return
  }

  try {
    if (inspector.url()) {
      console.log('[DevToolsGuard] inspector already enabled:', inspector.url())
      return
    }

    const port = isDev ? 9237 : 9238
    inspector.open(port, '127.0.0.1', false)
    console.debug(`[DevToolsGuard] inspector started on ws://127.0.0.1:${port}, networkInspection=${isNetworkInspectionEnabled()}`)
  }
  catch (error) {
    console.warn('[DevToolsGuard] failed to enable inspector:', error)
  }
}

/**
 * 会让进程开放 Node 调试端口的启动参数。
 *
 * 逐个列举而不用 startsWith('--inspect') 前缀匹配，是为了不误伤
 * --experimental-network-inspection（诊断模式自己要用的 flag）。
 */
const NODE_DEBUG_FLAGS = new Set([
  '--inspect',
  '--inspect-brk',
  '--inspect-brk-node',
  '--inspect-port',
  '--inspect-publish-uid',
  '--debug',
  '--debug-brk',
  '--debug-port',
])

/** 会让 Chromium 开放 CDP 接口的启动开关（不带 -- 前缀，供 removeSwitch 使用） */
const CHROMIUM_DEBUG_SWITCHES = [
  'remote-debugging-port',
  'remote-debugging-pipe',
  'remote-debugging-address',
]

/** 取参数名部分，忽略 =value 与大小写差异 */
function normalizeArgName(arg: string) {
  return arg.split('=')[0].toLowerCase()
}

/**
 * 忽略命令行传入的调试参数，防止 `RoxyBrowser.exe --inspect` 这类方式
 * 绕过开发者工具限制。必须在主进程最早期调用。
 *
 * Node 的 --inspect 由 Electron 二进制在加载 app 代码之前就解析完成，
 * 端口此时已经监听，JS 层无法阻止其开启，只能立刻 close 把它摘掉；
 * Chromium 的 remote-debugging 服务则晚于主脚本启动，removeSwitch
 * 能赶在监听之前生效，端口根本不会打开。
 */
export function ignoreDebugStartupArgs() {
  // 未打包时日常开发依赖 --inspect 调试；诊断模式是开发人员主动解锁的，同样放行
  if (!isPackaged || unlocked) {
    return
  }

  const hitFlags = process.argv.filter(arg => NODE_DEBUG_FLAGS.has(normalizeArgName(arg)))

  for (const name of CHROMIUM_DEBUG_SWITCHES) {
    if (app.commandLine.hasSwitch(name)) {
      app.commandLine.removeSwitch(name)
      hitFlags.push(`--${name}`)
    }
  }

  // NODE_OPTIONS=--inspect 不出现在 argv 里，靠 inspector.url() 兜住这条旁路
  const inspectorUrl = inspector.url()
  if (inspectorUrl) {
    try {
      inspector.close()
    }
    catch (error) {
      console.warn('[DevToolsGuard] failed to close inspector:', error)
    }
  }

  if (hitFlags.length > 0 || inspectorUrl) {
    console.warn(`[DevToolsGuard] remote debugging is not allowed, ignored: ${hitFlags.join(' ') || 'NODE_OPTIONS'}`)
  }
}

/** 是否为打开开发者工具的快捷键（含 Windows/Linux 与 macOS 两套组合） */
function isDevToolsShortcut(input: Input) {
  if (input.type !== 'keyDown') {
    return false
  }

  const key = input.key?.toLowerCase?.() ?? ''

  // F12：Windows/Linux 主要入口
  if (key === 'f12') {
    return true
  }

  // Ctrl+Shift+I / J / C
  if (input.control && input.shift && ['i', 'j', 'c'].includes(key)) {
    return true
  }

  // macOS：Command+Option+I / J / C，以及 Command+Option+U（查看源代码）
  if (input.meta && input.alt && ['i', 'j', 'c', 'u'].includes(key)) {
    return true
  }

  return false
}

/** 是否为隐藏解锁连击键：Ctrl/Cmd + Alt + Shift + D */
function isUnlockComboKey(input: Input) {
  return input.type === 'keyDown'
    && (input.control || input.meta)
    && input.alt
    && input.shift
    && input.key?.toLowerCase?.() === 'd'
}

/** 切换指定 webContents 的开发者工具 */
function toggleDevTools(webContents: WebContents) {
  if (webContents.isDevToolsOpened()) {
    webContents.closeDevTools()
  }
  else {
    webContents.openDevTools({ mode: 'detach' })
  }
}

/**
 * 给单个 webContents 挂上开发者工具拦截。
 *
 * 窗口一律以 devTools: true 创建（该项创建后不可改，若关掉就只能靠重建窗口
 * 才能解锁），因此锁定完全由这里维持：
 * - 替换 openDevTools 为锁定态空操作，程序调用被静默拦下，不会先弹出再关闭；
 * - devtools-opened 兜住绕过 openDevTools 的路径，代价是有一次短暂闪烁；
 * - 快捷键一律吞掉，解锁态下则由这里补上被移除的应用菜单带走的 accelerator。
 */
function guardWebContents(webContents: WebContents) {
  const openDevTools = webContents.openDevTools.bind(webContents)
  webContents.openDevTools = (options) => {
    if (isDevToolsUnlocked()) {
      openDevTools(options)
    }
  }

  webContents.on('before-input-event', (event, input) => {
    if (!isDevToolsShortcut(input)) {
      return
    }

    event.preventDefault()

    if (isDevToolsUnlocked()) {
      toggleDevTools(webContents)
    }
  })

  webContents.on('devtools-opened', () => {
    if (!isDevToolsUnlocked()) {
      webContents.closeDevTools()
    }
  })
}

/**
 * 全局挂载开发者工具拦截，必须早于任何窗口创建。
 *
 * 走 web-contents-created 而非在 createWindow 里逐个调用，是为了覆盖
 * 弹窗、WebContentsView 等所有入口，避免漏挂。
 */
export function setupDevToolsGuard() {
  app.on('web-contents-created', (_event, webContents) => {
    // 开发者工具自身的 webContents 不需要也不应该被拦截。
    // Electron 类型定义未收录 'devtools' 这个运行时取值，故先放宽为 string 再比较
    if ((webContents.getType() as string) === 'devtools') {
      return
    }

    guardWebContents(webContents)
  })
}

/**
 * 为指定 webContents 启用隐藏解锁连击，仅主窗口调用。
 *
 * 与 guardWebContents 分开注册：若和快捷键拦截共用一个 before-input-event
 * 回调，主窗口会因全局挂载而被绑定两次，解锁态下按一次 F12 会切换两回。
 */
export function enableUnlockCombo(webContents: WebContents) {
  let comboHits = 0
  let comboFirstHitAt = 0

  webContents.on('before-input-event', (event, input) => {
    if (!isUnlockComboKey(input)) {
      return
    }

    event.preventDefault()
    const now = Date.now()
    // 超出窗口期视为新一轮连击
    if (now - comboFirstHitAt > UNLOCK_COMBO_WINDOW_MS) {
      comboHits = 0
      comboFirstHitAt = now
    }
    comboHits++
    if (comboHits >= UNLOCK_COMBO_HITS) {
      comboHits = 0
      comboFirstHitAt = 0
      void handleUnlockPrompt()
    }
  })
}

/** 口令是否正确 */
function isCorrectSecret(secret: string) {
  return createHash('sha256').update(secret.trim(), 'utf8').digest('hex') === UNLOCK_SECRET_HASH
}

/**
 * 弹出口令输入窗，校验通过后进入诊断模式。
 *
 * 勾选网络抓包时才重启：--experimental-network-inspection 只在进程启动时
 * 被 Node 解析，活着的进程无法补上。否则就地翻转开关即可，不动窗口。
 */
async function handleUnlockPrompt() {
  if (isDevToolsUnlocked() || unlockPromptOpen) {
    return
  }

  unlockPromptOpen = true
  try {
    const { secret, networkInspection } = await promptDevToolsSecret()
    if (!secret || !isCorrectSecret(secret)) {
      // 口令错误不给任何反馈，避免暴露入口存在
      return
    }

    if (networkInspection) {
      console.log('[DevToolsGuard] entering diagnostics mode with network inspection, relaunching')
      relaunchApp({
        skipPendingUpdate: true,
        leadingArgs: [NETWORK_INSPECTION_FLAG, `${DIAGNOSTICS_ARG}=${mintDiagnosticsToken()}`],
        dropArgPrefixes: [NETWORK_INSPECTION_FLAG, DIAGNOSTICS_ARG],
      })
      return
    }

    unlocked = true
    console.log('[DevToolsGuard] entering diagnostics mode without restart')
    enableInspector()

    // 直接按窗口 ID 找主窗口，避免 import /@/utils/browser-window 造成循环依赖
    const mainWindow = BrowserWindow.getAllWindows()
      .find(win => win[ROXY_WINDOW_ID_KEY] === ROXY_MAIN_WINDOW_ID)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  }
  catch (error) {
    console.error('[DevToolsGuard] unlock prompt failed:', error)
  }
  finally {
    unlockPromptOpen = false
  }
}
