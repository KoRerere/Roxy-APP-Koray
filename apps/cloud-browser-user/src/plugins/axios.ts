import type { App } from 'vue'
import axios, { type AxiosInstance } from 'axios'

export const http: AxiosInstance = axios.create()

const plugin = {
  install(app: App) {
    window.$http = http
    app.config.globalProperties.$http = http
  },
}

declare global {
  interface Window {
    $http: AxiosInstance
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $http: AxiosInstance
  }
}

export default plugin
