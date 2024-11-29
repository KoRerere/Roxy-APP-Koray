import type { Browser } from 'puppeteer-core'
import { readFile, rm, stat } from 'node:fs/promises'
import type { BrowserItem } from './browserItem'

/** 浏览器启动后要做的事情 */
export class AfterLaunchTask {
  /** 最新的 cookies */
  private cookies = ''
  /** 判断是否手机端 */
  get isPhone() {
    return [`Android`, `IOS`].includes(this.browserItem.winInfo.os)
  }

  constructor(private browserItem: BrowserItem, public browser: Browser) { }

  async run() {
    this.handleBrowserEvent()
  }

  /** 获取标签页 */
  async getDefaultOpenUrl() {
    // 同步 浏览器已经打开tabs标签
    let defaultOpenUrl = []
    try {
      const roxyTabs = await readFile(this.browserItem.roxyTabsPath, 'utf8')
      defaultOpenUrl = JSON.parse(roxyTabs).filter(url => this.browserItem.isValidURL(url))
      console.log('同步标签页 roxy_tabs', defaultOpenUrl)
      // 如果浏览器是由于关闭最后一个标签页而导致关闭的，这个时候龙哥会检测不到，所以每次读完 roxy_tabs，都要删除
      rm(this.browserItem.roxyTabsPath)
    } catch (error) {
      console.log(`roxy_tabs 文件不存在 跳过`, error)
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
        console.log('lumiLogin文件超过1M，不同步到服务器', stats.size)
      }
      console.log('lumiLogin', lumiLogin)
    }
    catch (error) {
      console.log(`lumiLogin 文件不存在 跳过`, error)
    }
    return lumiLogin
  }

  /** 获取需要同步的数据 */
  async getUploadData() {
    const defaultOpenUrl = await this.getDefaultOpenUrl()
    const lumiLogin = await this.getLumiLogin()

    return {
      id: this.browserItem.winInfo.id,
      defaultOpenUrl,
      cookie: this.cookies || [],
      lumiLogin,
    }
  }

  /** 处理浏览器事件 */
  async handleBrowserEvent() {
    const { cookie, syncCookie } = this.browserItem.winInfo

    if (!this.browser) {
      return
    }

    const createCDPSession = async () => {
      return this.browser.target().createCDPSession()
    }

    const cdpSession = await createCDPSession().catch((err) => {
      console.log('创建cdpSession失败', err)
      return Promise.reject(err)
    })

    const saveCookies = async () => {
      const { cookies } = await cdpSession.send('Storage.getCookies')
      this.cookies = JSON.stringify(cookies)
    }

    console.log('createCDPSession success')

    const startTime = Date.now()

    // 是否同步 cookie
    if (syncCookie) {
      // 导入 cookie
      if (cookie) {
        await cdpSession.send('Storage.setCookies', { cookies: cookie }).catch((err) => {
          console.log('导入cookie失败', err)
        })
        console.log('Storage.setCookies success')
        console.log('导入 cookie 耗时：', Date.now() - startTime, 'ms')
      }

      this.browser.on('targetchanged', saveCookies)
      this.browser.on('targetcreated', saveCookies)
      this.browser.on('targetdestroyed', saveCookies)
    }

  }
}
