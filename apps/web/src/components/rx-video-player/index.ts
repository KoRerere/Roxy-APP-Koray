import { defineCustomElement, type App } from "vue"
import VideoPlayer from './video-player.ce.vue'

// 转换为自定义元素构造器
const VideoPlayerElement = defineCustomElement(VideoPlayer)

export default {
  install(app: App) {
    customElements.define('roxy-video-player', VideoPlayerElement)
  }
}

