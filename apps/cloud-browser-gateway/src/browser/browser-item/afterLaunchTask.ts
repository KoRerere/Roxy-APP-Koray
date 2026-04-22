import type { BrowserItem } from './browserItem'
import type { Browser, CDPSession, Page, Protocol, Target } from 'puppeteer-core'
import { debounce } from 'es-toolkit'
import { readFile, rm, stat } from 'node:fs/promises'
import { OPEN_URLS_FILE } from '~/constants/common'

/** 浏览器启动后的 Cookie 同步与数据收集任务 */
export class AfterLaunchTask {
  private cookies: Protocol.Network.Cookie[] = []
  private cookieTimer: ReturnType<typeof setInterval> | null = null
  private disposed = false
  private readonly cleanupHandlers: Array<() => void> = []
  private readonly networkSessions = new Set<CDPSession>()

  constructor(
    private browserItem: BrowserItem,
    private browser: Browser,
  ) {}

  /** 启动后挂接必要监听，并执行首轮页面与 cookie 初始化 */
  async run() {
    const onDisconnected = () => {
      this.dispose()
    }
    this.browser.on('disconnected', onDisconnected)
    this.cleanupHandlers.push(() => this.browser.off('disconnected', onDisconnected))
    await this.handleBrowserEvent()
  }

  /** 获取需要上传的数据（tabs/lumiLogin/cookies） */
  async getUploadData() {
    const defaultOpenUrl = await this.getDefaultOpenUrl()
    const lumiLogin = await this.getLumiLogin()
    const { id, syncCookie, cookie } = this.browserItem.winInfo
    return {
      id,
      defaultOpenUrl,
      cookie: syncCookie ? (this.cookies || []) : cookie,
      lumiLogin,
    }
  }

  /** 释放定时器、事件监听和长生命周期 CDP session。 */
  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true

    if (this.cookieTimer) {
      clearInterval(this.cookieTimer)
      this.cookieTimer = null
    }

    for (const cleanup of this.cleanupHandlers.splice(0)) {
      cleanup()
    }

