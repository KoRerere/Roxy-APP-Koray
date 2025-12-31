import { createApp } from 'vue'
import App from './App.vue'

// 禁用 WebView 默认右键菜单（如需保留输入框/编辑器右键，可改成白名单逻辑）
window.addEventListener(
  'contextmenu',
  (e) => {
    // e.preventDefault()
  },
  { capture: true },
)

createApp(App).mount('#app')
