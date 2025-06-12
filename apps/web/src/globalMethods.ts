import type { App } from "vue"

export function setupGlobalMethods(app: App) {
  globalThis.showLiveChat = () => {
    LiveChatWidget.call('maximize')
  }
  app.config.globalProperties.$showLiveChat = showLiveChat
}
