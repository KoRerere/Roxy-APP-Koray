import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.scss'
import '/@/styles/theme/'
import { setupPrimeVue } from '/@/primevue'
import { createApp } from 'vue'
import { setupI18n } from '/@/locales'
import App from './App.vue'

const app = createApp(App)

setupPrimeVue(app)

fetch(`/api/app/config`)
  .then(res => res.json())
  .then(({ code, data }) => {
    console.log('app config', data)
    globalThis.appConfig = data
    setupI18n(app, { defaultLocale: data.language }).then(() => {
      document.querySelector('html')?.setAttribute('lang', data.language)
    })
  })
  .catch((err) => {
    console.error(err)
  }).finally(() => {
    app.mount('#app')
  })


