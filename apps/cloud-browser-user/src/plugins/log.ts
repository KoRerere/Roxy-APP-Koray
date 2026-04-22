import type { App } from 'vue'

export interface Logger {
  error(error: Error): void
  warn(...log: any[]): void
  info(...log: any[]): void
  debug(...log: any[]): void
}

export const logger: Logger = {
  error: (error: Error) => console.error('[%cROXY%c] %cERR', 'color: #498ad8;', '', 'color: #d84949;', error),
  warn: (...log: any[]) => console.warn('[%cROXY%c] %cWRN', 'color: #498ad8;', '', 'color: #eae364;', ...log),
  info: (...log: any[]) => console.info('[%cROXY%c] %cINF', 'color: #498ad8;', '', 'color: #4ac94c;', ...log),
  debug: (...log: any[]) => console.log('[%cROXY%c] %cDBG', 'color: #498ad8;', '', 'color: #eae364;', ...log),
}

const plugin = {
  install(app: App) {
    window.$log = logger
    app.config.globalProperties.$log = logger
  },
}

declare global {
  interface Window {
    $log: Logger
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $log: Logger
  }
}

export default plugin
