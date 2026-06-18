import '/@/styles/index.scss'
import '/@/styles/primevuePresets/theme/'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import 'driver.js/dist/driver.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { setupGlobalMethods } from '/@/globalMethods'
import VideoPlayer from './components/rx-video-player'
import RxSvgIcon from './components/rx-icon'

// import { browserTracingIntegration, init as initSentryElectron, replayIntegration } from '@sentry/electron/renderer'
// import { browserTracingIntegration, consoleLoggingIntegration, init as initSentryVue, replayIntegration } from '@sentry/vue'
import mixpanel from 'mixpanel-browser'

import { createApp } from 'vue'
import { setupStore } from '/@/stores'
import { setupRouter } from '/@/router'

import App from './App.vue'
import { setupPrimeVue } from '/@/primevue'
import { i18n } from '/@/locales'

export const app = createApp(App)
app.use(i18n)
app.use(VideoPlayer)
app.use(RxSvgIcon)
setupGlobalMethods(app)
// https://docs.sentry.io/platforms/javascript/guides/electron/
// initSentryVue({
//   app,
//   dsn: import.meta.env.VITE_SENTRY_DSN,
//   release: import.meta.env.VITE_VERSION,
//   environment: import.meta.env.MODE,
//   sendDefaultPii: true,
//   tracesSampleRate: 0.1,
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1.0,
//   enableLogs: true,
//   integrations: [
//     browserTracingIntegration({ router }),
//     replayIntegration(),
//     consoleLoggingIntegration(),
//   ],
// })

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: false,
  autocapture: false,
  persistence: 'localStorage',
  // https://documentation.freshpaint.io/integrations/destinations/apps/mixpanel
  // autotrack: true,
})
globalThis.mixpanel = mixpanel

setupPrimeVue(app)
setupRouter(app)
setupStore(app)
