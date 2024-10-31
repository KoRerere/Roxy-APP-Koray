import './polyfill'
import '/@/styles/index.css'
import '@mdi/font/css/materialdesignicons.css'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'virtual:uno.css'
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import mixpanel from 'mixpanel-browser'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Ripple from 'primevue/ripple'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { setupI18n } from '/@/locales'
import { store } from '/@/stores'
import { useSimpleLocale } from '/@/stores/locale'
import myPreset from '/@/styles/primevuePresets'
import App from './App.vue'
import router from './router'

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: 'full-url',
  persistence: 'localStorage',
  // https://documentation.freshpaint.io/integrations/destinations/apps/mixpanel
  // autotrack: true,
})
globalThis.mixpanel = mixpanel
console.log('myPreset', myPreset)
const app = createApp(App)

app.use(store)
app.use(router)
app.use(ToastService)
app.use(DialogService)
app.use(ConfirmationService)
app.use(PrimeVue, {
  ripple: true,
  theme: {
    options: {
      darkModeSelector: '.my-app-dark',
    },
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
      components: {
        toast: {
          colorScheme: {
            light: {
              blur: '3px',
            },
          },
        },
      },
    }),
  },
})

app.directive('ripple', Ripple)
app.directive('tooltip', Tooltip)

queueMicrotask(async () => {
  const { currentLocale } = useSimpleLocale()

  setupI18n(app, { defaultLocale: currentLocale }).then(() => {
    app.mount('#app')
  })
})
