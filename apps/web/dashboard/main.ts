import '@unocss/reset/normalize.css'
import 'driver.js/dist/driver.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.scss'
import '/@/styles/primevuePresets/theme/'
import { setupPrimeVue } from '/@/primevue'
import { createApp } from 'vue'
import { i18n, setupI18n } from '/@/locales'
import App from './App.vue'
import { getLocalWebServerURL } from './utils'

const app = createApp(App)

setupPrimeVue(app)
app.use(i18n)

const urlParams = new URLSearchParams(window.location.search)
const dirId = urlParams.get('id')

fetch(`${getLocalWebServerURL()}/api/app/config?dirId=${dirId}`)
  .then(res => res.json())
  .then(({ data }) => {
    console.log('app config', data);
    (globalThis as any).appConfig = data
    return setupI18n({ defaultLocale: data.language }).then(() => {
      document.querySelector('html')?.setAttribute('lang', data.language)
    })
  })
  .catch((err) => {
    console.error(err)
  })
  .finally(() => {
    app.mount('#app')
  })
