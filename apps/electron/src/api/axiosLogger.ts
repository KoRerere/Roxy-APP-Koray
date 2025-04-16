// axiosLogger.ts
import { AxiosInstance, AxiosResponse } from 'axios'
import log from 'electron-log/main';
import { join } from 'path';
import { appConfig } from '/@/constants';
import { app } from 'electron';

export function attachAxiosLogger(instance: AxiosInstance) {
  const axiosLogger = log.create({ logId: 'axios-logger' });
  axiosLogger.transports.file.level = 'debug'
  axiosLogger.transports.console.level = false
  axiosLogger.transports.console.format = `[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}`
  axiosLogger.transports.file.format = `[{y}-{m}-{d} {h}:{i}:{s}] [{level}][${app.getVersion()}] {text}`
  axiosLogger.transports.file.resolvePathFn = () => join(appConfig.logsDir, 'axios.log')

  // 请求拦截器
  instance.interceptors.request.use((config) => {
    const { method, url, headers, data } = config
    const start = Date.now()
      ; (config as any).metadata = { start }

    axiosLogger.info('[Axios][Request]', JSON.stringify({
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

      axiosLogger.info('[Axios][Response]', JSON.stringify({
        method,
        url,
        status,
        statusText,
        duration: `${duration}ms`,
        data: JSON.stringify(data),
      }, null, 2))

      return response
    },
    (error) => {
      const config = error.config
      const duration = config?.metadata ? Date.now() - config.metadata.start : undefined

      axiosLogger.error('[Axios][Error]', JSON.stringify({
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
