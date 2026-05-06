import type { IBrowser } from './adapter'
import type { BrowserItem } from './browserItem'
import type { ChromePage, ChromeTarget, Protocol } from './chrome-wrapper/'
import CDP from 'chrome-remote-interface'
import ejs from 'ejs'
import { debounce } from 'es-toolkit'
import { readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
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

  constructor(private browserItem: BrowserItem, public browser: IBrowser) { }

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
    const { cookie, syncCookie, clearCookie, allOpenUrl, dirId, openWorkbench } = this.browserItem.winInfo

    if (!this.browser || !this.browser.client) {
      console.warn('Browser or browser.client is not available')
      return
    }

    const pages = await this.browser?.pages()

    pages?.slice(1).forEach(p => p.close().catch(() => {}))
    const firstPage = pages?.at(0)
    const validOpenUrl = allOpenUrl?.filter(url => url && this.browserItem.isValidURL(url)) || []

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

    const isOpenWorkbench = openWorkbench === 1 || (openWorkbench === 2 && store.openWorkbench)

    if (isOpenWorkbench) {
      const dashboardUrl = `http://127.0.0.1:${store.appPort}/dashboard.html?id=${dirId}`
      if (firstPage) {
        firstPage.gotoReplace(dashboardUrl).catch((err) => {
          console.log(`goto ${dashboardUrl} failed`, err)
        })
      }
      else {
        this.browser.newPage(dashboardUrl)
      }
    }

    // 开启同步标签页后，同步标签页
    await Promise.allSettled(validOpenUrl.map(url => this.browser.newPage(url)))

    if (!isOpenWorkbench) {
      if (validOpenUrl.length) {
        firstPage?.close().catch(() => { })
      }
      else {
        firstPage?.gotoReplace('chrome://newtab/').catch((err) => {
          console.log(`goto chrome://newtab/ failed`, err)
        })
      }
    }

    const saveCookies = async () => {
      if (!this.browser.client)
        return

      try {
        const { cookies } = await this.browser.client.Storage.getCookies()
        this.cookies = cookies as Protocol.Network.Cookie[]
      }
      catch (error) {
        console.error('Failed to save cookies:', error)
      }
    }

    // Chrome 特定功能：移动端触摸模拟
    if (this.isPhone && this.browser.actualPort) {
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
            if (newPage)
              setupNetworkListener(newPage)
          }
          catch (e) { }
        })
      })
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
    const cookieRobotUrls = options?.cookieRobotUrls
    const scrollRange = options?.scrollRange || [100, 500]
    const delayRange = options?.delayRange || [0, 500]
    const pageLoadTimeout = options?.pageLoadTimeout || 60000
    const closeProfile = options?.closeProfile || false

    if (!this.browser || !cookieRobotUrls?.length) {
      console.warn('Cookie robot: Browser is not available')
      return
    }

    try {
      console.log(`Cookie robot: Starting to process ${cookieRobotUrls.length} URLs`)

      // 串行处理每个 URL
      for (let i = 0; i < cookieRobotUrls.length; i++) {
        const url = cookieRobotUrls[i]

        // 跳过空白页和特殊协议页面
        if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('devtools://')) {
          console.log(`Cookie robot: Skipping URL ${i + 1} (${url})`)
          continue
        }

        try {
          console.log(`Cookie robot: Opening tab ${i + 1}/${cookieRobotUrls.length} (${url})`)

          // 如果是第一个 tab，先记录用户之前的所有 tab，稍后关闭
          const pagesToClose = await this.browser.pages()
          // 打开新标签页
          const page = await this.browser.newPage(url)
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

          // 等待页面加载完成
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

                // 检查页面是否可滚动
                const maxScrollY = Math.max(
                  document.body.scrollHeight,
                  document.documentElement.scrollHeight,
                ) - window.innerHeight

                if (maxScrollY <= 0) {
                  // 页面不可滚动，返回特殊标记，让外层决定是否重试
                  resolve({ scrolled: false, reachedBottom: false, notScrollable: true, reason: 'Page not scrollable' })
                  return
                }

                const startPosition = window.scrollY

                // 检查是否已经在底部
                if (startPosition >= maxScrollY - 10) {
                  resolve({ scrolled: false, reachedBottom: true, reason: 'Already at bottom', startPosition, maxScrollY })
                  return
                }

                // 执行滚动
                window.scrollBy({ top: distance as number, behavior: 'smooth' })

                // 等待滚动完成
                let lastPosition = startPosition
                let samePositionCount = 0
                const checkInterval = setInterval(() => {
                  const currentPosition = window.scrollY
                  const currentMaxScrollY = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                  ) - window.innerHeight

                  if (Math.abs(currentPosition - lastPosition) < 1) {
                    samePositionCount++
                    if (samePositionCount >= 3) {
                      clearInterval(checkInterval)
                      // 检查是否到达底部（允许10px的误差）
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

                // 最多等待 2 秒
                setTimeout(() => {
                  clearInterval(checkInterval)
                  const currentPosition = window.scrollY
                  const currentMaxScrollY = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                  ) - window.innerHeight
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
      if (closeProfile) {
        this.browser.close()
      }
    }
  }
}
