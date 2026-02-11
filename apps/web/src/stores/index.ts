import { createPinia } from 'pinia'
import { createSentryPiniaPlugin } from '@sentry/vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import type { App } from 'vue'
import { useThemeStore } from '/@/stores/theme'

export function setupStore(app: App) {
  const store = createPinia()
  store.use(piniaPluginPersistedstate)
  store.use(createSentryPiniaPlugin())
  app.use(store)
}

export function initStore() {
  useThemeStore()
}
