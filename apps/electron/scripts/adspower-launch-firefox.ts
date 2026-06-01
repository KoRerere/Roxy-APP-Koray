/**
 * AdsPower 启动 Firefox（FlowerBrowser）流程（可读版本）
 *
 * 对应 main.min.js 中的：
 *   - getFirefoxPrefs()（Firefox user.js prefs）
 *   - FirefoxBrowserInstance.buildLaunchOpt / runBrowser / launch
 *   - getOptionPuppeteer（Firefox product）
 *   - 关闭时 _attemptToGracefullyCloseBrowser（BiDi session.new 探活）
 *
 * Firefox 与 Chrome 最大区别：
 *   1. 指纹通过 user.js prefs 注入，不是 --extended-parameters
 *   2. 必须传 --marionette 才能连上 WebDriver
 *   3. 关闭时用 BiDi session.new 探活，再 kill 进程（不调 session.end）
 *   4. cookie 同样通过文件传参给内核，不通过 BiDi 注入
 */

import crypto from 'node:crypto'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

// ─────────────────────────────────────────────
// 常量路径
// ─────────────────────────────────────────────
const BASE_DIR = path.join(process.env.APPDATA!, 'adspower_global', 'cwd_global')
const CACHE_DIR = path.join(BASE_DIR, 'source', 'cache')

/** AdsPower 修改版 Firefox 路径（FlowerBrowser = Flower 内核，基于 Firefox） */
const FIREFOX_EXECUTABLE = path.join(BASE_DIR, 'flower_147', 'FlowerBrowser.exe')
/** GeckoDriver（Selenium 协议支持） */
const GECKODRIVER_PATH = path.join(BASE_DIR, 'flower_147', 'geckodriver.exe')

// ─────────────────────────────────────────────
// 浏览器配置
// ─────────────────────────────────────────────
interface FirefoxProfile {
  fbccId: string
  inviteCode: string
  headless: '0' | '1' | '2'
  openBrowserPath: string
  userDataDir?: string
  proxyConfig?: {
    host: string
    port: number
    type: 'http' | 'socks5'
    username?: string
    password?: string
  }
  /**
   * Firefox 指纹（注入方式不同于 Chrome：写入 user.js prefs 文件）
   */
  userAgent?: string
  language?: string[]
  timezone?: string
  latitude?: number
  longitude?: number
  accuracy?: number
  /**
   * cookie
   */
  loginCookies?: string
  cookieUpdatedTime?: string
  /**
   * 其他
   */
  launchArgs?: string
  /**
   * Firefox 不支持 Google API 注入，此字段无效
   */
  openGoogleApi?: '0' | '1'
}

// ─────────────────────────────────────────────
// Step 1：Firefox prefs（user.js 默认配置）
//   来自 getFirefoxPrefs()，禁用大量不必要功能，保证自动化稳定
/**
 * ─────────────────────────────────────────────
 */
function getFirefoxPrefs(): Record<string, unknown> {
  const DUMMY = 'dummy.test'
  return {
    // 禁用 Normandy / 更新 / 安全浏览等联网行为
    'app.normandy.api_url': '',
    'app.update.checkInstallTime': false,
    'app.update.disabledForTesting': true,
    'apz.content_response_timeout': 60000,

    // 内容拦截 / cookie 行为
    'browser.contentblocking.features.standard': '-tp,tpPrivate,cookieBehavior0,-cm,-fp',
    'browser.dom.window.dump.enabled': true,
    'browser.newtabpage.activity-stream.feeds.section.topstories': false,
    'browser.newtabpage.enabled': false,
    'browser.pagethumbnails.capturing_disabled': true,

    // 关闭各种安全检查（自动化环境不需要）
    'browser.safebrowsing.blockedURIs.enabled': false,
    'browser.safebrowsing.downloads.enabled': false,
    'browser.safebrowsing.malware.enabled': false,
    'browser.safebrowsing.passwords.enabled': false,
    'browser.safebrowsing.phishing.enabled': false,

    // 关闭 session 恢复（防止弹恢复对话框）
    'browser.sessionstore.resume_from_crash': false,
    'browser.search.update': false,

    // 允许远程控制（BiDi / Marionette 必须）
    'remote.enabled': true,
    'focusmanager.testmode': true,

    // cookie 行为：允许所有
    'network.cookie.cookieBehavior': 0,

    // 关闭各种测试/开发者模式额外弹窗
    'security.notification_enable_delay': 0,
    'signon.autofillForms': false,
    'signon.rememberSignons': false,

    // 伪造位置（避免 geo.wifi 请求）
    'geo.provider.testing': true,
    'geo.wifi.scan': false,

    // 关闭扩展更新
    'extensions.update.enabled': false,
    'extensions.update.notifyUser': false,

    // 使用假域名替换 Mozilla 服务器，避免真实联网
    'extensions.webservice.discoverURL': `http://${DUMMY}/dummy/discoveryURL`,
    'services.settings.server': `http://${DUMMY}/dummy/blocklist/`,
    'network.sntp.pools': DUMMY,
  }
}

