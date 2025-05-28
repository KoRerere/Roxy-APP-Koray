import '/@/styles/index.scss'
import '/@/styles/theme/'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'

// import { browserTracingIntegration, init as initSentryElectron, replayIntegration } from '@sentry/electron/renderer'
// import { init as initSentryVue } from '@sentry/vue'
import mixpanel from "mixpanel-browser";

import { createApp } from "vue";
import { setupI18n, type SupportedLanguagesType } from "/@/locales";
import { setupStore } from "/@/stores";

import App from "./App.vue";
import { setupRouter } from '/@/router'
import { setupPrimeVue } from '/@/primevue'

const app = createApp(App);

// https://docs.sentry.io/platforms/javascript/guides/electron/#configure
// initSentryElectron({
//   app,
//   integrations: [
//     browserTracingIntegration(),
//     replayIntegration(),
//   ],

//   // Set tracesSampleRate to 1.0 to capture 100%
//   // of transactions for performance monitoring.
//   // We recommend adjusting this value in production
//   tracesSampleRate: 1.0,

//   // Capture Replay for 10% of all sessions,
//   // plus for 100% of sessions with an error
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1.0,
// }, initSentryVue)

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: "full-url",
  persistence: "localStorage",
  // https://documentation.freshpaint.io/integrations/destinations/apps/mixpanel
  // autotrack: true,
});
globalThis.mixpanel = mixpanel;

setupStore(app);
setupPrimeVue(app);

setupRouter(app).then((softConfig) => {
  const { language, } = softConfig;
  setupI18n(app, { defaultLocale: language as SupportedLanguagesType }).then(() => {
    app.mount('#app')
  })
})