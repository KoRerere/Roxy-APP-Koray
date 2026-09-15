import type { ElectronAPI } from '@roxy/electron-preload'
import type { OverridedMixpanel } from 'mixpanel-browser'
import type RxSvgIcon from '@/components/rx-icon'

/** Chatwoot 在注入 SDK 前读取的全局配置 */
interface ChatwootSettings {
  /** 是否隐藏默认气泡，改由产品按钮打开 */
  hideMessageBubble?: boolean
  position?: 'left' | 'right'
  locale?: string
  type?: 'standard' | 'expanded_bubble'
  darkMode?: 'light' | 'dark' | 'auto'
  launcherTitle?: string
}

/** Chatwoot 官方 SDK 入口 */
interface ChatwootSDK {
  /** 用 website token 启动 widget */
  run: (config: { websiteToken: string, baseUrl: string }) => void
}

/** Chatwoot 已就绪后的 widget API */
interface ChatwootWidget {
  /** iframe 回传 loaded 后由 SDK 置为 true */
  hasLoaded?: boolean
  /** 打开 / 关闭会话窗口；无参时切换 */
  toggle: (state?: 'open' | 'close') => void
  toggleBubbleVisibility: (visibility: 'hide' | 'show') => void
  /** 绑定联系人，identifier 需稳定且不要使用登录 token */
  setUser: (identifier: string, user: {
    email?: string
    name?: string
    avatar_url?: string
    phone_number?: string
    identifier_hash?: string
  }) => void
  setCustomAttributes: (attributes: Record<string, string | number | boolean>) => void
  deleteCustomAttribute: (key: string) => void
  setLocale: (locale: string) => void
  /** SDK 内部字段，无公开 setter；改位置需同时换 holder/bubble 的 woot-elements class */
  position?: 'left' | 'right'
  /** 清空当前联系人会话，避免账号切换串数据 */
  reset: () => void
  popoutChatWindow: () => void
}

declare global {
  interface WindowEventMap {
    'chatwoot:ready': Event
    'chatwoot:opened': Event
    'chatwoot:closed': Event
  }

  var electronAPI: ElectronAPI
  var mixpanel: OverridedMixpanel
  var chatwootSDK: ChatwootSDK | undefined
  var $chatwoot: ChatwootWidget | undefined
  var chatwootSettings: ChatwootSettings | undefined
  var showLiveChat: () => void
  var $t: (...args: any[]) => string
  /** 是否为 electron 环境 */
  var isElectron: boolean
  /** 当前 APP 版本 */
  var $appVersion: string
  /** 当前选择的网络线路 */
  var $lastSelectedNetworkNode: 'auto' | {
    /** 站点域名 */
    site: string
    /** 网关域名 */
    gate: string
    /** API 域名 */
    api: string
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $showLiveChat: () => void
    $t: (...args: any[]) => string
    $isElectron: boolean
    $appVersion: string
  }
  interface GlobalComponents {
    // 请务必在此处输入 Vue 组件类型
    // (SomeComponent，*而不是* SomeElement)。
    // 自定义元素的名称中需要连字符，
    /**
     * 因此请在此处使用连字符元素名称。
     */
    'rx-video-player': typeof VideoPlayer
    'rx-svg-icon': typeof RxSvgIcon
  }
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      reqTime?: number
    }
  }
}