// ─────────────────────────────────────────────
// Step 2：将指纹参数写入 user.js（Firefox 指纹注入方式）
//   Chrome 是 --extended-parameters；Firefox 是 user.js prefs
/**
 * ─────────────────────────────────────────────
 */
async function writeUserJs(profile: FirefoxProfile, profileDir: string): Promise<void> {
  const prefs = getFirefoxPrefs()

  // 注入用户代理
  if (profile.userAgent) {
    prefs['general.useragent.override'] = profile.userAgent
  }

  // 注入语言
  if (profile.language?.length) {
    prefs['intl.accept_languages'] = profile.language.join(',')
  }

  // 注入时区（Firefox 通过 env.TZ 控制，不是 pref，此处仅示意）
  // process.env.TZ = profile.timezone

  // 构造 user.js 文件内容
  const lines = Object.entries(prefs)
    .map(([k, v]) => `user_pref("${k}", ${JSON.stringify(v)});`)
    .join('\n')

  const userJsPath = path.join(profileDir, 'user.js')
  // await fs.writeFile(userJsPath, lines)
  console.log(`[Prefs] 写入 user.js: ${userJsPath}`)
  console.log(`${lines.slice(0, 200)}...`)
}

// ─────────────────────────────────────────────
// Step 3：准备 CookiesFile（与 Chrome 相同的文件传参机制）
/**
 * ─────────────────────────────────────────────
 */
async function prepareCookiesFile(profile: FirefoxProfile, cacheDir: string): Promise<string | null> {
  if (!profile.loginCookies)
    return null

  const cookieFile = path.join(
    cacheDir,
    crypto.createHash('md5').update(`${profile.fbccId}_cookies`).digest('hex'),
  )
  // await fs.writeFile(cookieFile, profile.loginCookies)
  console.log(`[Cookie] 写入 CookiesFile: ${cookieFile}`)
  return cookieFile
}

// ─────────────────────────────────────────────
// Step 4：构造 Firefox 启动 args
/**
 * ─────────────────────────────────────────────
 */
