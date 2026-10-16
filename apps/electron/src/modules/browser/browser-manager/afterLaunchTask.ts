import type { IBrowser } from './adapter'
import type { BrowserItem } from './browserItem'
import type { ChromePage, ChromeTarget, Protocol } from './chrome-wrapper/'
import type { FirefoxBrowser } from './firefox-wrapper/browser'
import CDP from 'chrome-remote-interface'
import ejs from 'ejs'
import { debounce } from 'es-toolkit'
import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { appConfig } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { parseLastWindowBounds } from '/@/modules/browser/browser-manager/lastWindowBounds'
import { store } from '/@/modules/store'
import { SyncControlUtil } from '/@/modules/sync-control/util'

/** 浏览器启动后要做的事情 */
export class AfterLaunchTask {
  /** 最新的 cookies */
  private cookies: Protocol.Network.Cookie[] = []
  /** 判断是否手机端 */
  get isPhone() {
    return [`Android`, `IOS`].includes(this.browserItem.winInfo.os)
  }

  /** 是否继续访问 */
  private continueAccess = false
  /** 检测 IP 变化定时器 */
  private checkIpChangeTimer: NodeJS.Timeout | null = null
  /** cookie 定时同步定时器 */
  private cookieTimer: NodeJS.Timeout | null = null
  /** 窗口 bounds 定时同步定时器 */
  private windowBoundsTimer: NodeJS.Timeout | null = null
  /** Chrome 主窗口 ID，关闭前再读一次 bounds 时复用，避免重复 getWindowForTarget */
  private chromeWindowId: number | null = null
  /** 同一 profile 重复触发时跳过，避免 Firefox BiDi 被重复 releaseSession */
  private cookieRobotRunning = false
  /**
   * Firefox：handleBrowserEvent 中 releaseSession 完成后 resolve。
   * 多 profile 并行 cookie robot 时，须等各自启动流程结束再 reconnectBiDi，否则会与 releaseSession 竞态。
   */
  private readonly firefoxBidiIdleDeferred = Promise.withResolvers<void>()
  private firefoxBidiIdleResolved = false

  constructor(private browserItem: BrowserItem, public browser: IBrowser) {
    if (!browserItem.isFirefox) {
      this.markFirefoxBidiIdle()
    }
  }

  private markFirefoxBidiIdle() {
    if (this.firefoxBidiIdleResolved) {
      return
    }
    this.firefoxBidiIdleResolved = true
    this.firefoxBidiIdleDeferred.resolve()
  }

  async run() {
    this.checkIpChangeTimer = setTimeout(() => {
      this.checkIpChange()
    }, 5000)
    this.browser.on('process-close', () => {
      console.log('process-close')
      this.continueAccess = true
      if (this.checkIpChangeTimer) {
        clearTimeout(this.checkIpChangeTimer)
      }
      if (this.cookieTimer) {
        clearInterval(this.cookieTimer)
      }
      if (this.windowBoundsTimer) {
        clearInterval(this.windowBoundsTimer)
      }
    })
    await this.handleBrowserEvent()
    this.startWindowBoundsSync()
  }

  /**
   * 启动窗口 bounds 定时同步
   * 每 3 秒通过 CDP Browser.getWindowBounds 获取一次窗口位置与尺寸
   * 参考：https://chromedevtools.github.io/devtools-protocol/tot/Browser/#method-getWindowBounds
   */
  private async startWindowBoundsSync() {
    if (!this.browser?.client || this.browserItem.isFirefox) {
      return
    }

    const Browser = this.browser.client.Browser
    if (!Browser?.getWindowForTarget || typeof Browser.getWindowBounds !== 'function') {
      return
    }

    try {
      // getWindowForTarget 需要一个有 web contents 的 target，取第一个真实页面的 targetId
      const pages = await this.browser.pages()
      const firstPage = pages?.at(0)
      if (!firstPage) {
        console.warn('startWindowBoundsSync: no pages available, skipping')
        return
      }
      const targetId = firstPage.target()._targetId

      // 通过 Browser.getWindowForTarget 获取当前窗口 ID（只需获取一次）
      const { windowId } = await Browser.getWindowForTarget({ targetId })
      this.chromeWindowId = windowId

      this.windowBoundsTimer = setInterval(async () => {
        // 若 CDP client 已断开，停止定时器
        if (!this.browser?.client) {
          clearInterval(this.windowBoundsTimer!)
          this.windowBoundsTimer = null
          return
        }
        try {
          const { bounds } = await Browser.getWindowBounds({ windowId })
          this.rememberChromeWindowBounds(bounds)
        }
        catch (error) {
          console.error('Failed to get window bounds:', error)
        }
      }, 3 * 1000)
    }
    catch (error) {
      console.error('Failed to start window bounds sync:', error)
    }
  }

