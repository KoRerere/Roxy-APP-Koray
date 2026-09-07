interface AutomationBrowserPage {
  target: () => { _targetId: string }
}

export interface AutomationBrowser {
  pages: () => Promise<AutomationBrowserPage[]>
  client?: {
    Target: {
      attachToTarget: (params: { targetId: string, flatten: true }) => Promise<{ sessionId: string }>
      detachFromTarget: (params: { sessionId: string }) => Promise<void>
      getTargets: () => Promise<{ targetInfos: Array<{ targetId: string, type: string, url: string }> }>
    }
    send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<any>
  }
}

type BridgeAction = 'acquire' | 'sync' | 'release'

interface ExtensionSession {
  browser: AutomationBrowser
  client: NonNullable<AutomationBrowser['client']>
  workerSessionId: string
}

const WORKER_SCRIPT = 'automation-control.js'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class AutomationControlExtensionBridge {
  private readonly extensionIds = new Map<string, string>()
  private readonly sessions = new Map<string, ExtensionSession>()
  private readonly connecting = new Map<string, Promise<ExtensionSession>>()

  registerProfile(dirId: string, extensionId: string): void {
    this.extensionIds.set(dirId, extensionId)
    void this.closeSession(dirId)
  }

  unregisterProfile(dirId: string): void {
    this.extensionIds.delete(dirId)
    void this.closeSession(dirId)
  }

  async request<T = unknown>(
    dirId: string,
    browser: AutomationBrowser,
    action: BridgeAction,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      return await this.evaluate<T>(await this.ensureSession(dirId, browser), action, payload)
    }
    catch (error) {
      await this.closeSession(dirId)
      console.warn(`[automation-control] Retrying extension request through CDP for ${dirId}:`, error)
      return this.evaluate<T>(await this.ensureSession(dirId, browser), action, payload)
    }
    finally {
      if (action === 'release') {
        await this.closeSession(dirId)
      }
    }
  }

  private async ensureSession(dirId: string, browser: AutomationBrowser): Promise<ExtensionSession> {
    const existing = this.sessions.get(dirId)
    if (existing?.browser === browser) {
      return existing
    }
    if (existing) {
      await this.closeSession(dirId)
    }

    let pending = this.connecting.get(dirId)
    if (!pending) {
      pending = this.connect(dirId, browser).finally(() => {
        if (this.connecting.get(dirId) === pending) {
          this.connecting.delete(dirId)
        }
      })
      this.connecting.set(dirId, pending)
    }
    return pending
  }

  private async connect(dirId: string, browser: AutomationBrowser): Promise<ExtensionSession> {
    const extensionId = this.extensionIds.get(dirId)
    if (!extensionId) {
      throw new Error(`automation extension is not registered: ${dirId}`)
    }
    const client = browser.client
    if (!client?.send || !client.Target) {
      throw new Error('browser CDP client is unavailable')
    }

    const [page] = await browser.pages()
    if (!page) {
      throw new Error(`browser page is unavailable: ${dirId}`)
    }
    const pageSession = await client.Target.attachToTarget({ targetId: page.target()._targetId, flatten: true })
    try {
      await client.send('ServiceWorker.enable', {}, pageSession.sessionId)
      await client.send(
        'ServiceWorker.startWorker',
        { scopeURL: `chrome-extension://${extensionId}/` },
        pageSession.sessionId,
      )
    }
    finally {
      await client.Target.detachFromTarget({ sessionId: pageSession.sessionId }).catch(() => {})
    }

    const worker = await this.waitForWorkerTarget(client, extensionId)
    const { sessionId } = await client.Target.attachToTarget({ targetId: worker.targetId, flatten: true })
    await client.send('Runtime.enable', {}, sessionId)
    const session = { browser, client, workerSessionId: sessionId }
    this.sessions.set(dirId, session)
    console.log(`[automation-control] Extension connected through CDP for ${dirId}`)
    return session
  }

  private async waitForWorkerTarget(
    client: NonNullable<AutomationBrowser['client']>,
    extensionId: string,
  ): Promise<{ targetId: string }> {
    const expectedUrl = `chrome-extension://${extensionId}/${WORKER_SCRIPT}`
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const { targetInfos } = await client.Target.getTargets()
      const worker = targetInfos.find(target => target.type === 'service_worker' && target.url === expectedUrl)
      if (worker) {
        return worker
      }
      await delay(50)
    }
    const { targetInfos } = await client.Target.getTargets()
    const workers = targetInfos
      .filter(target => target.type === 'service_worker' && target.url.startsWith('chrome-extension://'))
      .map(target => target.url)
    throw new Error(
      `automation extension worker did not start: expected ${expectedUrl}; discovered ${workers.join(', ') || 'none'}`,
    )
  }

  private async evaluate<T>(
    session: ExtensionSession,
    action: BridgeAction,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const expression = `globalThis.roxyAutomationControl.request(${JSON.stringify(action)}, ${JSON.stringify(payload)})`
    const response = await session.client.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      session.workerSessionId,
    )
    if (response.exceptionDetails) {
      const description = response.exceptionDetails.exception?.description || response.exceptionDetails.text
      throw new Error(description || 'automation extension request failed')
    }
    return response.result?.value as T
  }

  private async closeSession(dirId: string): Promise<void> {
    const session = this.sessions.get(dirId)
    this.sessions.delete(dirId)
    if (!session) {
      return
    }
    await session.client.Target.detachFromTarget({ sessionId: session.workerSessionId }).catch(() => {})
  }
}

export const automationControlExtensionBridge = new AutomationControlExtensionBridge()
