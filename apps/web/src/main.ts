import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Ripple from 'primevue/ripple'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
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
import myPreset from '/@/styles/primevuePresets'

console.log('myPreset', myPreset)
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
    preset: definePreset(Aura, {
      primitive: myPreset,
      semantic: {
        primary: {
          100: '{Color.blue.100}',
          200: '{Color.blue.100}',
          300: '{Color.blue.100}',
          400: '{Color.blue.200}',
          500: '{Color.blue.300}',
          600: '{Color.blue.400}',
          700: '{Color.blue.500}',
          800: '{Color.blue.600}',
          900: '{Color.blue.600}',
          950: '{Color.blue.600}',
        },
      },
    }),
  },
})

app.directive('ripple', Ripple)
app.directive('tooltip', Tooltip)

app.mount('#app')
