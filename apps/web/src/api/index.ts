import {
  BaseApi,
  HttpClient,
  LoggingApi,
  PlatformApi,
  PluginsApi,
  ProxyApi,
  TeamApi,
  WindowApi
} from '@roxy/backend-api'

export const httpClient = new HttpClient({
  baseURL: 'https://lumitest.lumibrowser.com/'
})

httpClient.instance.interceptors.request.use((config) => {
  config.headers.token = 'HR7hg6ojoTI3ExyN1723775012325'
  config.headers.appVersion = '3.0.0'
  return config
})

export const API = {
  window: new WindowApi(httpClient),
  proxy: new ProxyApi(httpClient),
  plugins: new PluginsApi(httpClient),
  logging: new LoggingApi(httpClient),
  team: new TeamApi(httpClient),
  base: new BaseApi(httpClient),
  platform: new PlatformApi(httpClient)
}