  /**
   * 关闭 CDP 前再读一次 Chrome 窗口位置。
   * 用户直接关窗口时进程已退出，读不到，调用方改用内存里最近一次采样。
   */
  async captureChromeWindowBounds() {
    if (this.browserItem.isFirefox || !this.browser?.client) {
      return null
    }
    const Browser = this.browser.client.Browser
    if (typeof Browser?.getWindowBounds !== 'function') {
      return null
    }
    try {
      let windowId = this.chromeWindowId
      if (windowId == null) {
        if (!Browser.getWindowForTarget) {
          return null
        }
        const pages = await this.browser.pages()
        const targetId = pages?.at(0)?.target()._targetId
        if (!targetId) {
          return null
        }
        windowId = (await Browser.getWindowForTarget({ targetId })).windowId
        this.chromeWindowId = windowId
      }
      const { bounds } = await Browser.getWindowBounds({ windowId })
      return this.rememberChromeWindowBounds(bounds)
    }
    catch (error) {
      console.error('Failed to capture chrome window bounds:', error)
      return null
    }
  }

  /** 采样只进内存，供异常退出恢复和来不及落盘时补写；真正的上次关闭文件在关闭路径写入 */
  private rememberChromeWindowBounds(bounds: { left?: number, top?: number, width?: number, height?: number }) {
    const parsed = parseLastWindowBounds(bounds)
    const dirId = this.browserItem.winInfo.dirId
    if (!parsed || !dirId) {
      return null
    }
    store.waitingRestoreWindowBounds ??= {}
    store.waitingRestoreWindowBounds[dirId] = parsed
    return parsed
  }

  /** 获取标签页 */
  async getDefaultOpenUrl() {
    // 同步 浏览器已经打开tabs标签
    let defaultOpenUrl: string[] = []
    try {
      const roxyTabs = await readFile(this.browserItem.roxyTabsPath, 'utf8')
      defaultOpenUrl = JSON.parse(roxyTabs).filter(url => this.browserItem.isValidURL(url))
      console.log('Syncing tabs roxy_tabs', defaultOpenUrl)
      // 如果浏览器是由于关闭最后一个标签页而导致关闭的，这个时候龙哥会检测不到，所以每次读完 roxy_tabs，都要删除
      rm(this.browserItem.roxyTabsPath)
    }
    catch (error) {
      defaultOpenUrl = this.browserItem.winInfo.allOpenUrl || []
      console.log(`roxy_tabs file does not exist, skipping`, error)
    }
    return defaultOpenUrl
  }

  /** 读取 lumiLogin */
  async getLumiLogin() {
    // 同步插件密码
    let lumiLogin = ''
    try {
      // cookie = this.browser_service.export_cookies();
      // login_data = this.browser_service.export_login_data();
      const stats = await stat(this.browserItem.lumiLoginPath)
      // lumiLogin 文件超过1M的文件就不同步到服务器
      if (stats.size < 1024 * 1024) {
        lumiLogin = await readFile(this.browserItem.lumiLoginPath, 'utf8')
      }
      else {
        console.log('lumiLogin file exceeds 1M, not syncing to server', stats.size)
      }
      console.log('lumiLogin', lumiLogin)
    }
    catch (error) {
      console.log(`lumiLogin file does not exist, skipping`, error)
    }
    return lumiLogin
  }

  /**
   * 立即执行一次 cookie 保存。
   * Firefox：BiDi session 已在启动时导入完成后释放，直接从 cookies.sqlite 读取。
   * Chrome：通过 CDP Storage.getCookies 获取。
   */
  async saveCookiesNow(): Promise<void> {
    if (this.browserItem.isFirefox) {
      // Firefox session 已释放，通过 SQLite 文件读取最新 cookies
      try {
        this.cookies = await this.readCookiesFromFirefoxSqlite()
        console.log(`[AfterLaunchTask] saveCookiesNow (Firefox SQLite): ${this.cookies.length} cookies`)
      }
      catch (error) {
        console.error('[AfterLaunchTask] saveCookiesNow (Firefox) failed:', error)
      }
      return
    }
    if (!this.browser.client) {
      return
    }
    try {
      const { cookies } = await this.browser.client.Storage.getCookies()
      this.cookies = cookies as Protocol.Network.Cookie[]
      console.log(`[AfterLaunchTask] saveCookiesNow: ${cookies.length} cookies saved`)
    }
    catch (error) {
      console.error('[AfterLaunchTask] saveCookiesNow failed:', error)
    }
  }

