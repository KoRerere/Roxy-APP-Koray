import type { Browser, BrowserType, RoxyConnectOptions } from '@roxybrowser/playwright'
import { chromium, firefox } from '@roxybrowser/playwright'

export interface SandboxPlaywrightFacade {
  chromium: BrowserType
  firefox: BrowserType
  dispose: () => Promise<void>
}

export interface CreateSandboxPlaywrightOptions {
  browserUrl: string
  browserOutputDir: string
  isActive: () => boolean
}

export function createSandboxPlaywrightFacade(opts: CreateSandboxPlaywrightOptions): SandboxPlaywrightFacade {
  const browsers = new Set<Browser>()

  const createBrowserFacade = (target: BrowserType, browserName: 'Chromium' | 'Firefox'): BrowserType => new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === 'connect') {
        return async (endpointURL: string, options: RoxyConnectOptions = {}): Promise<Browser> => {
          if (!opts.isActive()) {
            throw new Error('[sandbox] Run is no longer active')
          }
          if (endpointURL !== opts.browserUrl) {
            throw new Error(`[sandbox] ${browserName} can only connect to the browser assigned to this run`)
          }
          const browser = await target.connect(endpointURL, {
            ...options,
            artifactsDir: opts.browserOutputDir,
            downloadsDir: opts.browserOutputDir,
            screenshotsDir: opts.browserOutputDir,
            snapshotsDir: opts.browserOutputDir,
            tracesDir: opts.browserOutputDir,
            videosDir: opts.browserOutputDir,
            networkDir: opts.browserOutputDir,
            consoleDir: opts.browserOutputDir,
            scriptsDir: opts.browserOutputDir,
            tempDir: opts.browserOutputDir,
          })
          browsers.add(browser)
          browser.once('disconnected', () => browsers.delete(browser))
          return browser
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return {
    chromium: createBrowserFacade(chromium, 'Chromium'),
    firefox: createBrowserFacade(firefox, 'Firefox'),
    dispose: async () => {
      const owned = Array.from(browsers)
      browsers.clear()
      await Promise.allSettled(owned.map(browser => browser.close({ reason: 'sandbox run finished' })))
    },
  }
}
