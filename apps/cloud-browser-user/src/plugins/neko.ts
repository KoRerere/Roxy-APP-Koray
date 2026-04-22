import type { App } from 'vue'
import { NekoClient } from '~/neko'
import { logger } from './log'
import { setClient } from '~/runtime/client'

declare global {
  interface Window {
    $client: NekoClient
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $client: NekoClient
  }
}

export const client = new NekoClient()
  .on('error', logger.error)
  .on('warn', logger.warn)
  .on('info', logger.info)
  .on('debug', logger.debug)

const plugin = {
  install(app: App) {
    setClient(client)
    app.config.globalProperties.$client = client
  },
}

export default plugin
