import {
  BaseApi,
  HttpClient,
  LimitApi,
  LoggingApi,
  PlatformApi,
  PluginsApi,
  ProxyApi,
  TeamApi,
  WindowApi,
} from '@roxy/backend-api'
import qs from 'qs'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'

export const httpClient = new HttpClient({
  baseURL: 'https://lumitest.lumibrowser.com/',
  paramsSerializer(params) { return qs.stringify(params, { arrayFormat: 'comma' }) },
})

httpClient.instance.interceptors.request.use((config) => {
  const { token } = useUserStore()
  const { currentWorkspace } = useWorkspaceStore()
  config.headers.token = token
  config.headers.appVersion = '3.0.0'
  config.headers.workspaceId = currentWorkspace?.id
  return config
})

export const API = {
  window: new WindowApi(httpClient),
  proxy: new ProxyApi(httpClient),
  plugins: new PluginsApi(httpClient),
  logging: new LoggingApi(httpClient),
  team: new TeamApi(httpClient),
  base: new BaseApi(httpClient),
  platform: new PlatformApi(httpClient),
  limit: new LimitApi(httpClient),
}
