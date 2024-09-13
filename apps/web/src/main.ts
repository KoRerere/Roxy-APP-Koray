import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Ripple from 'primevue/ripple'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'

import router from './router'
import '/@/styles/index.css'

import '@mdi/font/css/materialdesignicons.css'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'virtual:uno.css'
import { store } from '/@/stores'
import myPreset from '/@/styles/preset'

const app = createApp(App)

app.use(store)
app.use(router)
app.use(i18n)
app.use(ToastService)
app.use(DialogService)
app.use(ConfirmationService)
app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: definePreset(Aura, myPreset),
  },
})

app.directive('ripple', Ripple)

app.mount('#app')
