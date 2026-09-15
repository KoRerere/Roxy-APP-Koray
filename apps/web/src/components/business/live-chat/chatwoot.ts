/** Chatwoot 自托管实例，与官方嵌入脚本保持一致 */
export const CHATWOOT_BASE_URL = 'https://cloudunk.com'
/** Chatwoot website inbox token */
export const CHATWOOT_WEBSITE_TOKEN = 'KQNGK6Ad8SP2q8tBjYeNe43b'

const SCRIPT_ID = 'chatwoot-sdk-script'
const READY_TIMEOUT_MS = 10_000
const IDENTITY_SYNC_DELAY_MS = 300
const LOADING_PLACEHOLDER_ID = 'roxy-chatwoot-loading'
const LOADING_STYLE_ID = 'roxy-chatwoot-loading-styles'
const CHATWOOT_ARTIFACT_IDS = [SCRIPT_ID, 'cw-widget-holder', 'cw-bubble-holder', 'cw-widget-styles', 'chatwoot_live_chat_widget']

/** 会话窗口停靠位置；官方 SDK 无 setPosition，运行时靠切换 woot-elements class */
export type ChatwootPosition = 'left' | 'right'

const POSITION_HOST_SELECTORS = '.woot-widget-holder, .woot-widget-bubble'

/** 注入 SDK 前写入的 Chatwoot 初始化配置 */
export interface ChatwootInitSettings {
  /** 隐藏默认气泡，改由产品内按钮打开，避免与帮助浮标叠两套入口 */
  hideMessageBubble?: boolean
  /** 界面语言，传入项目 locale 即可，加载器会转成 Chatwoot 格式 */
  locale?: string
  /** widget 明暗主题；仅首次加载生效 */
  darkMode?: 'light' | 'dark' | 'auto'
  /** 会话窗口停靠位置；加载后也可通过 setChatwootPosition 切换 */
  position?: ChatwootPosition
}

/** 写入 Chatwoot 联系人与自定义属性的身份信息 */
export interface ChatwootUserIdentity {
  /** 稳定用户 ID，不要使用登录 token */
  identifier?: string
  name?: string
  email?: string
  phoneNumber?: string
  /** 客服侧可见的额外字段，如窗口额度 */
  customAttributes?: Record<string, string | number | boolean>
}

let loadPromise: Promise<void> | undefined
/** 最近一次请求的停靠位置；SDK 异步就绪后仍按此值落地，避免加载期间路由已变 */
let desiredPosition: ChatwootPosition | undefined
let pendingIdentity: ChatwootUserIdentity | undefined
let identitySyncTimer: ReturnType<typeof setTimeout> | undefined
let lastIdentityWidget: ChatwootWidget | undefined
let lastUserSignature: string | undefined
let lastCustomAttributesSignature: string | undefined

function resetIdentitySyncState() {
  if (identitySyncTimer) {
    clearTimeout(identitySyncTimer)
  }
  pendingIdentity = undefined
  identitySyncTimer = undefined
  lastIdentityWidget = undefined
  lastUserSignature = undefined
  lastCustomAttributesSignature = undefined
}

/** 登录页靠右，其余页面靠左，避免挡住内部页右侧帮助浮标 */
export function resolveChatwootPosition(pathname = globalThis.location?.pathname ?? ''): ChatwootPosition {
  return pathname === '/login' || pathname.endsWith('/login') ? 'right' : 'left'
}

/** 把 Chatwoot 注入的 holder/bubble 切到对应 woot-elements class */
function applyChatwootPositionClass(position: ChatwootPosition) {
  const opposite: ChatwootPosition = position === 'left' ? 'right' : 'left'
  for (const el of document.querySelectorAll(POSITION_HOST_SELECTORS)) {
    el.classList.remove(`woot-elements--${opposite}`)
    el.classList.add(`woot-elements--${position}`)
  }
}

