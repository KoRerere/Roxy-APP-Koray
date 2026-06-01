/**
 * AdsPower 启动 Chrome/SunBrowser 流程（可读版本）
 *
 * 对应 main.min.js 中的：
 *   - BuildLaunchOptions pipeline（CacheCleanupTask → BookmarkTask → FingerprintTask → ... → FinalizeTask）
 *   - ChromeBrowserInstance.buildLaunchOpt / runBrowser / launch
 *   - getChromeArgs / getChromeIgnoreArgs（constants）
 */

import path from 'node:path'
import crypto from 'node:crypto'
import puppeteer from 'puppeteer-core'

// ─────────────────────────────────────────────
// 常量路径（Windows 版，来自 constants.ts / 98646 模块）
// ─────────────────────────────────────────────
const BASE_DIR = path.join(process.env.APPDATA!, 'adspower_global', 'cwd_global')
const CACHE_DIR = path.join(BASE_DIR, 'source', 'cache')

/** AdsPower 修改版 Chrome 路径（sunbrowser = SunFlower 内核） */
const CHROME_EXECUTABLE = path.join(BASE_DIR, 'chrome', 'sunbrowser.exe')

// ─────────────────────────────────────────────
// 浏览器配置（来自数据库 / API 的 profile 字段）
// ─────────────────────────────────────────────
interface ChromeProfile {
  fbccId: string          // 浏览器档案唯一 ID（flower_browser_cc_id）
  inviteCode: string      // 用于构造缓存目录名
  headless: '0' | '1' | '2' // 0=有界面, 1=headless old, 2=headless new
  openBrowserPath: string // 可执行文件路径（可由用户自定义覆盖）
  userDataDir?: string    // 用户数据目录（profile cache 目录）
  proxyConfig?: {
    host: string; port: number; type: string
    username?: string; password?: string
  }
  // 指纹参数（以下字段会被编码为 --extended-parameters）
  staticConfig: Record<string, unknown>   // UA、Canvas、WebGL 等静态指纹
  dynamicConfig: Record<string, unknown>  // WebRTC、GeoPosition 等动态指纹
  sunBrowserParams: Record<string, unknown> // CookiesFile、TimeZone 等启动参数

  // cookie 相关
  loginCookies?: string   // 从服务端拉取的 cookie JSON
  cookieUpdatedTime?: string

  // 其他功能开关
  headlessSwitch?: string
  openGoogleApi?: '0' | '1'
  disableImageAndVideo?: '1'
  launchArgs?: string     // 用户自定义额外 args（每行一个）
}

// ─────────────────────────────────────────────
// Step 1：构造用户数据目录（profile 隔离）
// ─────────────────────────────────────────────
function resolveCacheDir(profile: ChromeProfile): string {
  // 优先使用旧目录（兼容 Win32 路径）
  const legacyDir = path.join(CACHE_DIR, `${profile.fbccId}_${profile.inviteCode}`)
  // TODO: isExists(legacyDir) → 实际会检查旧目录是否存在
  return profile.userDataDir ?? legacyDir
}

// ─────────────────────────────────────────────
// Step 2：准备 CookiesFile（启动前注入 cookie）
// ─────────────────────────────────────────────
async function prepareCookiesFile(profile: ChromeProfile, cacheDir: string): Promise<string | null> {
  // AdsPower 从服务端拉取 cookie（setCookie() API 调用）
  // 返回后写入本地临时文件，通过 --CookiesFile 参数传给浏览器内核
  // 浏览器内核在启动时自己读取并注入，不通过 CDP/BiDi 注入
  if (!profile.loginCookies) {
    return null
  }
  const cookieFile = path.join(
    cacheDir,
    crypto.createHash('md5').update(`${profile.fbccId}_cookies`).digest('hex'),
  )
  // await fs.writeFile(cookieFile, profile.loginCookies)
  console.log(`[Cookie] 写入 CookiesFile: ${cookieFile}`)
  return cookieFile
}

