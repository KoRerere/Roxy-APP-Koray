import type { FirefoxBiDiSession } from './bidi-session'
import type { FirefoxBrowser } from './browser'
import type { FirefoxPage } from './page'
import type { FirefoxTarget } from './target'
// 创建一个兼容 puppeteer-core 的默认导出对象
import { connect, launch } from './launcher'

export { BiDiClient } from './bidi-client'

export { FirefoxBiDiSession } from './bidi-session'
// 导出类
export { FirefoxBrowser } from './browser'
export { FirefoxProcess } from './firefox-process'
// 导出启动函数
export { connect, type FirefoxLaunchOptions, launch } from './launcher'
export { FirefoxPage } from './page'
export { FirefoxTarget } from './target'

// 导出类型
export * from './types'

const firefox = {
  launch,
  connect,
}

export default firefox

// 导出类型别名，使得外部代码可以正常使用
export type Browser = FirefoxBrowser
export type Page = FirefoxPage
export type Target = FirefoxTarget
export type CDPSession = FirefoxBiDiSession
