import { createApp } from 'vue'
import '@unocss/reset/normalize.css'
import 'virtual:uno.css'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Dashboard from './index.vue'

const app = createApp(Dashboard)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(ToastService)

app.mount('#app')