  /**
   * 直接从 Firefox profile 目录的 cookies.sqlite 读取 cookies。
   * Firefox 使用 WAL 模式，SQLite 并发读安全，适用于 BiDi session 已释放时。
   * Firefox moz_cookies.sameSite 枚举值：0=UNSET, 1=None, 2=Lax, 3=Strict
   * 注意：此处读出的 expiry 为秒级时间戳（Firefox 原生格式），上传后再次导入时 < 1e10，
   *       setCookies 中的 ms→s 转换逻辑不会错误处理（两者阈值区分安全）。
   */
  private async readCookiesFromFirefoxSqlite(): Promise<Protocol.Network.Cookie[]> {
    const cookiePath = join(this.browserItem.userDataDir, 'cookies.sqlite')
    const db = new DatabaseSync(cookiePath, { timeout: 5000 })
    try {
      const rows = db.prepare(
        'SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies',
      ).all() as any[]
      // Firefox moz_cookies.sameSite: 0=UNSET, 1=None, 2=Lax, 3=Strict
      // UNSET 映射为 undefined，不设置 sameSite 属性（与浏览器默认行为一致）
      const sameSiteMap: Record<number, string | undefined> = { 0: undefined, 1: 'None', 2: 'Lax', 3: 'Strict' }
      return rows.map((row) => {
        const sameSite = sameSiteMap[row.sameSite as number]
        return {
          name: row.name as string,
          value: row.value as string,
          domain: row.host as string,
          path: row.path as string,
          // expiry=0 表示 session cookie，映射为 -1（CDP 约定）
          expires: (row.expiry as number) || -1,
          httpOnly: Boolean(row.isHttpOnly),
          secure: Boolean(row.isSecure),
          // sameSite=undefined 时不包含该属性，避免回写时因缺少 secure 被 Firefox 拒绝
          ...(sameSite !== undefined ? { sameSite } : {}),
          session: !(row.expiry as number),
          size: ((row.name as string) + (row.value as string)).length,
        } as Protocol.Network.Cookie
      })
    }
    finally {
      db.close()
    }
  }

  /** 获取需要同步的数据 */
  async getUploadData() {
    const defaultOpenUrl = await this.getDefaultOpenUrl()
    const lumiLogin = await this.getLumiLogin()
    const { id, syncCookie, cookie } = this.browserItem.winInfo
    // console.log('getUploadData cookie', this.cookies)
    return {
      id,
      defaultOpenUrl,
      cookie: syncCookie ? (this.cookies || []) : cookie,
      lumiLogin,
    }
  }

