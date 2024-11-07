import type { Browser } from 'puppeteer-core'
import { readFile, stat } from 'node:fs/promises'
import type { BrowserItem } from './browserItem'

/** 浏览器启动后要做的事情 */
export class AfterLaunchTask {
  /** 已打开的tab页 */
  private openedTabs: Record<string, string> = {}

  /** 最新的 cookies */
  private cookies = ''
  /** 判断是否手机端 */
  get isPhone() {
    return [`Android`, `IOS`].includes(this.browserItem.winInfo.os)
  }

  constructor(private browserItem: BrowserItem, public browser: Browser) {

  }

  async run() {
    this.handleBrowserEvent()
  }

  /** 获取需要同步的数据 */
  async getUploadData() {
    // 同步 浏览器已经打开tabs标签
    const defaultOpenUrl = Object.values(this.openedTabs).filter(url => this.browserItem.isValidURL(url))
    console.log('同步标签页 新', defaultOpenUrl)
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
      const pages = await this.browser.pages()
      return pages[0].target().createCDPSession()
    }

    // const client = await this.browser.target().createCDPSession();
    const pages = await this.browser.pages().catch((err) => {
      console.log('获取pages失败', err)
      return Promise.reject(err)
    })
    console.log('get pages success')

    pages.forEach(async (page, index) => {
      const targetInfo = page.target()?._getTargetInfo()
      if (targetInfo && targetInfo.targetId && targetInfo.url && targetInfo.type === 'page') {
        // 刚拉起浏览器时，保存所有打开的tab页，避免页面未加载完成时，关闭浏览器导致的tab页丢失
        this.openedTabs[targetInfo.targetId] = targetInfo.url
      }
      console.log(`Page ${index + 1}: ${targetInfo.url}`, targetInfo.targetId)
    })

    let cdpSession = await createCDPSession().catch((err) => {
      console.log('创建cdpSession失败', err)
      return Promise.reject(err)
    })

    console.log('createCDPSession success')

    await cdpSession.send('Network.enable').catch((err) => {
      console.log('Network.enable 失败', err)
    })
    console.log('Network.enable success')

    const startTime = Date.now()

    if (syncCookie && cookie) {
      await cdpSession.send('Network.setCookies', { cookies: cookie }).catch((err) => {
        console.log('导入cookie失败', err)
      })
      console.log('Network.setCookies success')
    }

    // cookie导入成功后，把打开的tab页重新加载一次
    pages.map(async (e) => {
      const target = e.target()
      const url = target.url()
      if (url && url !== 'about:blank') {
        await e.goto(url).catch((err) => {
          console.log(`goto ${url} 失败`, err)
        })
        if (!this.isPhone) {
          e.evaluate(() => {
            window.console.debug = function (_) { }
          })
        }
      }
    })
    console.log('导入 cookie 耗时：', Date.now() - startTime, 'ms')

    // await client.send('Storage.setCookies', {
    //   cookies: Array.isArray(this.cookies) ? this.cookies : []
    // }).catch((err) => {
    //   console.log('导入cookie失败', err)
    // })

    this.browser.on('targetchanged', async (target) => {
      // type为page的时候，保存
      if (target.type() === 'page') {
        this.openedTabs[target._targetId] = target.url()
        console.log(' url 改变', target.url(), target._targetId)
      }
      const { cookies } = await cdpSession.send('Network.getAllCookies')
      this.cookies = JSON.stringify(cookies)
      // console.log(this.cookies)
    })
    this.browser.on('targetcreated', async (target) => {
      if (target.type() === 'page' && !['about:blank', 'chrome://newtab/'].includes(target.url())) {
        console.log('目标被创建', target.type(), target._targetId, target.url())
        this.openedTabs[target._targetId] = target.url()
      }
      if (syncCookie) {
        const { cookies } = await cdpSession.send('Network.getAllCookies')
        this.cookies = JSON.stringify(cookies)
      }
      // console.log(this.cookies)
    })
    this.browser.on('targetdestroyed', async (target) => {
      console.log('targetdestroyed', target.url(), target._targetId)
      let deleted_target_id = ''
      let should_delete = false
      try {
        const targetType = target.type()
        if (targetType === 'page') {
          deleted_target_id = target._targetId
          console.log('目标被销毁', target.url(), target._targetId, targetType)
        }
        if (syncCookie) {
          const { cookies } = await cdpSession.send('Network.getAllCookies')
          this.cookies = JSON.stringify(cookies)
        }

        // 如果走到这里来说明是手动关闭tab页
        if (targetType === 'page') {
          should_delete = true
          console.log('手动关闭tab页', target.url(), target._targetId)
        }
      }
      catch (error) {
        // 这里，说明关闭的那个tab页引用了cdpsession, 但是不确定是关闭浏览器还是tab页
        console.log(`targetdestroyed=>${error}`)
        try {
          const errMsg = error.toString()
          const errKeyword = ['TargetCloseError', 'Target closed', 'Session closed', 'No target with id']
          if (errKeyword.some(keyword => errMsg.includes(keyword))) {
            console.log('重新创建cdpsession')
            cdpSession = await createCDPSession()
            if (syncCookie) {
              const { cookies } = await cdpSession.send('Network.getAllCookies')
              this.cookies = JSON.stringify(cookies)
            }
            // 这里说明cdpsession能创建成功, 浏览器没有关闭，关闭的只是一个tab页，要tabs中删除
            should_delete = true
          }
        }
        catch (error) {
          console.log('重新创建 cdpSession 失败: ', error)
        }
      }
      // 删除tab页
      if (should_delete) {
        console.log('删除的tab页', deleted_target_id, this.openedTabs[deleted_target_id])
        delete this.openedTabs[deleted_target_id]
      }
    })
  }
}