function buildFirefoxArgs(profile: FirefoxProfile, profileDir: string): string[] {
  const args: string[] = [
    // 前置到最前（macOS 需要）
    '-foreground',
    // 启用 Marionette（Selenium/WebDriver 协议）
    '--marionette',
    // 指定 profile 目录（隔离不同账号）
    '--profile',
    profileDir,
    // 启用 BiDi 远程协议（WebSocket 调试端口）
    '--remote-debugging-port',
    '0', // 0 = 随机端口，Puppeteer 会自动获取
    // 指定 BiDi WebSocket 监听地址
    '--remote-allow-origins',
    '*',
  ]

  // 代理配置（Firefox 通过 prefs 或 args 配置，AdsPower 此处用 args）
  if (profile.proxyConfig) {
    const { host, port, type } = profile.proxyConfig
    // Firefox 代理通过 prefs network.proxy.* 配置，不是 --proxy-server
    // 此处省略，实际在 user.js 里写入
    console.log(`[Proxy] 代理: ${type}://${host}:${port}`)
  }

  // 用户自定义 args
  const userArgs = (profile.launchArgs ?? '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  args.push(...userArgs)
  return args
}

// ─────────────────────────────────────────────
// Step 5：构造 puppeteer launch options（product = firefox）
/**
 * ─────────────────────────────────────────────
 */
function buildLaunchOptions(profile: FirefoxProfile, profileDir: string) {
  return {
    product: 'firefox' as const,
    executablePath: profile.openBrowserPath ?? FIREFOX_EXECUTABLE,
    userDataDir: profileDir,
    headless: profile.headless !== '0',
    args: buildFirefoxArgs(profile, profileDir),
    // Windows 上禁用 signal 处理（与 Chrome 相同）
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    defaultViewport: null,
    slowMo: 250,
    env: {
      ...process.env,
      // 时区通过环境变量注入（Firefox 不支持 --timezone arg）
      ...(profile.timezone ? { TZ: profile.timezone.replace(/\s+/, '_') } : {}),
    },
  }
}

// ─────────────────────────────────────────────
// Step 6：启动浏览器
//   Firefox BiDi 端口通过 wsEndpoint() 获取（与 Chrome 相同）
/**
 * ─────────────────────────────────────────────
 */
async function runBrowser(launchOptions: ReturnType<typeof buildLaunchOptions>) {
  const browser = await puppeteer.launch(launchOptions as any)

  // wsEndpoint 格式：ws://127.0.0.1:{port}/session
  // Firefox BiDi 的 WebSocket 路径是 /session（不同于 Chrome 的 /devtools/browser/...）
  const wsEndpoint = browser.wsEndpoint()
  const { port } = new URL(wsEndpoint)
  console.log(`[Launch] Firefox 已启动`)
  console.log(`[Launch] BiDi WebSocket: ${wsEndpoint}`)
  console.log(`[Launch] Marionette 端口（Selenium）: ${Number(port) - 1}`)

  return { browser, port }
}

// ─────────────────────────────────────────────
// Step 7：关闭浏览器（特殊处理）
//   Firefox 不像 Chrome 可以直接 browser.close()
//   AdsPower 先通过 BiDi session.new 确认连接存活，再 kill 进程
/**
 * ─────────────────────────────────────────────
 */
async function closeFirefox(ws: WebSocket): Promise<void> {
  /**
   * _attemptToGracefullyCloseBrowser 逻辑：
   *
   * 1. 如果连接上已有 onmessage 监听（说明会话还活着），直接关闭进程
   * 2. 如果没有 onmessage（可能是"冷连接"），先发 session.new 探活
   *    - 等 Firefox 响应后，说明 BiDi 通道正常
   *    - 然后直接关闭 Firefox 进程（不调 session.end）
   *    - Firefox 进程退出 = 所有 session 自动清理（等效于 session.end）
   */
  /**
   * AdsPower 用的特殊 id
   */
  const kShutdownSessionNewMessageId = -1

  if (!ws.onmessage) {
    // 发 session.new 探活（不是为了"创建会话"，只是确认 BiDi 还通）
    await new Promise<void>((resolve) => {
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string)
        if (msg.id === kShutdownSessionNewMessageId) {
          resolve()
        }
      }
      ws.send(JSON.stringify({
        id: kShutdownSessionNewMessageId,
        method: 'session.new',
        params: { capabilities: {} },
      }))
    })
  }

  // 关闭 Firefox 进程（进程退出会自动清理 BiDi session，无需 session.end）
  console.log('[Close] Firefox 进程关闭')
  // browser.process()?.kill('SIGTERM') 或 taskkill /F /PID xxx（Windows）
}

// ─────────────────────────────────────────────
// 主流程
/**
 * ─────────────────────────────────────────────
 */
export async function launchFirefox(profile: FirefoxProfile) {
  // 1. 确定 profile 目录
  const profileDir = profile.userDataDir
    ?? path.join(CACHE_DIR, `${profile.fbccId}_${profile.inviteCode}`)
  console.log(`[Launch] Firefox profile 目录: ${profileDir}`)

  // 2. 写入 user.js（指纹 prefs）
  await writeUserJs(profile, profileDir)

  // 3. 准备 CookiesFile（从服务端拉取 → 写文件 → 内核启动时自动注入）
  const cookieFile = await prepareCookiesFile(profile, profileDir)
  if (cookieFile) {
    // Firefox 内核（FlowerBrowser）会读取 CookiesFile，写入 cookies.sqlite
    // 原理与 Chrome 相同，不通过 BiDi/Marionette 注入
    console.log(`[Cookie] Firefox CookiesFile: ${cookieFile}`)
  }

  // 4. 构造 launch options
  const launchOptions = buildLaunchOptions(profile, profileDir)
  console.log(`[Launch] 可执行文件: ${launchOptions.executablePath}`)
  console.log(`[Launch] Args: ${launchOptions.args.join(' ')}`)

  // 5. 启动
  const { browser, port } = await runBrowser(launchOptions)

  // 6. 启动后任务（与 Chrome 类似）：
  //    - 等待内核打印 "OPEN_OK"（通过 page.on('console') 监听）
  //    - 恢复 tabs
  //    - 启动 cookie robot（如果配置）
  console.log('[AfterLaunch] 注册页面监听，等待 OPEN_OK...')

  return {
    browser,
    debugPort: port,
    marionettePort: Number(port) - 1, // Marionette 端口 = BiDi端口 - 1（AdsPower 约定）
    ws: {
      // Firefox BiDi WebSocket（通过此地址做 session.new 创建会话）
      puppeteer: `ws://127.0.0.1:${port}/session`,
      selenium: `127.0.0.1:${port}`,
    },
    webdriver: GECKODRIVER_PATH,
    /**
     * 关闭时调用此方法（不要直接 browser.close()）
     */
    close: () => {
      // closeFirefox(ws) — 先探活，再 kill 进程
    },
  }
}