    for (const session of this.networkSessions) {
      void session.detach().catch(() => {})
    }
    this.networkSessions.clear()
  }

  /** 立即抓取当前 cookies，供停止前做最后一次同步 */
  async captureCookies(): Promise<void> {
    if (this.disposed || !this.browser.connected) {
      return
    }

    try {
      const currentPages = await this.browser.pages()
      if (this.disposed || !this.browser.connected) {
        return
      }

      const page = currentPages[0]
      if (!page)
        return

      const cdp = await page.createCDPSession()
      try {
        const { cookies } = await cdp.send('Network.getAllCookies') as { cookies: Protocol.Network.Cookie[] }
        this.cookies = cookies
      }
      finally {
        await cdp.detach().catch(() => {})
      }
    }
    catch (error) {
      if (this.isConnectionClosedError(error)) {
        this.dispose()
        return
      }
      console.error('保存 Cookie 失败：', error)
    }
  }

  /** 获取当前打开的标签页 URL */
  private async getDefaultOpenUrl(): Promise<string[]> {
    let defaultOpenUrl: string[] = []
    try {
      const roxyTabs = await readFile(this.browserItem.roxyTabsPath, 'utf8')
      defaultOpenUrl = JSON.parse(roxyTabs).filter((url: string) => this.browserItem.isValidURL(url))
      rm(this.browserItem.roxyTabsPath).catch(() => {})
    }
    catch {
      defaultOpenUrl = this.browserItem.winInfo.defaultOpenUrl || []
    }
    return defaultOpenUrl
  }

  /** 读取 lumiLogin */
  private async getLumiLogin(): Promise<string> {
    try {
      const stats = await stat(this.browserItem.lumiLoginPath)
      if (stats.size < 1024 * 1024) {
        return await readFile(this.browserItem.lumiLoginPath, 'utf8')
      }
      console.log('lumiLogin 文件超过 1M，跳过同步')
    }
    catch {
      // lumiLogin 文件不存在
    }
    return ''
  }

  /** 处理浏览器事件：Cookie 导入与同步 */
  private async handleBrowserEvent() {
    if (this.disposed || !this.browser.connected) {
      return
    }

    const { cookie, syncCookie, clearCookie } = this.browserItem.winInfo

    let pages: Page[]
    try {
      pages = await this.browser.pages()
    }
    catch (error) {
      console.warn('获取浏览器页面失败：', error)
      return
    }

    await this.openAllOpenUrls(pages)
    pages = await this.browser.pages()

    // 移动端触摸模拟
    if ([`Android`, `IOS`].includes(this.browserItem.winInfo.os)) {
      for (const page of pages) {
        try {
          const cdp = await page.createCDPSession()
          await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true } as any)
          await cdp.detach()
        }
        catch (err) {
          console.log('启用触摸模拟失败：', err)
        }
      }
    }

    // 导入 cookie
    if (cookie && !clearCookie) {
      try {
        const page = pages[0] || await this.browser.newPage()
        const cdp = await page.createCDPSession()
        await cdp.send('Storage.setCookies', { cookies: cookie } as any)
        await cdp.detach()
        console.log('Cookie 导入成功')

        // Cookie 导入后重新加载已打开的页面
        for (const p of pages) {
          const url = p.url()
          if (url && url !== 'about:blank') {
            await p.goto(url).catch(err => console.log(`访问 ${url} 失败：`, err))
          }
        }
      }
      catch (err) {
        console.error('导入 Cookie 失败：', err)
      }
    }

    // Cookie 同步
    if (syncCookie) {
      await this.setupCookieSync(pages)
    }
  }

  /** 浏览器启动成功后并行打开 allOpenUrl */
  private async openAllOpenUrls(existingPages: Page[]): Promise<void> {
    const { allOpenUrl = [] } = this.browserItem.winInfo
    const targetUrls = allOpenUrl.filter((url: string) => url && this.browserItem.isValidURL(url))

    if (!targetUrls.length) {
      return
    }

    const openTasks = targetUrls.map(async (url: string, index: number) => {
      try {
        const page = existingPages[index] || await this.browser.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded' })
      }
      catch (error) {
        console.warn(`打开启动 URL 失败：${url}`, error)
      }
    })
    await Promise.allSettled(openTasks)
  }

  /** 设置 Cookie 同步监听 */
  private async setupCookieSync(pages: Page[]) {
    const saveCookies = async () => {
      if (this.disposed || !this.browser.connected) {
        return
      }
      await this.captureCookies()
    }

    const onTargetChanged = () => {
      void saveCookies()
    }
    const onTargetCreated = () => {
      void saveCookies()
    }
    const onTargetDestroyed = () => {
      void saveCookies()
    }

    this.browser.on('targetchanged', onTargetChanged)
    this.browser.on('targetcreated', onTargetCreated)
    this.browser.on('targetdestroyed', onTargetDestroyed)
    this.cleanupHandlers.push(() => this.browser.off('targetchanged', onTargetChanged))
    this.cleanupHandlers.push(() => this.browser.off('targetcreated', onTargetCreated))
    this.cleanupHandlers.push(() => this.browser.off('targetdestroyed', onTargetDestroyed))

    this.cookieTimer = setInterval(saveCookies, 3000)

    const throttledSaveCookies = debounce(() => {
      void saveCookies()
    }, 500)

    const setupNetworkListener = async (page: Page) => {
      try {
        if (this.disposed || !this.browser.connected) {
          return
        }

        const session = await page.createCDPSession()
        this.networkSessions.add(session)
        await session.send('Network.enable').catch(() => {})
        session.on('Network.responseReceivedExtraInfo', (event: any) => {
          if (this.disposed) {
            return
          }
          const headers = event.headers || {}
          const hasSetCookie = Object.keys(headers).some(k => k.toLowerCase() === 'set-cookie')
          if (hasSetCookie) {
            throttledSaveCookies()
          }
        })
      }
      catch (e) {
        if (this.isConnectionClosedError(e)) {
          this.dispose()
          return
        }
        console.debug('设置网络监听失败：', e)
      }
    }

    for (const page of pages) {
      await setupNetworkListener(page)
    }

    const onTargetCreatedForNetwork = (target: Target) => {
      setTimeout(async () => {
        try {
          if (this.disposed || !this.browser.connected) {
            return
          }
          const currentPages = await this.browser.pages()
          const targetInfo = target as any
          const newPage = currentPages.find(p => (p as any).target?.()?.url?.() === targetInfo.url?.())
          if (newPage)
            await setupNetworkListener(newPage)
        }
        catch {}
      }, 300)
    }

    this.browser.on('targetcreated', onTargetCreatedForNetwork)
    this.cleanupHandlers.push(() => this.browser.off('targetcreated', onTargetCreatedForNetwork))
  }

  /** 识别浏览器 CDP 连接已失效的错误，避免在失活连接上无限重试。 */
  private isConnectionClosedError(error: unknown): boolean {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error)

    return /Connection closed|Target closed|Session closed|browser has disconnected|Most likely the page has been closed/i.test(message)
  }
}