// ─────────────────────────────────────────────
// Step 3：修复 Preferences（防止上次崩溃导致的 "Crashed" exit_type）
// ─────────────────────────────────────────────
async function fixPreferences(cacheDir: string): Promise<void> {
  const prefPath = path.join(cacheDir, 'Default', 'Preferences')
  // 读取 JSON，如果 profile.exit_type === 'Crashed' 则改为 'Normal'
  // 防止 Chrome 启动时弹出"恢复上次会话"对话框
  console.log(`[Prefs] 修复 Preferences: ${prefPath}`)
}

// ─────────────────────────────────────────────
// Step 4：构造静态 / 动态指纹配置文件（写入临时文件，传参给内核）
// ─────────────────────────────────────────────
async function writeStaticConfig(profile: ChromeProfile, cacheDir: string): Promise<string | null> {
  const config = profile.staticConfig
  if (!config || Object.keys(config).length === 0) return null

  const configFile = path.join(
    cacheDir,
    crypto.createHash('md5').update(`${profile.fbccId}_static`).digest('hex'),
  )
  // await fs.writeFile(configFile, JSON.stringify(config))
  // 通过 sunBrowserParams.StaticConfig = configFile 传入
  console.log(`[Fingerprint] 写入 StaticConfig: ${configFile}`)
  return configFile
}

async function writeDynamicConfig(profile: ChromeProfile, cacheDir: string): Promise<string | null> {
  const config = profile.dynamicConfig
  if (!config || Object.keys(config).length === 0) return null

  const configFile = path.join(
    cacheDir,
    crypto.createHash('md5').update(`${profile.fbccId}_webrtc`).digest('hex'),
  )
  // Base64 编码后写入，通过 sunBrowserParams.DynamicConfig = configFile 传入
  // await fs.writeFile(configFile, Buffer.from(JSON.stringify(config)).toString('base64'))
  console.log(`[Fingerprint] 写入 DynamicConfig: ${configFile}`)
  return configFile
}

