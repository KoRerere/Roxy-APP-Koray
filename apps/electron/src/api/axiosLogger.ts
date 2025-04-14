// axiosLogger.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export function attachAxiosLogger(instance: AxiosInstance) {
  // 请求拦截器
  instance.interceptors.request.use((config) => {
    const { method, url, headers, data } = config
    const start = Date.now()
      ; (config as any).metadata = { start }

    console.info('[Axios][Request]', JSON.stringify({
      method,
      url,
      headers,
      data,
    }, null, 2))

    return config
  })

  // 响应拦截器
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const { config, status, statusText, data } = response
      const { method, url } = config
      const duration = Date.now() - (config as any).metadata?.start

      console.info('[Axios][Response]', JSON.stringify({
        method,
        url,
        status,
        statusText,
        duration: `${duration}ms`,
        data,
      }, null, 2))

      return response
    },
    (error) => {
      const config = error.config
      const duration = config?.metadata ? Date.now() - config.metadata.start : undefined

      console.error('[Axios][Error]', JSON.stringify({
        message: error.message,
        code: error.code,
        url: config?.url,
        method: config?.method,
        duration: duration ? `${duration}ms` : undefined,
        response: error.response?.data,
      }, null, 2))

      return Promise.reject(error)
    }
  )
}
