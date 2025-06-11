/// <reference types="../node_modules/@livechat/widget-core/dist/widget-core.d.ts" />

import type { ExtendedWindow } from '@livechat/widget-core'
import type { ElectronAPI } from '@roxy/electron-preload'
import type { OverridedMixpanel } from 'mixpanel-browser'

declare global {
  var electronAPI: ElectronAPI
  var mixpanel: OverridedMixpanel
  var LiveChatWidget: ExtendedWindow['LiveChatWidget']
  var showLiveChat: () => void
}


declare module 'vue' {
  interface ComponentCustomProperties {
    $showLiveChat: () => void
  }
}