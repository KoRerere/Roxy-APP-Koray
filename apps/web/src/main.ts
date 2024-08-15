import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import Ripple from 'primevue/ripple'
import { definePreset } from '@primevue/themes'
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
    preset: definePreset(Aura, {
      primitive: {
        borderRadius: {
          'none': '0',
          'xs': '2px',
          'sm': '4px',
          'md': '6px',
          'lg': '8px',
          'xl': '10px',
          '2xl': '12px',
          '3xl': '16px',
          '4xl': '24px',
          'full': '9999px',
        },
      },
      scc: {
        scv: {
          '0': '0px',
          '0_5': '2px',
          '1': '4px',
          '1_5': '6px',
          '2': '8px',
          '3': '12px',
          '4': '16px',
          '5': '20px',
          '6': '24px',
          '8': '32px',
          '10': '40px',
          '12': '48px',
          '16': '64px',
          '20': '80px',
          '24': '96px',
          '32': '128px',
          '40': '160px',
          '48': '192px',
          '56': '224px',
          '64': '256px',
          '80': '320px',
          '96': '384px',
          '120': '480px',
          '140': '560px',
          '160': '640px',
          '180': '720px',
          '192': '768px',
          '256': '1024px',
          '320': '1280px',
          '360': '1440px',
          '400': '1600px',
          '480': '1920px',
        },
        spacing: {
          'none': '{scv.0}',
          'xs': '{scv.0_5}',
          'sm': '{scv.1}',
          'md': '{scv.1_5}',
          'lg': '{scv.2}',
          'xl': '{scv.3}',
          '2xl': '{scv.4}',
          '3xl': '{scv.5}',
        },
      },
    }),
  },
})

app.directive('ripple', Ripple)

app.mount('#app')
