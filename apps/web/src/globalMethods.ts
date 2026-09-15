import type { App } from 'vue'
import { $t } from '/@/locales'
import { openChatwoot } from '/@/components/business/live-chat/chatwoot'

export function setupGlobalMethods(app: App) {
  globalThis.showLiveChat = () => {
    void openChatwoot().then((opened) => {
      if (opened) {
        return
      }
      app.config.globalProperties.$toast.add({
        severity: 'error',
        summary: `${$t('联系客服')} · ${$t('操作失败')}`,
        detail: $t('请检查网络连接后重试。'),
        life: 5000,
        // 卸载页只挂载了 tr 分组；主应用和代理置换页使用默认分组
        ...(document.querySelector('.rx-toast-headless') ? {} : { group: 'tr' }),
      })
    })
  }
  globalThis.$t = $t

  app.config.globalProperties.$showLiveChat = showLiveChat
  app.config.globalProperties.$t = $t
  app.config.globalProperties.$isElectron = globalThis.isElectron
  app.config.globalProperties.$appVersion = globalThis.$appVersion
}