  /** 处理浏览器事件 */
  async handleBrowserEvent() {
    const { cookie, syncCookie, clearCookie } = this.browserItem.winInfo
    const isFirefox = this.browserItem.isFirefox

    try {
      if (!this.browser || !this.browser.client) {
        console.warn('Browser or browser.client is not available')
        return
      }

      // 所有标签页已通过命令行参数打开，此处只需导入 cookie 并重新加载
      const pages = await this.browser?.pages()

      const startTime = Date.now()
      // 导入 cookie
      if (cookie && !clearCookie) {
        try {
          await this.browser.client.Storage.setCookies({ cookies: cookie })
          console.log('Storage.setCookies success')
          console.log('Cookie import time:', Date.now() - startTime, 'ms')
        }
        catch (err) {
          console.log('Failed to import cookies:', err)
        }
      }

      // cookie 导入完成后重新加载所有已通过 CLI 打开的标签页，确保请求携带正确的 cookie。
      // 注意：必须在 releaseSession() 之前完成导航，否则 BiDi 已断开，goto 会失败。
      if (pages?.length) {
        await Promise.all(pages.map(async (e) => {
          const url = e.target().url()
          if (url && url !== 'about:blank' && !url.startsWith('chrome://') && !url.startsWith('about:')) {
            await e.goto(url).catch((err) => {
              console.log(`goto ${url} failed`, err)
            })
          }
        }))
      }

      const deferredUrls = this.browserItem.beforeLaunchTask?.deferredOpenUrls ?? []
      if (deferredUrls.length) {
        console.log(`[AfterLaunchTask] Opening ${deferredUrls.length} deferred URL(s) via CDP (command line length limit)`)
        await Promise.all(deferredUrls.map(async (url) => {
          try {
            await this.browser!.newPage(url)
          }
          catch (error) {
            console.error(`[AfterLaunchTask] Failed to open deferred URL ${url}:`, error)
          }
        }))
      }

      // Firefox：页面重载完成后再释放 BiDi session，参考 AdsPower 不常驻 session 的做法。
      // 后续 cookie 读取通过 cookies.sqlite 完成，不依赖 BiDi 连接。
      if (isFirefox) {
        try {
          await this.browser.releaseSession()
          console.log('[AfterLaunchTask] Firefox BiDi session released after page reload')
        }
        catch (err) {
          console.warn('[AfterLaunchTask] Failed to release Firefox BiDi session:', err)
        }
      }

      const saveCookies = async () => {
        if (!this.browser.client) {
          return
        }

        try {
          const { cookies } = await this.browser.client.Storage.getCookies()
          this.cookies = cookies as Protocol.Network.Cookie[]
        }
        catch (error) {
          console.error('Failed to save cookies:', error)
        }
      }

      // Chrome 特定功能：移动端触摸模拟（Firefox 没有 CDP，跳过）
      if (!isFirefox && this.isPhone && this.browser.actualPort) {
        try {
          const targets = await CDP.List({ port: this.browser.actualPort })
          targets.forEach(async (target) => {
            const client = await CDP({ target: target.webSocketDebuggerUrl })
            await client.Emulation.setTouchEmulationEnabled({ enabled: true, configuration: 'mobile' })
            console.log('setTouchEmulationEnabled success')
          })
        }
        catch (error) {
          console.log('setTouchEmulationEnabled error (may not be supported by this browser):', error)
        }
      }

      // const pages = await this.browser?.pages()
      // // cookie导入成功后，把打开的tab页重新加载一次
      // pages.map(async (e) => {
      //   const target = e.target()
      //   const url = target.url()
      //   if (url && url !== 'about:blank') {
      //     await e.goto(url).catch((err) => {
      //       console.log(`goto ${url} failed`, err)
      //     })
      //   }
      // })

      // 是否同步 cookie
      if (syncCookie) {
        this.browser.on('targetchanged', saveCookies)
        this.browser.on('targetcreated', saveCookies)
        this.browser.on('targetdestroyed', saveCookies)

        // Firefox：BiDi session 已在 cookie 导入后释放，不使用 BiDi 轮询定时器。
        // cookie 将在浏览器关闭时通过 saveCookiesNow() 从 cookies.sqlite 读取，参考 AdsPower 做法。
        if (isFirefox) {
          return
        }

        this.cookieTimer = setInterval(() => {
          saveCookies()
        }, 3 * 1000)

        // 监听真正的网络响应 (Network.responseReceived)

        /**
         * 节流处理，避免在一个页面有多个连续请求（均返回 set-cookie）时触发过度频繁的存储
         */
        const throttledSaveCookies = debounce(() => {
          saveCookies()
        }, 500)

        /**
         * 给页面创建并绑定独立的 CDP Session，监听网络层响应
         */
        const setupNetworkListener = async (page: ChromePage) => {
          try {
            if (typeof page.createCDPSession === 'function') {
              const session = await page.createCDPSession()
              await session.send('Network.enable').catch(() => {
              // 忽略重复 enable 可能带来的报错
              })
              // 为了捕获原始的 Set-Cookie，必须监听 ExtraInfo 事件
              session.on('Network.responseReceivedExtraInfo', (event: any) => {
                const headers = event.headers || {}
                // console.debug('responseReceivedExtraInfo', event)

                // 匹配包含 set-cookie 的响应头（因为 ExtraInfo 返回的 key 可能大小写不一致）
                const hasSetCookie = Object.keys(headers).some(k => k.toLowerCase() === 'set-cookie')
                if (hasSetCookie) {
                // console.debug(`[CDP] Detected Set-Cookie via ExtraInfo`)
                  throttledSaveCookies()
                }
              })
            }
          }
          catch (e) {
            console.debug('setupNetworkListener error:', e)
          }
        }

        // 1. 给浏览器刚打开时就存在的页面绑定底层监听
        if (pages && pages.length) {
          pages.forEach(p => setupNetworkListener(p as unknown as ChromePage))
        }

        // 2. 监听将来通过脚本或者点击 a 标签跳出的新标签页
        this.browser.on('targetcreated', (target: ChromeTarget) => {
        // target 刚弹出来时，内部的 ChromePage 实例通常还处于初始化中，稍微延迟下
          setTimeout(async () => {
            try {
              const currentPages = await this.browser?.pages()
              const newPage = currentPages?.find(p => p.target()._targetId === target._targetId) as ChromePage | undefined
              if (newPage) {
                setupNetworkListener(newPage)
              }
            }
            catch (e) { }
          })
        })
      }
    }
    finally {
      if (isFirefox) {
        this.markFirefoxBidiIdle()
      }
    }
  }

