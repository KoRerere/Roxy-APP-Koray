import { BrowserManager } from './browserManager'
import { isDev } from '/@/utils'

export const browserManager = new BrowserManager()

// 方便调试
if (isDev) {
  globalThis.browserManager = browserManager
}

