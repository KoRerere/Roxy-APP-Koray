/// <reference types="../node_modules/@livechat/widget-core/dist/widget-core.d.ts" />

import type { ExtendedWindow } from '@livechat/widget-core'
import type { ElectronAPI } from '@roxy/electron-preload'
import type { OverridedMixpanel } from 'mixpanel-browser'
import type RxSvgIcon from '@/components/rx-icon'

declare global {
  var electronAPI: ElectronAPI
  var mixpanel: OverridedMixpanel
  var LiveChatWidget: ExtendedWindow['LiveChatWidget']
  var showLiveChat: () => void
  var $t: (...args: any[]) => string
  /** 是否为 electron 环境 */
  var isElectron: boolean
  /** 当前 APP 版本 */
  var $appVersion: string
  /** 功能开关（由主进程 env 决定，web 端回退到 VITE_ 变量） */
  var $featureFlags: { scriptRecording?: boolean } | undefined
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
