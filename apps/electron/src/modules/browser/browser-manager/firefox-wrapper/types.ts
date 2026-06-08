import type { FirefoxTarget } from './target'
import type * as BiDi from 'webdriver-bidi-protocol'

export interface FirefoxOptions {
  executablePath: string
  userDataDir: string
  urls?: string[]
}

// 使用 webdriver-bidi-protocol 的标准类型
export type BiDiCommand = BiDi.Command
export type BiDiMessage = BiDi.Message
export type BiDiResult = BiDi.Result

export interface BiDiClientOptions {
  onMessage?: (message: BiDiMessage) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

/**
 * Firefox 浏览器启动选项（兼容 Puppeteer 接口）
 */
export interface FirefoxLaunchOptions {
  executablePath?: string
  args?: string[]
  headless?: boolean
  ignoreDefaultArgs?: boolean | string[]
  defaultViewport?: { width: number, height: number } | null
  userDataDir?: string
  relaunch?: boolean
}

/**
 * 进程退出事件数据
 */
export interface ProcessExitData {
  code: number | null
  signal: NodeJS.Signals | null
}

/**
 * Firefox 浏览器事件映射
 */
export interface FirefoxBrowserEvents {
  /**
   * 目标相关事件
   */
  'targetcreated': (target: FirefoxTarget) => void
  'targetdestroyed': (target: FirefoxTarget) => void
  'targetchanged': (target: FirefoxTarget) => void

  /**
   * 连接相关事件
   */
  'disconnected': () => void

  /**
   * 进程相关事件
   */
  'process-exit': (data: ProcessExitData) => void
  'process-close': (data: ProcessExitData) => void
  'process-error': (error: Error) => void
}
/**
 * BiDi Context 信息
 * 使用 webdriver-bidi-protocol 的标准类型
 */
export type BiDiContext = BiDi.BrowsingContext.Info

/**
 * BiDi 能力
 */
export interface BiDiCapabilities {
  acceptInsecureCerts: boolean
  browserName: string
  browserVersion: string
  platformName: string
  userAgent: string
  [key: string]: any
}
