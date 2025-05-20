import CDP from 'chrome-remote-interface'
import type { Browser, Page, Target, HTTPResponse, ElementHandle, ScreenshotOptions, WaitForSelectorOptions } from 'puppeteer-core'

export interface ChromeRemoteOptions {
  host?: string
  port?: number
  secure?: boolean
  target?: string
  protocol?: string
  local?: boolean
  timeout?: number
}

export class ChromeRemoteResponse implements HTTPResponse {
  private _url: string
  private _status: number
  private _headers: Record<string, string>

  constructor(url: string, status: number, headers: Record<string, string>) {
    this._url = url
    this._status = status
    this._headers = headers
  }

  url(): string {
    return this._url
  }

  status(): number {
    return this._status
  }

  ok(): boolean {
    return this._status >= 200 && this._status < 300
  }

  headers(): Record<string, string> {
    return this._headers
  }
}

export class ChromeRemoteBrowser {
  private client: CDP.Client | null = null
  private pageMap: Map<string, ChromeRemotePage> = new Map()
  private _wsEndpoint: string | null = null

  constructor(private options: ChromeRemoteOptions = {}) { }

  async connect(): Promise<Browser> {
    try {
      this.client = await CDP({
        host: this.options.host || 'localhost',
        port: this.options.port || 9222,
        secure: this.options.secure || false,
        target: this.options.target,
        protocol: this.options.protocol,
        local: this.options.local,
      })

      // 获取 WebSocket 端点
      const { webSocketDebuggerUrl } = await this.client.Target.getBrowserContexts()
      this._wsEndpoint = webSocketDebuggerUrl

      // 监听新页面创建
      this.client.Target.targetCreated(({ targetInfo }) => {
        if (targetInfo.type === 'page') {
          this.createPage(targetInfo.targetId)
        }
      })

      return this as unknown as Browser
    } catch (error: any) {
      throw new Error(`Failed to connect to Chrome: ${error.message}`)
    }
  }

  async newPage(): Promise<Page> {
    if (!this.client) {
      throw new Error('Browser not connected')
    }

    const { targetId } = await this.client.Target.createTarget({
      url: 'about:blank',
      width: 1280,
      height: 800,
    })

    return this.createPage(targetId)
  }

  private async createPage(targetId: string): Promise<ChromeRemotePage> {
    const page = new ChromeRemotePage(this.client!, targetId)
    await page.init()
    this.pageMap.set(targetId, page)
    return page
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  async pages(): Promise<Page[]> {
    return Array.from(this.pageMap.values()) as Page[]
  }

  targets(): Target[] {
    return Array.from(this.pageMap.entries()).map(([targetId, page]) => ({
      type: () => 'page',
      url: () => page.url(),
      createCDPSession: () => Promise.resolve(null),
      page: () => Promise.resolve(page as Page),
      browser: () => this as unknown as Browser,
      browserContext: () => null,
      opener: () => null,
    }))
  }

  userAgent(): Promise<string> {
    return Promise.resolve('')
  }

  version(): Promise<string> {
    return Promise.resolve('')
  }

  wsEndpoint(): string {
    if (!this._wsEndpoint) {
      throw new Error('WebSocket endpoint not available')
    }
    return this._wsEndpoint
  }
}

export class ChromeRemotePage {
  private session: CDP.Client | null = null
  private _url: string = ''
  private _title: string = ''

  constructor(
    private client: CDP.Client,
    private targetId: string
  ) { }

  async init(): Promise<void> {
    this.session = await this.client.Target.attachToTarget({
      targetId: this.targetId,
      flatten: true,
    })

    // 监听页面加载事件
    this.session.Page.loadEventFired(() => {
      this.updatePageInfo()
    })
  }

  private async updatePageInfo(): Promise<void> {
    if (!this.session) return

    const { result } = await this.session.Runtime.evaluate({
      expression: 'window.location.href',
    })
    this._url = result.value as string

    const { result: titleResult } = await this.session.Runtime.evaluate({
      expression: 'document.title',
    })
    this._title = titleResult.value as string
  }

  async goto(url: string, options?: { timeout?: number }): Promise<HTTPResponse | null> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const response = await this.session.Page.navigate({ url })
    await this.updatePageInfo()

    return new ChromeRemoteResponse(
      this._url,
      response.status || 200,
      response.headers || {}
    )
  }

  async evaluate<T>(pageFunction: string | Function, ...args: any[]): Promise<T> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const result = await this.session.Runtime.evaluate({
      expression: typeof pageFunction === 'function' ? pageFunction.toString() : pageFunction,
      arguments: args,
    })

    return result.result.value as T
  }

  async screenshot(options: ScreenshotOptions & { encoding?: 'base64' } = {}): Promise<string | Buffer> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const { data } = await this.session.Page.captureScreenshot({
      format: 'png',
      fromSurface: true,
    })

    const buffer = Buffer.from(data, 'base64')

    if (options.path) {
      await require('fs').promises.writeFile(options.path, buffer)
    }

    if (options.encoding === 'base64') {
      return data
    }

    return buffer
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.client.Target.detachFromTarget({
        targetId: this.targetId,
      })
      this.session = null
    }
  }

  async click(selector: string): Promise<void> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const { nodeId } = await this.session.DOM.querySelector({
      nodeId: 1,
      selector,
    })

    if (!nodeId) {
      throw new Error(`Element not found: ${selector}`)
    }

    const { x, y } = await this.session.DOM.getBoxModel({ nodeId })
    await this.session.Input.dispatchMouseEvent({
      type: 'mousePressed',
      x: x[0],
      y: y[0],
      button: 'left',
      clickCount: 1,
    })

    await this.session.Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x: x[0],
      y: y[0],
      button: 'left',
      clickCount: 1,
    })
  }

  async type(selector: string, text: string): Promise<void> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const { nodeId } = await this.session.DOM.querySelector({
      nodeId: 1,
      selector,
    })

    if (!nodeId) {
      throw new Error(`Element not found: ${selector}`)
    }

    await this.session.DOM.focus({ nodeId })
    await this.session.Input.insertText({ text })
  }

  async waitForSelector<T extends string>(
    selector: T,
    options?: WaitForSelectorOptions
  ): Promise<ElementHandle<Element> | null> {
    if (!this.session) {
      throw new Error('Page not initialized')
    }

    const timeout = options?.timeout || 30000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const { nodeId } = await this.session.DOM.querySelector({
        nodeId: 1,
        selector,
      })

      if (nodeId) {
        return {
          click: () => this.click(selector),
          type: (text: string) => this.type(selector, text),
        } as unknown as ElementHandle<Element>
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return null
  }

  url(): string {
    return this._url
  }

  title(): Promise<string> {
    return Promise.resolve(this._title)
  }
}

export async function connect(options: ChromeRemoteOptions = {}): Promise<Browser> {
  const browser = new ChromeRemoteBrowser(options)
  return browser.connect()
}

export async function launch(options: ChromeRemoteOptions = {}): Promise<Browser> {
  // 实现启动 Chrome 的逻辑...
  throw new Error('Method not implemented.')
}