// ─────────────────────────────────────────────
// Step 5：组装 puppeteer launch options
// ─────────────────────────────────────────────
function buildChromeArgs(profile: ChromeProfile): string[] {
  /**
   * getChromeArgs()：AdsPower 自己加的参数
   * getChromeIgnoreArgs()：从 Puppeteer 默认参数里移除的项目
   * userArgs：用户在 UI 里配置的自定义 args
   */
  const defaultArgs = [
    '--no-default-browser-check',
    '--enable-features=LoadCryptoTokenExtension',
    '--disable-features=FlashDeprecationWarning,EnablePasswordsAccountStorage',
  ]

  // 代理配置
  const proxyArgs: string[] = []
  if (profile.proxyConfig) {
    const { host, port, type } = profile.proxyConfig
    proxyArgs.push(`--proxy-server=${type}://${host}:${port}`)
  }

  // 用户自定义 args（每行一个，启动时 merge，不允许覆盖 AdsPower 的关键 args）
  const userArgs = (profile.launchArgs ?? '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  return [...defaultArgs, ...proxyArgs, ...userArgs]
}

function buildLaunchOptions(profile: ChromeProfile, cacheDir: string, sunBrowserParams: Record<string, unknown>) {
  const args = buildChromeArgs(profile)

  // 将所有 sunBrowserParams 编码为 Base64 JSON，通过单一参数传给内核
  // （IS_SUNFLOWER_BROWSER_BASE64 环境变量控制是否启用）
  const extendedParams = Buffer.from(JSON.stringify(sunBrowserParams)).toString('base64')
  args.push(`--extended-parameters=${extendedParams}`)

  return {
    product: 'chrome' as const,
    executablePath: profile.openBrowserPath ?? CHROME_EXECUTABLE,
    userDataDir: cacheDir,
    headless: profile.headless === '1' || profile.headless === '2' ? 'new' : false,
    args,
    // 禁用 Puppeteer 默认的 signal 处理（Windows 上会有问题）
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    defaultViewport: null,
    slowMo: 250,
    env: {
      ...process.env,
      // Google API 指纹（仅 SunBrowser 且用户开启时注入）
      ...(profile.openGoogleApi === '1' ? {
        GOOGLE_API_KEY: 'AIzaSyBHDrl33hwRp4rMQY0ziRbj8K9LPA6vUCY',
        GOOGLE_DEFAULT_CLIENT_ID: '77185425430.apps.googleusercontent.com',
        GOOGLE_DEFAULT_CLIENT_SECRET: 'OTJgUOQcT7lO7GsGZq2G4IlT',
      } : {}),
    },
  }
}

// ─────────────────────────────────────────────
// Step 6：启动浏览器，获取 BiDi/CDP 端口
// ─────────────────────────────────────────────
async function runBrowser(launchOptions: ReturnType<typeof buildLaunchOptions>) {
  // AdsPower 有两个 launch 路径：
  //   - IS_CHECK_PROXY_BEFORE=false：直接用 puppeteer.launch()（标准路径）
  //   - IS_CHECK_PROXY_BEFORE=true ：用自研 OptimizeLauncher（先检查代理可达性）
  const browser = await puppeteer.launch(launchOptions as any)

  // wsEndpoint 格式：ws://127.0.0.1:{port}/devtools/browser/{id}
  // AdsPower 从中解析出 port，存到 browserMap 并通过 API 返回给调用方
  const wsEndpoint = browser.wsEndpoint()
  const { port } = new URL(wsEndpoint)
  console.log(`[Launch] Chrome 已启动，调试端口: ${port}`)
  console.log(`[Launch] WebSocket: ${wsEndpoint}`)

  return { browser, port }
}

// ─────────────────────────────────────────────
// 主流程（对应 BuildLaunchOptions pipeline 全流程）
// ─────────────────────────────────────────────
export async function launchChrome(profile: ChromeProfile) {
  // 1. 确定用户数据目录
  const cacheDir = resolveCacheDir(profile)
  console.log(`[Launch] 用户数据目录: ${cacheDir}`)

  // 2. 修复上次崩溃留下的 Preferences（防止弹恢复对话框）
  await fixPreferences(cacheDir)

  // 3. 从服务端拉取 cookie，写入临时文件
  const cookieFile = await prepareCookiesFile(profile, cacheDir)

  // 4. 准备指纹配置文件
  const staticConfigFile = await writeStaticConfig(profile, cacheDir)
  const dynamicConfigFile = await writeDynamicConfig(profile, cacheDir)

  // 5. 组装 sunBrowserParams（所有指纹参数通过此对象传给内核）
  const sunBrowserParams: Record<string, unknown> = {
    ...profile.sunBrowserParams,
    ...(cookieFile ? { CookiesFile: cookieFile } : {}),
    ...(staticConfigFile ? { StaticConfig: staticConfigFile } : {}),
    ...(dynamicConfigFile ? { DynamicConfig: dynamicConfigFile } : {}),
  }

  // 6. 构造 launch options
  const launchOptions = buildLaunchOptions(profile, cacheDir, sunBrowserParams)
  console.log(`[Launch] 可执行文件: ${launchOptions.executablePath}`)
  console.log(`[Launch] Args: ${launchOptions.args.join(' ')}`)

  // 7. 启动
  const { browser, port } = await runBrowser(launchOptions)

  // 8. 启动后任务（afterLaunchTask）：
  //    - 注册页面 console 监听，等待内核打印 "OPEN_OK" 确认就绪
  //    - 恢复上次打开的 tabs（openTabs 字段）
  //    - 启动 cookie robot（如果配置了 isOpenfbCookie）
  console.log('[AfterLaunch] 注册页面监听，等待 OPEN_OK 信号...')

  return {
    browser,
    debugPort: port,
    ws: {
      // puppeteer CDP 连接地址（通过 /json/version 暴露）
      puppeteer: `ws://127.0.0.1:${port}/session`,
      selenium: `127.0.0.1:${port}`,
    },
  }
}