/**
 * 运行时切换会话窗口左右停靠。
 * 官方 SDK 没有 setPosition，只能改 $chatwoot.position 并同步 DOM class。
 */
export function setChatwootPosition(position: ChatwootPosition) {
  desiredPosition = position
  if (globalThis.chatwootSettings) {
    globalThis.chatwootSettings.position = position
  }
  if (globalThis.$chatwoot) {
    globalThis.$chatwoot.position = position
  }
  const loadingPlaceholder = document.getElementById(LOADING_PLACEHOLDER_ID)
  if (loadingPlaceholder) {
    loadingPlaceholder.className = `roxy-chatwoot-loading roxy-chatwoot-loading--${position}`
  }
  applyChatwootPositionClass(position)
}

/** 将项目 locale（zh-CN）转成 Chatwoot 使用的下划线形式（zh_CN） */
export function toChatwootLocale(locale?: string) {
  if (!locale) {
    return 'en'
  }
  return locale.replace('-', '_')
}

/** Chatwoot iframe 是否已完成加载并可安全打开 */
export function isChatwootReady() {
  return globalThis.$chatwoot?.hasLoaded === true
}

/** 用户主动打开但 iframe 尚未 ready 时展示的本地占位窗口，不依赖 Chatwoot DOM */
function showChatwootLoading(position: ChatwootPosition) {
  let style = document.getElementById(LOADING_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = LOADING_STYLE_ID
    style.textContent = `
#${LOADING_PLACEHOLDER_ID}{position:fixed;bottom:104px;width:400px;height:calc(90% - 84px);max-height:640px;min-height:250px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(226,233,238,.8);border-radius:16px;background:rgba(255,255,255,.82);box-shadow:0 5px 40px rgba(0,0,0,.16);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483001}
#${LOADING_PLACEHOLDER_ID}.roxy-chatwoot-loading--left{left:20px}
#${LOADING_PLACEHOLDER_ID}.roxy-chatwoot-loading--right{right:20px}
#${LOADING_PLACEHOLDER_ID} .roxy-chatwoot-loading__spinner{width:32px;height:32px;box-sizing:border-box;border:3px solid rgba(31,147,255,.2);border-top-color:#1f93ff;border-radius:50%;animation:roxy-chatwoot-loading-spin .8s linear infinite}
@keyframes roxy-chatwoot-loading-spin{to{transform:rotate(360deg)}}
@media(max-width:667px){#${LOADING_PLACEHOLDER_ID}{inset:0!important;width:100%;height:100%;max-height:none;min-height:0;border:0;border-radius:0}}
`
    document.head.appendChild(style)
  }

  let placeholder = document.getElementById(LOADING_PLACEHOLDER_ID)
  if (!placeholder) {
    placeholder = document.createElement('div')
    placeholder.id = LOADING_PLACEHOLDER_ID
    placeholder.setAttribute('role', 'status')
    placeholder.setAttribute('aria-live', 'polite')
    placeholder.setAttribute('aria-busy', 'true')
    const spinner = document.createElement('span')
    spinner.className = 'roxy-chatwoot-loading__spinner'
    spinner.setAttribute('aria-hidden', 'true')
    placeholder.appendChild(spinner)
    document.body.appendChild(placeholder)
  }
  placeholder.className = `roxy-chatwoot-loading roxy-chatwoot-loading--${position}`
}

function hideChatwootLoading() {
  document.getElementById(LOADING_PLACEHOLDER_ID)?.remove()
  document.getElementById(LOADING_STYLE_ID)?.remove()
}

/** 强制隐藏未加载完成的窗口，避免残留半透明空壳 */
function hideIncompleteChatwoot() {
  hideChatwootLoading()
  try {
    globalThis.$chatwoot?.toggle('close')
  }
  catch (err) {
    console.warn('[LiveChat] failed to close incomplete Chatwoot widget', err)
  }

  document.getElementById('cw-widget-holder')?.classList.add('woot--hide')
  document.getElementById('cw-bubble-holder')?.classList.add('woot--hide')
}

