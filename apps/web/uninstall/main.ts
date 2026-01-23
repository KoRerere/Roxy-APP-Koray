import { setupGlobalMethods } from '/@/globalMethods'
import { setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'
import { setupPrimeVue } from '/@/primevue'
import '/@/styles/index.scss'
import App from './App.vue'
import log from 'electron-log/renderer'

Object.assign(console, log.functions)

electronAPI.send('app:getSoftConfig').then((softConfig) => {
  globalThis.$softConfig = softConfig
  const { language, token } = softConfig
  console.log('softConfig', softConfig)
  if (!token) {
    window.electronAPI.send('app:uninstall-directly')
    return
  }

  setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
    const app = createApp(App)

    setupGlobalMethods(app)
    setupPrimeVue(app)
    app.mount('#app')
  })
})
