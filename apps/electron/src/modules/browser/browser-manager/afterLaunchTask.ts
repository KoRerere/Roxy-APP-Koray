import CDP from 'chrome-remote-interface'
import ejs from 'ejs'
import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { store } from '/@/modules/store'
import { SyncControlUtil } from '/@/modules/sync-control/util'
import type { BrowserItem } from './browserItem'
import type { Browser, Protocol } from './chrome-wrapper/'

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

  constructor(private browserItem: BrowserItem, public browser: Browser) { }

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
    })
    await this.handleBrowserEvent()
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
      defaultOpenUrl = this.browserItem.winInfo.defaultOpenUrl || []
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

    if (!this.browser) {
      return
    }

    const saveCookies = async () => {
      const { cookies } = await this.browser.client.Storage.getCookies()
      this.cookies = cookies
    }

    if (this.isPhone) {
      try {
        const targets = await CDP.List({ port: this.browser.actualPort })
        targets.forEach(async (target) => {
          const client = await CDP({ target: target.webSocketDebuggerUrl })
          await client.Emulation.setTouchEmulationEnabled({ enabled: true, configuration: 'mobile' })
          console.log('setTouchEmulationEnabled success')
        })
      }
      catch (error) {
        console.log('setTouchEmulationEnabled error', error)
      }
    }

    const startTime = Date.now()
    // 导入 cookie
    if (cookie && !clearCookie) {
      await this.browser.client.Storage.setCookies({ cookies: cookie }).catch((err) => {
        console.log('Failed to import cookies', err)
      })
      console.log('Storage.setCookies success')
      console.log('Cookie import time:', Date.now() - startTime, 'ms')
    }

    const pages = await this.browser?.pages()
    // cookie导入成功后，把打开的tab页重新加载一次
    pages.map(async (e) => {
      const target = e.target()
      const url = target.url()
      if (url && url !== 'about:blank') {
        await e.goto(url).catch((err) => {
          console.log(`goto ${url} failed`, err)
        })
      }
    })

    // 是否同步 cookie
    if (syncCookie) {
      this.browser.on('targetchanged', saveCookies)
      this.browser.on('targetcreated', saveCookies)
      this.browser.on('targetdestroyed', saveCookies)
      setTimeout(saveCookies, 1000)
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

    const allPages = await this.browser?.pages()
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
            const escapeHTMLPolicy = (window as any).trustedTypes?.createPolicy?.('myEscapePolicy', {
              createHTML: (string: string) => string,
            })

            const escaped = escapeHTMLPolicy.createHTML(html)
            document.body.insertAdjacentHTML('beforeend', escaped)
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
}
