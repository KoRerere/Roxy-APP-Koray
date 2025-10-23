import '/@/styles/index.scss'
import '/@/styles/primevuePresets/theme/'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import { setupGlobalMethods } from '/@/globalMethods'
import VideoPlayer from './components/rx-video-player'
import RxSvgIcon from './components/rx-icon'

// import { browserTracingIntegration, init as initSentryElectron, replayIntegration } from '@sentry/electron/renderer'
import { init as initSentryVue, browserTracingIntegration, replayIntegration, feedbackIntegration, consoleLoggingIntegration } from "@sentry/vue";
import mixpanel from "mixpanel-browser";

import { createApp } from "vue";
import { setupI18n, type SupportedLanguagesType } from "/@/locales";
import { setupStore } from "/@/stores";
import router from '/@/router'

import App from "./App.vue";
import { setupRouter } from '/@/router'
import { setupPrimeVue } from '/@/primevue'

const app = createApp(App);
app.use(VideoPlayer)
app.use(RxSvgIcon)
setupGlobalMethods(app)
// https://docs.sentry.io/platforms/javascript/guides/electron/
initSentryVue({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_VERSION,
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    browserTracingIntegration({ router }),
    replayIntegration(),
    consoleLoggingIntegration()
  ],
})

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
