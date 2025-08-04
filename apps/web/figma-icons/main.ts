import Aura from '@primeuix/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import App from './App.vue'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.scss'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(ToastService)

app.mount('#app')
