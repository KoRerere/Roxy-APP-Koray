import type { App } from 'vue'
import { $t } from '/@/locales'

export function setupGlobalMethods(app: App) {
  globalThis.showLiveChat = () => {
    LiveChatWidget.call('maximize')
  }
  globalThis.$t = $t

  app.config.globalProperties.$showLiveChat = showLiveChat
  app.config.globalProperties.$t = $t
  app.config.globalProperties.$isElectron = globalThis.isElectron
}
