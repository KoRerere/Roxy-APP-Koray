import RxSvgIcon from './src/svg-icon.ce.vue'
export * from './src/svg-icon-types'
export { svgIcons } from './src/svgIcons'

import { defineCustomElement, type App } from "vue"

// 转换为自定义元素构造器
const RxSvgIconElement = defineCustomElement(RxSvgIcon)

export default {
  install(app: App) {
    app.component('RxSvgIcon', RxSvgIcon)
    app.component('SvgIcon', RxSvgIcon)
    customElements.define('rx-svg-icon', RxSvgIconElement)
  }
}

export { RxSvgIcon }