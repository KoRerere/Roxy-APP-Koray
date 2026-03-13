import type { ChildProcess } from 'node:child_process'
import type { EventEmitter } from 'node:events'

/**
 * 统一的浏览器接口
 * 抽象 Chrome 和 Firefox 的通用功能
 */
export interface IBrowser extends EventEmitter {
  /**
   * 获取 WebSocket 端点
   */
  wsEndpoint: () => string

  /**
   * 关闭浏览器
   */
  close: () => Promise<void>

  /**
   * 强制杀死浏览器进程
   */
  kill: () => void

  /**
   * 获取所有页面
   */
  pages: () => Promise<IPage[]>

  /**
   * 创建新页面
   */
  newPage: (url?: string) => Promise<IPage>

  /**
   * 获取浏览器目标
   */
  target: () => ITarget

  /**
   * 获取浏览器进程
   */
  process: () => ChildProcess | null

  /**
   * 事件监听
   */
  on(event: string, listener: (...args: any[]) => void): this
  off(event: string, listener: (...args: any[]) => void): this
  emit: (event: string, ...args: any[]) => boolean

  /**
   * Chrome/Firefox 兼容的 DevTools Protocol 客户端接口
   * Chrome: 提供 CDP (Chrome DevTools Protocol) 客户端
   * Firefox: 提供兼容 CDP 的 BiDi 客户端适配器
   */
  client?: {
    Storage: {
      getCookies: () => Promise<{ cookies: any[] }>
      setCookies: (params: { cookies: any[] }) => Promise<void>
    }
    Browser: {
      getTabs: () => Promise<{ tabs: string }>
    }
    [key: string]: any
  }

  /**
   * 浏览器实际监听的端口号
   * 用于建立额外的连接或调试
   */
  actualPort?: number
}

/**
 * 统一的页面接口
 */
export interface IPage extends EventEmitter {
  /**
   * 导航到指定 URL
   */
  goto: (url: string, options?: any) => Promise<any>

  /**
   * 在页面上执行 JavaScript
   */
  evaluate: <T = unknown>(pageFunction: Function | string, ...args: unknown[]) => Promise<T>

  /**
   * 关闭页面
   */
  close: () => Promise<void>

  /**
   * 将页面带到前台 (激活该标签页)
   */
  bringToFront?: () => Promise<void>

  /**
   * 获取页面 URL
   */
  url: () => string

  /**
   * 获取页面目标
   */
  target: () => ITarget

  /**
   * 获取页面内容
   */
  content?: () => Promise<string>

  /**
   * 设置页面内容
   */
  setContent?: (html: string) => Promise<void>
}

/**
 * 统一的目标接口
 */
export interface ITarget {
  /**
   * 获取目标 URL
   */
  url: () => string

  /**
   * 获取目标类型
   */
  type: () => string

  /**
   * 获取目标 ID
   */
  _targetId: string
}

/**
 * 统一的启动选项
 */
export interface BrowserLaunchOptions {
  /** 浏览器类型 */
  browserType: BrowserType
  /**
   * 浏览器可执行文件路径
   */
  executablePath?: string

  /**
   * 启动参数
   */
  args?: string[]

  /**
   * 是否无头模式
   */
  headless?: boolean

  /**
   * 是否忽略默认参数
   */
  ignoreDefaultArgs?: boolean | string[]

  /**
   * 默认视口
   */
  defaultViewport?: { width: number, height: number } | null

  /**
   * 用户数据目录
   */
  userDataDir?: string
  /**
   * 重新启动浏览器
   */
  relaunch?: boolean
}

/**
 * 浏览器类型
 */
export type BrowserType = 'chrome' | 'firefox'

/**
 * 浏览器适配器工厂
 */
export class BrowserAdapterFactory {
  /**
   * 启动浏览器
   */
  static async launch(options: BrowserLaunchOptions): Promise<IBrowser> {
    if (options.browserType === 'firefox') {
      const firefoxWrapper = await import('./firefox-wrapper')
      return firefoxWrapper.launch(options) as unknown as IBrowser
    }
    else {
      const chromeWrapper = await import('./chrome-wrapper')
      return chromeWrapper.launch(options) as unknown as IBrowser
    }
  }

  /**
   * 连接到已存在的浏览器
   */
  static async connect(options: { browserType: BrowserType, browserWSEndpoint: string }): Promise<IBrowser> {
    if (options.browserType === 'chrome') {
      const chromeWrapper = await import('./chrome-wrapper')
      return chromeWrapper.connect(options) as unknown as IBrowser
    }
    else if (options.browserType === 'firefox') {
      const firefoxWrapper = await import('./firefox-wrapper')
      return firefoxWrapper.connect(options) as unknown as IBrowser
    }
    else {
      throw new Error(`Unsupported browser type: ${options.browserType}`)
    }
  }
}

/**
 * 便捷函数：自动检测浏览器类型并启动
 */
export async function launchBrowser(
  options: BrowserLaunchOptions,
): Promise<IBrowser> {
  return BrowserAdapterFactory.launch(options)
}

/**
 * 便捷函数：自动检测浏览器类型并连接
 */
export async function connectBrowser(
  options: { browserType: BrowserType, browserWSEndpoint: string },
): Promise<IBrowser> {
  return BrowserAdapterFactory.connect(options)
}
