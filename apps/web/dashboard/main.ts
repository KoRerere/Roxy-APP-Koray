import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.css'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import { $t, setupI18n } from '/@/locales'
import { setupStore } from '/@/stores'
import App from './App.vue'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(ToastService)
setupStore(app)


fetch(`/api/app/config`)
  .then(res => res.json())
  .then(({ code, data }) => {
    console.log('app config', data)
    setupI18n(app, { defaultLocale: data.language }).then(() => {
      document.querySelector('html')?.setAttribute('lang', data.language)
    })
  })
  .catch((err) => {
    console.error(err)
  }).finally(() => {
    app.mount('#app')
  })


