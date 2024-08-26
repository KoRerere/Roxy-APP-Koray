import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import Ripple from 'primevue/ripple'
import { definePreset } from '@primevue/themes'
import myPreset from '/@/assets/preset.ts'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

import '/@/assets/style.css'
import '@unocss/reset/normalize.css'
import 'virtual:uno.css'
import '@mdi/font/css/materialdesignicons.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: definePreset(Aura, myPreset)
  }
})

app.directive('ripple', Ripple)

app.mount('#app')
