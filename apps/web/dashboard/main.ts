import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.scss'
import '/@/styles/primevuePresets/theme/'
import { setupPrimeVue } from '/@/primevue'
import { createApp } from 'vue'
import { i18n, setupI18n } from '/@/locales'
import App from './App.vue'

const app = createApp(App)

setupPrimeVue(app)
app.use(i18n)

fetch(`/api/app/config`)
  .then(res => res.json())
  .then(({ code, data }) => {
    console.log('app config', data)
    globalThis.appConfig = data
    setupI18n({ defaultLocale: data.language }).then(() => {
      document.querySelector('html')?.setAttribute('lang', data.language)
    })
  })
  .catch((err) => {
    console.error(err)
  })
  .finally(() => {
    app.mount('#app')
  })
