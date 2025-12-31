import { setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'
import '/@/styles/index.scss'

electronAPI.send('app:getSoftConfig').then((softConfig) => {
  const { language } = softConfig

  setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
    const app = createApp(defineAsyncComponent(() => import('./App.vue')))

    app.mount('#app')
  })
})