  /** 定时检测浏览器网页 IP 变化 */
  async checkIpChange() {
    const ipChangeRemind = this.browserItem.winInfo.ipChangeRemind === 2
      ? store.ipChangeModal
      : this.browserItem.winInfo.ipChangeRemind

    // 如果 IP 变化时弹窗提示关闭，则不检测 IP 变化
    if (!ipChangeRemind || this.continueAccess) {
      return
    }

    clearTimeout(this.checkIpChangeTimer!)
    this.checkIpChangeTimer = setTimeout(() => {
      this.checkIpChange()
    }, 1000 * 8)

    // const activePageTargetId = await SyncControlUtil.getActivePageTargetId(this.browserItem)
    // const activePage = await this.browser?.pages().then(pages => pages.find(page => page.target()._targetId === activePageTargetId))

    // Firefox：BiDi session 在启动后已释放，无法通过 BiDi 获取页面，跳过 IP 变化检测
    const isFirefoxSessionReleased = this.browserItem.isFirefox
      && this.browser && !(this.browser as any).bidiClient?.isConnected?.()
    if (isFirefoxSessionReleased) {
      return
    }

    const allPages = await this.browser?.pages().catch(() => [] as any[])
    allPages.map(async (activePage) => {
      // if (activePage) {
      // 在网页里面发送检测 IP 请求
      const latestProxyInfo = await this.browserItem.proxyDetection().catch(() => ({ ip: '', city: '' }))

      console.debug('Current IP', latestProxyInfo.ip)
      console.debug('Previous IP', this.browserItem.beforeLaunchTask.proxyInfo.ip)
      if (latestProxyInfo.ip && this.browserItem.beforeLaunchTask.proxyInfo.ip && latestProxyInfo.ip !== this.browserItem.beforeLaunchTask.proxyInfo.ip) {
        const dialogHtmlString = await ejs.renderFile(join(appConfig.htmlTemplateDir, 'ip-change-modal.ejs'), {
          latestProxyInfo,
          beforeProxyInfo: this.browserItem.beforeLaunchTask.proxyInfo,
          title: $t('IP 变化提醒'),
          description: $t('您的 IP 地址已变化，当前 IP 位置：{city}，当前 IP：{ip}。', {
            city: latestProxyInfo.city,
            ip: latestProxyInfo.ip,
          }),
          ask: $t('您确定要继续使用该窗口吗？'),
          cancelBtnText: $t('关闭窗口'),
          confirmBtnText: $t('继续使用'),
          baseUrl: await getWebEntryUrl(''),
        })

        const result = await activePage.evaluate((html) => {
          const dialog = document.querySelector<HTMLDialogElement>('#roxy-modal-container')
          if (!dialog) {
            let resolve, reject
            const promise = new Promise((res, rej) => {
              resolve = res
              reject = rej
            })
            if (!document.body) {
              return null
            }

            const escapeHTMLPolicy = (window as any).trustedTypes?.createPolicy?.('myEscapePolicy', {
              createHTML: (string: string) => string,
            })
            const htmlToInsert = escapeHTMLPolicy?.createHTML?.(html) ?? html
            document.body.insertAdjacentHTML('beforeend', htmlToInsert as string)
            const dialog = document.querySelector<HTMLDialogElement>('#roxy-modal')
            const cancelBtn = document.querySelector('#roxy-modal #cancelBtn')
            const confirmBtn = document.querySelector('#roxy-modal #confirmBtn')
            const dialogContainer = document.querySelector<HTMLDivElement>('#roxy-modal-container')!

            cancelBtn?.addEventListener('click', () => {
              resolve('close-window')
              dialog?.close()
              dialogContainer.style.display = 'none'
            })

            confirmBtn?.addEventListener('click', () => {
              resolve('continue-access')
              dialog?.close()
              dialogContainer.style.display = 'none'
            })

            return promise
          }
        }, dialogHtmlString)

        console.debug('checkIpChange modal result', result)

        if (result === 'close-window') {
          this.browserItem.close()
        }
        else if (result === 'continue-access') {
          this.continueAccess = true

          const pages = await this.browser?.pages()
          pages.forEach((page) => {
            page.evaluate(() => {
              const dialog = document.querySelector<HTMLDialogElement>('#roxy-modal-container')
              if (dialog) {
                dialog.style.display = 'none'
              }
            })
          })
        }
        // }
      }
    })
  }

  /** cookie robot 应跳过的 URL（Chrome / Firefox 内置页、扩展页等） */
  private shouldSkipCookieRobotUrl(url: string): boolean {
    if (!url || url === 'about:blank') {
      return true
    }
    const skipPrefixes = [
      'chrome://',
      'devtools://',
      'moz-extension://',
      'resource://',
      'view-source:',
    ]
    if (skipPrefixes.some(prefix => url.startsWith(prefix))) {
      return true
    }
    if (url.startsWith('about:') && url !== 'about:blank') {
      return true
    }
    return false
  }

  /** 获取当前浏览器实例（与 BrowserItem 保持同一引用） */
  private getActiveBrowser(): IBrowser | null {
    return this.browserItem.beforeLaunchTask?.browser ?? this.browser ?? null
  }

  /**
   * 通过 WS 等方式在已打开的浏览器中打开 URL。
   * Firefox 启动后会 releaseSession()，须先等待 idle 再 reconnectBiDi。
   */
  async openUrls(urls: string[]): Promise<void> {
    const list = urls.filter(Boolean)
    if (!list.length) {
      return
    }

    if (this.browserItem.isFirefox) {
      const firefoxBrowser = await this.ensureFirefoxBiDiForCookieRobot()
      if (!firefoxBrowser) {
        return
      }
      try {
        for (const url of list) {
          try {
            await firefoxBrowser.newPage(url)
          }
          catch (error) {
            console.error(`[AfterLaunchTask] openUrls failed for ${url}:`, error)
          }
        }
      }
      finally {
        try {
          if (firefoxBrowser.getBidiClient().isConnected()) {
            await firefoxBrowser.releaseSession()
          }
        }
        catch (error) {
          console.warn('[AfterLaunchTask] openUrls: failed to release Firefox BiDi session:', error)
        }
      }
      return
    }

    const browser = this.getActiveBrowser()
    if (!browser) {
      console.warn('[AfterLaunchTask] openUrls: browser not available')
      return
    }

    for (const url of list) {
      try {
        await browser.newPage(url)
      }
      catch (error) {
        console.error(`[AfterLaunchTask] openUrls failed for ${url}:`, error)
      }
    }
  }

