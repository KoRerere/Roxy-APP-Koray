import type { Browser, PuppeteerLaunchOptions } from 'puppeteer-core'
import * as ChromeLauncher from 'chrome-launcher'
import puppeteer from 'puppeteer-core'
import type { ISO639Type } from './ISO-639-code'

export class GoogleTranslator {
  private browser!: Browser
  private browserLaunching!: Promise<Browser>

  constructor(private options?: PuppeteerLaunchOptions) {
    this.init()
  }

  async init() {
    const chromePath = ChromeLauncher.getChromePath()

    this.browserLaunching = puppeteer.launch({
      ...this.options,
      executablePath: chromePath,
      // headless: false, // 设置为 false 以便看到浏览器操作
      // slowMo: 250, // 减慢操作速度，方便观察
    })

    this.browser = await this.browserLaunching
  }

  async translateText(text: string, from: string, to: ISO639Type) {
    if (!this.browser) {
      await this.browserLaunching
    }

    const page = await this.browser.newPage()
    await page.goto(
      `http://translate.google.com/?sl=${from}&tl=${to}&text=${text}&op=translate`,
    )
    await page.waitForSelector('.ryNqvb')
    const bodyHandle = await page.$$('.ryNqvb')
    const promises = bodyHandle.map(async (item) => {
      const text = await page.evaluate(item => item.textContent, item)
      return text
    })
    const html = await Promise.all(promises)
    console.log('[puppeteer-google-translate]', html.join(''))
    // await browser.close();
    page.close()
    return html.join('')
  }

  async close() {
    await this.browser.close()
  }
}
