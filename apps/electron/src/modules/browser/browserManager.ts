import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import { chromeCoreManager } from './chromeCoreManager'

export const browserManager = new class BrowserManager {
  private browser: Browser | null = null

  async launch() {
    const exePath = await chromeCoreManager.getCoreExePath('117')
    this.browser = await puppeteer.launch({
      executablePath: exePath,
      headless: false,
      ignoreDefaultArgs: true,
      defaultViewport: null,
      args: ['--start-maximized'],
    })
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}()