  /**
   * Firefox 在启动后会 releaseSession()；cookie robot / openUrls 需临时重连 BiDi。
   */
  private async ensureFirefoxBiDiForCookieRobot(): Promise<FirefoxBrowser | null> {
    if (!this.browserItem.isFirefox) {
      return null
    }

    // 等待本 profile 启动后 releaseSession 完成，避免与并行 batchLaunch 中的 handleBrowserEvent 竞态
    await this.firefoxBidiIdleDeferred.promise

    const browser = this.getActiveBrowser() as FirefoxBrowser | null
    if (!browser?.reconnectBiDi) {
      console.warn('Cookie robot: Firefox browser instance is not available')
      return null
    }

    try {
      await browser.reconnectBiDi()
      this.browser = browser
      return browser
    }
    catch (error) {
      console.error('Cookie robot: Failed to reconnect Firefox BiDi session:', error)
      return null
    }
  }

  /**
   * Cookie 机器人：自动滚动所有标签页以触发 cookie 更新
   * @param options 配置选项
   * @param options.cookieRobotUrls cookie robot 目标 urls
   * @param options.scrollRange 滚动距离范围（像素），默认 [0, 500]
   * @param options.delayRange 标签页之间的延迟范围（毫秒），默认 [0, 3000]
   * @param options.pageLoadTimeout 页面加载超时时间（毫秒），默认 60000 (60秒)
   * @param options.closeProfile 执行完毕后自动关闭 cookie robot，默认 false
   */
  async cookieRobot(options?: {
    cookieRobotUrls: string[]
    scrollRange?: [number, number]
    delayRange?: [number, number]
    pageLoadTimeout?: number
    closeProfile?: boolean
  }) {
    if (this.cookieRobotRunning) {
      console.warn('[Cookie robot] Already running on this profile, skip duplicate invoke')
      return
    }
    this.cookieRobotRunning = true
    try {
      const cookieRobotUrls = options?.cookieRobotUrls
      const scrollRange = options?.scrollRange || [100, 500]
      const delayRange = options?.delayRange || [0, 500]
      const pageLoadTimeout = options?.pageLoadTimeout || 60000
      const closeProfile = options?.closeProfile || false
      const isFirefox = this.browserItem.isFirefox

      if (!cookieRobotUrls?.length) {
        console.warn('Cookie robot: No URLs to process')
        return
      }

      if (isFirefox) {
        const firefoxBrowser = await this.ensureFirefoxBiDiForCookieRobot()
        if (!firefoxBrowser) {
          return
        }
      }
      else if (!this.getActiveBrowser()) {
        console.warn('Cookie robot: Browser is not available')
        return
      }

      const browser = this.getActiveBrowser()!
      this.browser = browser

      try {
        console.log(`Cookie robot: Starting to process ${cookieRobotUrls.length} URLs (${isFirefox ? 'Firefox' : 'Chrome'})`)

        // 串行处理每个 URL
        for (let i = 0; i < cookieRobotUrls.length; i++) {
          const url = cookieRobotUrls[i]

          if (this.shouldSkipCookieRobotUrl(url)) {
            console.log(`Cookie robot: Skipping URL ${i + 1} (${url})`)
            continue
          }

          try {
            console.log(`Cookie robot: Opening tab ${i + 1}/${cookieRobotUrls.length} (${url})`)

            // 如果是第一个 tab，先记录用户之前的所有 tab，稍后关闭
            const pagesToClose = await browser.pages()
            // 打开新标签页
            const page = await browser.newPage(url)
            // 关闭之前记录的旧 tab
            if (i === 0 && pagesToClose.length > 0) {
              pagesToClose.forEach((p) => {
                p.close().catch(() => { })
              })
            }

            // 聚焦当前标签页
            console.log(`Cookie robot: Bringing tab ${i + 1} to front`)
            if (page.bringToFront) {
              await page.bringToFront().catch((err: any) => {
                console.warn(`Cookie robot: Failed to bring tab ${i + 1} to front:`, err)
              })
            }

            // 等待一小段时间让标签页切换完成
            await new Promise(resolve => setTimeout(resolve, 300))

            console.log(`Cookie robot: Waiting for tab ${i + 1} to load...`)

            // Firefox：用 BiDi navigate 的 complete 等待；Chrome：在页面内轮询 readyState
            if (isFirefox) {
              await page.goto({ url, wait: 'complete' }).catch((err: unknown) => {
                console.warn(`Cookie robot: Firefox wait for load on tab ${i + 1} failed:`, err)
              })
            }
            else {
              await page.evaluate((timeoutValue) => {
                return new Promise<string>((resolve) => {
                  console.log('evaluate cookie robot: ', document.readyState)
                  if (document.readyState === 'complete') {
                    resolve('complete')
                    return
                  }

                  let resolved = false
                  const finish = (reason: string) => {
                    if (!resolved) {
                      resolved = true
                      resolve(reason)
                    }
                  }

                  window.addEventListener('load', () => finish('loadEvent'), { once: true })
                  setTimeout(finish, timeoutValue as number, 'timeout')
                })
              }, pageLoadTimeout).catch(() => { })
            }

            // 额外等待 500ms 确保页面完全渲染
            await new Promise(resolve => setTimeout(resolve, 500))

            // 等待图片开始加载，避免因图片未加载导致页面高度不足
            console.log(`Cookie robot: Waiting for images to load on tab ${i + 1}`)
            await page.evaluate(() => {
              return new Promise<void>((resolve) => {
                const images = Array.from(document.querySelectorAll('img'))
                if (images.length === 0) {
                  resolve()
                  return
                }

                let loadedCount = 0
                let timeoutId: NodeJS.Timeout

                const checkComplete = () => {
                  loadedCount++
                  // 等待至少 30% 的图片加载完成，或者全部加载完成
                  if (loadedCount >= Math.ceil(images.length * 0.3) || loadedCount >= images.length) {
                    clearTimeout(timeoutId)
                    resolve()
                  }
                }

                // 为每个图片添加加载监听
                images.forEach((img) => {
                  if (img.complete) {
                    checkComplete()
                  }
                  else {
                    img.addEventListener('load', checkComplete, { once: true })
                    img.addEventListener('error', checkComplete, { once: true })
                  }
                })

                // 最多等待 3 秒
                timeoutId = setTimeout(() => {
                  resolve()
                }, 3000)
              })
            }).catch(() => {
              console.warn(`Cookie robot: Failed to wait for images on tab ${i + 1}`)
            })

            // 多次滚动直到到达页面底部
            let scrollCount = 0
            let hasReachedBottom = false
            /**
             * 记录页面不可滚动的重试次数
             */
            let notScrollableRetryCount = 0
            /**
             * 最多重试 3 次
             */
            const maxNotScrollableRetries = 3

            console.log(`Cookie robot: Starting to scroll tab ${i + 1} until reaching bottom`)

            while (!hasReachedBottom) {
              scrollCount++

              // 每次滚动前先聚焦到当前 tab，防止插件弹出的 tab 干扰
              if (page.bringToFront) {
                await page.bringToFront().catch((err: any) => {
                  console.warn(`Cookie robot: Failed to bring tab ${i + 1} to front before scroll ${scrollCount}:`, err)
                })
              }

              // 生成随机滚动距离
              const scrollDistance = Math.floor(
                Math.random() * (scrollRange[1] - scrollRange[0]) + scrollRange[0],
              )

              console.log(`Cookie robot: Tab ${i + 1} - Scroll ${scrollCount}, distance: ${scrollDistance}px`)

              const scrollResult = await page.evaluate((distance) => {
                return new Promise((resolve) => {
                  console.log('[Cookie robot] evaluate: start scroll')

                  const scrollingElement = document.scrollingElement || document.documentElement
                  const getWindowMaxScroll = () => Math.max(
                    0,
                    Math.max(
                      scrollingElement.scrollHeight,
                      document.body.scrollHeight,
                      document.documentElement.scrollHeight,
                    ) - window.innerHeight,
                  )

                  const findScrollContainer = () => {
                    let best: Element | null = null
                    let bestMax = 0
                    const selectors = ['main', '[role="main"]', 'ytd-app', '#content', '#app', '#page']
                    for (const sel of selectors) {
                      const el = document.querySelector(sel)
                      if (!el || !(el instanceof HTMLElement)) {
                        continue
                      }
                      const max = el.scrollHeight - el.clientHeight
                      if (max > bestMax) {
                        bestMax = max
                        best = el
                      }
                    }
                    return bestMax > 0 ? { el: best, maxScroll: bestMax } : null
                  }

                  const windowMax = getWindowMaxScroll()
                  const containerInfo = findScrollContainer()
                  const useContainer = containerInfo && containerInfo.maxScroll > windowMax
                  const maxScrollY = useContainer ? containerInfo!.maxScroll : windowMax

                  if (maxScrollY <= 0) {
                    resolve({ scrolled: false, reachedBottom: false, notScrollable: true, reason: 'Page not scrollable' })
                    return
                  }

                  const getPosition = () => useContainer
                    ? (containerInfo!.el as HTMLElement).scrollTop
                    : window.scrollY

                  const doScroll = (delta: number) => {
                    if (useContainer) {
                      (containerInfo!.el as HTMLElement).scrollTop += delta
                    }
                    else {
                      window.scrollBy({ top: delta, behavior: 'smooth' })
                    }
                  }

                  const startPosition = getPosition()

                  if (startPosition >= maxScrollY - 10) {
                    resolve({ scrolled: false, reachedBottom: true, reason: 'Already at bottom', startPosition, maxScrollY })
                    return
                  }

                  doScroll(distance as number)

                  let lastPosition = startPosition
                  let samePositionCount = 0
                  const checkInterval = setInterval(() => {
                    const currentMaxScrollY = useContainer
                      ? containerInfo!.maxScroll
                      : getWindowMaxScroll()
                    const currentPosition = getPosition()

                    if (Math.abs(currentPosition - lastPosition) < 1) {
                      samePositionCount++
                      if (samePositionCount >= 3) {
                        clearInterval(checkInterval)
                        const reachedBottom = currentPosition >= currentMaxScrollY - 10
                        resolve({
                          scrolled: true,
                          reachedBottom,
                          startPosition,
                          finalPosition: currentPosition,
                          maxScrollY: currentMaxScrollY,
                        })
                      }
                    }
                    else {
                      samePositionCount = 0
                      lastPosition = currentPosition
                    }
                  }, 100)

                  setTimeout(() => {
                    clearInterval(checkInterval)
                    const currentMaxScrollY = useContainer
                      ? containerInfo!.maxScroll
                      : getWindowMaxScroll()
                    const currentPosition = getPosition()
                    const reachedBottom = currentPosition >= currentMaxScrollY - 10
                    resolve({
                      scrolled: true,
                      reachedBottom,
                      timeout: true,
                      startPosition,
                      finalPosition: currentPosition,
                      maxScrollY: currentMaxScrollY,
                    })
                  }, 2000)
                })
              }, scrollDistance).catch((e: any) => {
                console.error(`Cookie robot: Tab ${i + 1} scroll error:`, e)
                return { scrolled: false, reachedBottom: true, error: true }
              })

              if (scrollResult) {
                console.log(`Cookie robot: Tab ${i + 1} - Scroll ${scrollCount} completed`, scrollResult)

                // 处理页面不可滚动的情况
                if (scrollResult.notScrollable) {
                  notScrollableRetryCount++
                  console.log(`Cookie robot: Tab ${i + 1} - Page not scrollable, retry ${notScrollableRetryCount}/${maxNotScrollableRetries}`)

                  if (notScrollableRetryCount >= maxNotScrollableRetries) {
                  // 重试次数用完，认为页面确实不可滚动
                    console.log(`Cookie robot: Tab ${i + 1} - Page confirmed not scrollable after ${maxNotScrollableRetries} retries`)
                    hasReachedBottom = true
                  }
                  else {
                  // 等待更长时间让图片加载
                    console.log(`Cookie robot: Tab ${i + 1} - Waiting 2s for images to load before retry`)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    hasReachedBottom = false
                  }
                }
                else {
                // 页面可以滚动，重置重试计数
                  notScrollableRetryCount = 0
                  hasReachedBottom = scrollResult.reachedBottom || false
                }
              }
              else {
              // 如果滚动失败，退出循环
                hasReachedBottom = true
              }

              // 如果还没到底部，等待一段时间再继续滚动
              if (!hasReachedBottom) {
                const delay = Math.floor(Math.random() * (delayRange[1] - delayRange[0]) + delayRange[0])
                console.log(`Cookie robot: Tab ${i + 1} - Waiting ${delay}ms before next scroll`)
                await new Promise(resolve => setTimeout(resolve, delay))
              }
            }

            console.log(`Cookie robot: Tab ${i + 1} completed after ${scrollCount} scrolls`)
          }
          catch (error) {
            console.error(`Cookie robot: Failed to process URL ${i + 1} (${url}):`, error)
          }
        }

        console.log('Cookie robot: Completed processing all URLs')
      }
      catch (error) {
        console.error('Cookie robot: Failed to execute:', error)
      }
      finally {
        if (isFirefox) {
          try {
            await this.saveCookiesNow()
            console.log('[Cookie robot] Firefox cookies saved to cache')
          }
          catch (error) {
            console.error('[Cookie robot] Failed to save Firefox cookies:', error)
          }
          try {
            const firefoxBrowser = browser as FirefoxBrowser
            if (firefoxBrowser.getBidiClient().isConnected()) {
              await firefoxBrowser.releaseSession()
              console.log('[Cookie robot] Firefox BiDi session released after cookie robot')
            }
          }
          catch (error) {
            console.warn('[Cookie robot] Failed to release Firefox BiDi session:', error)
          }
        }

        if (closeProfile) {
          browser.close()
        }
      }
    }
    finally {
      this.cookieRobotRunning = false
    }
  }
}
