import { setupGlobalMethods } from '/@/globalMethods'
import { i18n, setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'
import { setupPrimeVue } from '/@/primevue'
import '/@/styles/index.scss'
import 'uno.css'
import mixpanel from 'mixpanel-browser'
import App from './App.vue'
import log from 'electron-log/renderer'

Object.assign(console, log.functions)

globalThis.electronAPI.send('app:getSoftConfig').then((softConfig) => {
  globalThis.$softConfig = softConfig
  const { language, token, lastUserId } = softConfig
  console.log('softConfig', softConfig)
  if (!token && !lastUserId) {
    globalThis.electronAPI.send('app:uninstall-directly')
    return
  }

  setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
    mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
      debug: import.meta.env.DEV,
      track_pageview: false,
      autocapture: false,
      persistence: 'localStorage',
    })

    mixpanel.identify(String(lastUserId))

    globalThis.mixpanel = mixpanel

    const app = createApp(App)
    app.use(i18n)

    setupGlobalMethods(app)
    setupPrimeVue(app)
    app.mount('#app')
  })
})
