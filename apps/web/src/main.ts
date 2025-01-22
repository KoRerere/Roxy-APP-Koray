import './polyfill'
import '/@/styles/index.scss'
import '@mdi/font/css/materialdesignicons.css'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import { browserTracingIntegration, init as initSentryElectron, replayIntegration } from '@sentry/electron/renderer'
import { init as initSentryVue } from '@sentry/vue'
import mixpanel from 'mixpanel-browser'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Ripple from 'primevue/ripple'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { setupI18n } from '/@/locales'
import { setupStore } from '/@/stores'
import { useSimpleLocale } from '/@/stores/locale'
import myPreset from '/@/styles/primevuePresets'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// https://docs.sentry.io/platforms/javascript/guides/electron/#configure
initSentryElectron({
  app,
  integrations: [
    browserTracingIntegration(),
    replayIntegration(),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
}, initSentryVue)

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: 'full-url',
  persistence: 'localStorage',
  // https://documentation.freshpaint.io/integrations/destinations/apps/mixpanel
  // autotrack: true,
})
globalThis.mixpanel = mixpanel
console.log('myPreset', myPreset)

setupStore(app)
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
        dialog: {
          root: {
            background: '{overlay.modal.background}',
            borderColor: '#A3A9AD',
            color: '{overlay.modal.color}',
            borderRadius: '6px',
            shadow: '0px 1px 1px 0px rgba(0, 0, 0, 0.04), 0px 2px 8px 0px rgba(0, 0, 0, 0.04), 0px 3px 17px 0px rgba(0, 0, 0, 0.04), 0px 4px 30px 0px rgba(0, 0, 0, 0.12)'
          },
          header: {
            padding: '12px 18px 6px 24px',
            gap: '0.5rem'
          },
          title: {
            fontSize: '14px',
            fontWeight: '600'
          },
          content: {
            padding: '0 {overlay.modal.padding} {overlay.modal.padding} {overlay.modal.padding}'
          },
          footer: {
            padding: '0 {overlay.modal.padding} {overlay.modal.padding} {overlay.modal.padding}',
            gap: '0.5rem'
          }
        },
      },
    }),
  },
})

app.directive('ripple', Ripple)
app.directive('tooltip', Tooltip)

setTimeout(async () => {
  const simpleLocale = useSimpleLocale()

  await simpleLocale.initLocale().finally(() => {
    setupI18n(app, { defaultLocale: simpleLocale.currentLocale }).then(() => {
      app.mount('#app')
    })
  })
})
