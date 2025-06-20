import RxSvgIconCE from './src/svg-icon.ce.vue'
export { default as RxSvgIcon } from './src/svg-icon.vue'
export * from './src/svg-icon-types'
export { svgIcons } from './src/svgIcons'

import { defineCustomElement, type App } from "vue"

// 转换为自定义元素构造器
const RxSvgIconElement = defineCustomElement(RxSvgIconCE)

export default {
  install(app: App) {
    customElements.define('rx-svg-icon', RxSvgIconElement)
  }
}
