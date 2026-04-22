import type { Page, Protocol } from 'puppeteer-core'
import { Injectable, Logger } from '@nestjs/common'
import { BrowserService } from './browser.service'

/**
 * Cookie 管理服务
 * 通过 CDP 协议读写浏览器 cookie
 */
@Injectable()
export class CookieService {
  private readonly logger = new Logger(CookieService.name)

  constructor(
    private readonly browserService: BrowserService,
  ) {}

  /**
   * 通过 CDP 获取浏览器中的全部 cookie
   * @param sessionKey userId:dirId 复合键
   */
  async getAllCookies(sessionKey: string): Promise<Protocol.Network.Cookie[]> {
    const page = await this.getPrimaryPage(sessionKey, '读取 Cookie')
    if (!page) {
      return []
    }

    try {
      const cdp = await page.createCDPSession()
      const { cookies } = await cdp.send('Network.getAllCookies')
      await cdp.detach()
      return cookies
    }
    catch (error: any) {
      this.logCookieError('获取 Cookie', sessionKey, error)
      return []
    }
  }

  /**
   * 批量导入 cookie 到浏览器
   * @param sessionKey userId:dirId 复合键
   */
  async importCookies(sessionKey: string, cookies: Protocol.Network.CookieParam[]): Promise<void> {
    const page = await this.getPrimaryPage(sessionKey, '导入 Cookie')
    if (!page) {
      return
    }

    try {
      const cdp = await page.createCDPSession()
      await cdp.send('Network.setCookies', { cookies })
      await cdp.detach()
      this.logger.log(`已为会话键 ${sessionKey} 导入 ${cookies.length} 条 Cookie`)
    }
    catch (error: any) {
      this.logCookieError('导入 Cookie', sessionKey, error)
    }
  }

  /**
   * 清除浏览器全部 cookie
   * @param sessionKey userId:dirId 复合键
   */
  async clearAllCookies(sessionKey: string): Promise<void> {
    const page = await this.getPrimaryPage(sessionKey, '清空 Cookie')
    if (!page)
      return

    try {
      const cdp = await page.createCDPSession()
      await cdp.send('Network.clearBrowserCookies')
      await cdp.detach()
      this.logger.log(`已清空会话键 ${sessionKey} 的全部 Cookie`)
    }
    catch (error: any) {
      this.logCookieError('清空 Cookie', sessionKey, error)
    }
  }

  private async getPrimaryPage(sessionKey: string, action: string): Promise<Page | null> {
    const browser = this.browserService.getBrowser(sessionKey)
    if (!browser) {
      this.logger.warn(`没有可用的浏览器连接，无法${action}，会话键=${sessionKey}`)
      return null
    }

    try {
      const pages = await browser.pages()
      return pages[0] || await browser.newPage()
    }
    catch (error: any) {
      this.logCookieError(action, sessionKey, error)
      return null
    }
  }

  private logCookieError(action: string, sessionKey: string, error: any): void {
    if (this.isBrowserConnectionClosed(error)) {
      this.logger.warn(`${action}时浏览器连接已失效，会话键=${sessionKey}：${error.message}`)
      return
    }

    this.logger.error(`${action}失败，会话键=${sessionKey}：${error.message}`)
  }

  private isBrowserConnectionClosed(error: any): boolean {
    const message = String(error?.message || '').toLowerCase()
    return message.includes('target closed')
      || message.includes('session closed')
      || message.includes('connection closed')
      || message.includes('browser has disconnected')
  }
}
