import { createApp } from 'vue'
import { setupI18n } from '/@/locales'
import { setupGlobalMethods } from '/@/globalMethods'
import { setupPrimeVue } from '/@/primevue'
import '/@/electron-api-polyfill'
import { pageLocale } from './locale'
import { authToken } from './token'
import App from './App.vue'
import '@unocss/reset/normalize.css'
import 'primeicons/primeicons.css'
import 'uno.css'
import '/@/styles/index.scss'

globalThis.isElectron = false

// 独立落地页走文档滚动，覆盖主应用 reset.css 对 html/body 的 overflow: hidden
document.documentElement.classList.add('proxy-segment-replace-scroll')

if (!authToken) {
  // initAuthToken 已触发登录页跳转，避免无 token 时挂载页面
}
else {
  setupI18n({ defaultLocale: pageLocale as 'zh-CN' }).finally(() => {
    const app = createApp(App)

    setupGlobalMethods(app)
    setupPrimeVue(app)
    app.mount('#app')
  })
}
