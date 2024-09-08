import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import Dashboard from './index.vue'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'virtual:uno.css'
import '/@/assets/style.css'
import '/@/assets/override.css'

const app = createApp(Dashboard)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(ToastService)

app.mount('#app')