/** SDK 脚本本身失败时完整回滚，下一次点击可重新下载 */
function resetFailedChatwootSdk() {
  hideIncompleteChatwoot()
  resetIdentitySyncState()
  for (const id of CHATWOOT_ARTIFACT_IDS) {
    document.getElementById(id)?.remove()
  }
  globalThis.$chatwoot = undefined
  globalThis.chatwootSDK = undefined
  globalThis.chatwootSettings = undefined
}

/**
 * 幂等加载 Chatwoot SDK。
 * locale / darkMode / hideMessageBubble 必须在脚本执行前写入，因此只在首次加载时生效。
 * position 可在就绪后通过 setChatwootPosition 再切。
 */
export function loadChatwoot(settings?: ChatwootInitSettings): Promise<void> {
  const position = settings?.position ?? desiredPosition ?? resolveChatwootPosition()
  desiredPosition = position

  if (isChatwootReady()) {
    setChatwootPosition(position)
    return Promise.resolve()
  }
  if (loadPromise) {
    // SDK 还在拉取，但后续打开/路由切换仍要记住最新停靠侧
    setChatwootPosition(position)
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    globalThis.chatwootSettings = {
      hideMessageBubble: settings?.hideMessageBubble ?? true,
      position,
      locale: toChatwootLocale(settings?.locale ?? document.documentElement.lang),
      type: 'standard',
      // 提前打开客服时 live-chat 组件可能尚未挂载，用当前文档主题兜底
      darkMode: settings?.darkMode ?? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    }

    let settled = false
    let readyTimer: ReturnType<typeof setTimeout> | undefined

    function finish(callback: () => void) {
      if (settled) {
        return
      }
      settled = true
      if (readyTimer) {
        clearTimeout(readyTimer)
      }
      globalThis.removeEventListener('chatwoot:ready', onReady)
      callback()
    }
    function onReady() {
      finish(() => {
        // 加载期间路由可能已变，按最新 desiredPosition 落地，而不是脚本启动时的快照
        setChatwootPosition(desiredPosition ?? position)
        resolve()
      })
    }
    function fail(error: Error, resetSdk = false) {
      finish(() => {
        if (resetSdk) {
          resetFailedChatwootSdk()
        }
        else {
          // iframe 可能在超时后恢复；保留 SDK 监听器，只隐藏 UI，避免重复注入其全局事件
          hideIncompleteChatwoot()
        }
        loadPromise = undefined
        reject(error)
      })
    }
    readyTimer = setTimeout(() => {
      fail(new Error(`[LiveChat] Chatwoot iframe was not ready within ${READY_TIMEOUT_MS}ms`))
    }, READY_TIMEOUT_MS)

    globalThis.addEventListener('chatwoot:ready', onReady)

    function runSdk() {
      try {
        if (!globalThis.chatwootSDK) {
          throw new Error('[LiveChat] Chatwoot SDK is unavailable after script load')
        }
        globalThis.chatwootSDK.run({
          websiteToken: CHATWOOT_WEBSITE_TOKEN,
          baseUrl: CHATWOOT_BASE_URL,
        })
      }
      catch (err) {
        const error = err instanceof Error ? err : new Error('[LiveChat] failed to initialize Chatwoot SDK')
        if (settled) {
          resetFailedChatwootSdk()
        }
        else {
          fail(error, true)
        }
      }
    }

    if (document.getElementById(SCRIPT_ID)) {
      const iframe = document.getElementById('chatwoot_live_chat_widget') as HTMLIFrameElement | null
      if (iframe && globalThis.$chatwoot?.hasLoaded !== true) {
        // 上次 iframe 请求超时，用户再次点击时主动重新发起导航
        const retryUrl = iframe.src
        iframe.src = retryUrl
      }
      else if (globalThis.chatwootSDK && !globalThis.$chatwoot) {
        runSdk()
      }
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`
    script.async = true
    script.onload = () => {
      runSdk()
    }
    script.onerror = () => {
      if (settled) {
        resetFailedChatwootSdk()
      }
      else {
        fail(new Error('[LiveChat] failed to load Chatwoot SDK'), true)
      }
    }
    try {
      document.head.appendChild(script)
    }
    catch (err) {
      fail(err instanceof Error ? err : new Error('[LiveChat] failed to append Chatwoot SDK script'), true)
    }
  })

  return loadPromise
}

/** 用户点击后等待可用 widget；等待期间展示本地 loading，占位层始终在完成或失败时清理 */
async function getReadyChatwootForUserAction() {
  if (!isChatwootReady()) {
    showChatwootLoading(desiredPosition ?? resolveChatwootPosition())
  }
  try {
    await loadChatwoot()
    const widget = globalThis.$chatwoot
    return widget?.hasLoaded === true ? widget : undefined
  }
  finally {
    hideChatwootLoading()
  }
}

/** 打开会话窗口；尚未加载时先拉起 SDK，保证「联系客服」在组件延迟挂载前也可点开 */
export async function openChatwoot(): Promise<boolean> {
  try {
    const widget = await getReadyChatwootForUserAction()
    if (!widget) {
      return false
    }
    widget.toggle('open')
    return true
  }
  catch (err) {
    console.error('[LiveChat] failed to open Chatwoot', err)
    return false
  }
}

/** 切换会话窗口开/关 */
export async function toggleChatwoot(): Promise<boolean> {
  try {
    const widget = await getReadyChatwootForUserAction()
    if (!widget) {
      return false
    }
    widget.toggle()
    return true
  }
  catch (err) {
    console.error('[LiveChat] failed to toggle Chatwoot', err)
    return false
  }
}

/** 合并短时间内重复的身份变化，并跳过已同步内容，避免触发 Chatwoot contact 接口限流 */
function flushChatwootIdentity() {
  identitySyncTimer = undefined
  const identity = pendingIdentity
  pendingIdentity = undefined
  const widget = globalThis.$chatwoot
  if (!identity || widget?.hasLoaded !== true) {
    return
  }

  if (lastIdentityWidget !== widget) {
    lastIdentityWidget = widget
    lastUserSignature = undefined
    lastCustomAttributesSignature = undefined
  }

  if (identity.identifier) {
    const user = {
      name: identity.name,
      ...(identity.email ? { email: identity.email } : {}),
      ...(identity.phoneNumber ? { phone_number: identity.phoneNumber } : {}),
    }
    const userSignature = JSON.stringify([identity.identifier, user])
    if (userSignature !== lastUserSignature) {
      widget.setUser(identity.identifier, user)
      lastUserSignature = userSignature
    }
  }

  if (identity.customAttributes) {
    const attributesSignature = JSON.stringify(Object.entries(identity.customAttributes).sort(([left], [right]) => left.localeCompare(right)))
    if (attributesSignature !== lastCustomAttributesSignature) {
      widget.setCustomAttributes(identity.customAttributes)
      lastCustomAttributesSignature = attributesSignature
    }
  }
}

/** 把当前登录用户同步到 Chatwoot 联系人，便于客服侧识别账号 */
export function applyChatwootIdentity(identity: ChatwootUserIdentity) {
  if (globalThis.$chatwoot?.hasLoaded !== true) {
    return
  }

  pendingIdentity = {
    ...identity,
    customAttributes: identity.customAttributes ? { ...identity.customAttributes } : undefined,
  }
  if (identitySyncTimer) {
    clearTimeout(identitySyncTimer)
  }
  identitySyncTimer = setTimeout(flushChatwootIdentity, IDENTITY_SYNC_DELAY_MS)
}

/** 登出后清空 Chatwoot 会话，避免下一账号沿用上一联系人 */
export function resetChatwoot() {
  resetIdentitySyncState()
  globalThis.$chatwoot?.reset()
}
