// 导出启动函数
export { launch, connect, type PuppeteerLaunchOptions } from './launcher'

// 导出类
export { ChromeBrowser } from './browser'
export { ChromePage } from './page'
export { ChromeTarget } from './target'
export { ChromeCDPSession } from './cdp-session'

// 创建一个兼容 puppeteer-core 的默认导出对象
import { launch, connect } from './launcher'
import type { ChromeBrowser } from './browser'
import type { ChromePage } from './page'
import type { ChromeTarget } from './target'
import type { ChromeCDPSession } from './cdp-session'

const puppeteer = {
    launch,
    connect
}

export default puppeteer

// 导出类型别名，使得外部代码可以正常使用
export type Browser = ChromeBrowser
export type Page = ChromePage
export type Target = ChromeTarget
export type CDPSession = ChromeCDPSession

// 重新导出 puppeteer-core 的类型（仅用于类型检查）
export type { Protocol } from 'puppeteer-core'

// 为了兼容性，扩展 Browser 接口
declare module './browser' {
    interface ChromeBrowser {
        createBrowserCDPSession(): Promise<ChromeCDPSession>
    }
}
