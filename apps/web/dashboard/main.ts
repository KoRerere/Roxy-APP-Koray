import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'virtual:uno.css'
import '/@/styles/index.css'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import { setupI18n } from '/@/locales'
import { store } from '/@/stores'
import { useSimpleLocale } from '/@/stores/locale'
import App from './App.vue'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(ToastService)
app.use(store)

// app.mount('#app')

queueMicrotask(async () => {
  const { currentLocale } = useSimpleLocale()

  setupI18n(app, { defaultLocale: currentLocale }).then(() => {
    app.mount('#app')
  })
})
