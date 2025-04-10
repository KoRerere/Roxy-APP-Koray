import './catchException'
import './polyfill'
import './locales/'
import { setupModules } from '/@/modules/'

setupModules()

// 方便测试环境调试
if (import.meta.env.DEV) {
  import('electron').then(electron => {
    globalThis.electron = electron
  })
}

