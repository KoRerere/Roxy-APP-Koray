import type { ChildProcess } from 'node:child_process'
import type { EventEmitter } from 'node:events'

/**
 * CDP Browser.Bounds — 窗口位置与尺寸
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Browser/#type-Bounds
 */
export interface CDPWindowBounds {
  /** 窗口相对屏幕左边缘的偏移量（像素） */
  left?: number
  /** 窗口相对屏幕上边缘的偏移量（像素） */
  top?: number
  /** 窗口宽度（像素） */
  width?: number
  /** 窗口高度（像素） */
  height?: number
  /** 窗口状态 */
  windowState?: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
}

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
      /** 获取当前 target 所在窗口的 ID 及 bounds */
      getWindowForTarget: (params?: { targetId?: string }) => Promise<{ windowId: number, bounds: CDPWindowBounds }>
      /** 获取指定窗口的 bounds（位置与尺寸） */
      getWindowBounds: (params: { windowId: number }) => Promise<{ bounds: CDPWindowBounds }>
      /** 设置窗口位置与尺寸（Chromium/CDP）；Firefox BiDi client 不提供 */
      setWindowBounds?: (params: { windowId: number, bounds: CDPWindowBounds }) => Promise<void>
    }
    [key: string]: any
  }

  /**
   * 浏览器实际监听的端口号
   * 用于建立额外的连接或调试
   */
  actualPort?: number

  /**
   * 将已运行的浏览器窗口置于前台（Firefox 重新激活时使用）
   */
  bringToFront?: () => Promise<void>
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
   * 用 location.replace 打开 URL，不产生新的会话历史条目
   */
  gotoReplace: (url: string) => Promise<void>

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
  coreType: CoreType
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
export enum CoreType {
  Chrome = 'Chrome',
  Firefox = 'Firefox',
}

/**
 * 浏览器适配器工厂
 */
export class BrowserAdapterFactory {
  /**
   * 启动浏览器
   */
  static async launch(options: BrowserLaunchOptions): Promise<IBrowser> {
    if (options.coreType === CoreType.Firefox) {
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
  static async connect(options: { coreType: CoreType, browserWSEndpoint: string }): Promise<IBrowser> {
    if (options.coreType === CoreType.Chrome) {
      const chromeWrapper = await import('./chrome-wrapper')
      return chromeWrapper.connect(options) as unknown as IBrowser
    }
    else if (options.coreType === CoreType.Firefox) {
      const firefoxWrapper = await import('./firefox-wrapper')
      return firefoxWrapper.connect(options) as unknown as IBrowser
    }
    else {
      throw new Error(`Unsupported browser type: ${options.coreType}`)
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
  options: { coreType: CoreType, browserWSEndpoint: string },
): Promise<IBrowser> {
  return BrowserAdapterFactory.connect(options)
}
