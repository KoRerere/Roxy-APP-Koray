import {
  ApiApi,
  AppStatisticsApi,
  AppTrackingEventApi,
  BaseApi,
  HttpClient,
  KycApi,
  LimitApi,
  LoggingApi,
  PayApi,
  PlatformApi,
  PluginsApi,
  PointsApi,
  ProxyApi,
  TeamApi,
  UserAddUninstallReasonAnswerApi,
  UserReportRolaJumpClickApi,
  WindowApi,
} from '@roxy/backend-api'
import { serializeRequestParams } from '/@/api/serializeRequestParams'
import { installEtagCache } from '/@/api/etag-cache'
import { getBaseUrl, getGatewayConfig, reGetGatewayConfigByCountryChange } from '/@/api/getGatewayConfig'
import { getCommonHeaders, getDeviceId, getInviteCode, needDeviceIdApis } from '/@/api/util'
import { useSimpleLocale } from '/@/stores/locale'
import { isOfficialSiteSession, useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { handleResponseHeaders } from '/@/api/message/'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'
import { isMainWindow } from '/@/utils'
import { markSessionLost } from '/@/utils/sessionLost'
import { supportsApp4_0_7 } from '/@/utils/app-supports'
import { PROTOCOL_AUTO_LOGIN_PENDING } from '/@/constants/storage-key'

console.log('VITE_BASE_URL', import.meta.env.VITE_BASE_URL)

/** 官网协议 token 按 web 身份请求；密码/OAuth 登录不受影响 */
function isOfficialSiteAuth() {
  return isOfficialSiteSession() || Boolean(useUserStore().isOfficialSiteToken)
}

/** 官网 token 在 Limit 列表/权限接口上可能 403，拦截器不能先清登录态 */
const OFFICIAL_SITE_PASS_403_URLS = [
  '/user_get_workspace_list',
  '/user_get_team_permissions',
]

let commonHeaders: any
let deviceId = ''
let inviteCode: string

const closeOtherWindow = debounce(() => {
  if (!isMainWindow) {
    window.close()
  }
}, 200)

const showBackDefaultWorkspace = debounce(() => {
  emitter.emit('backDefaultWorkspace')
}, 200)

/** 被移出的是本次请求头里的空间，不能用切换后的当前空间 */
function readWorkspaceIdHeader(headers: { workspaceId?: unknown, get?: (name: string) => unknown } | undefined) {
  const raw = headers?.workspaceId ?? headers?.get?.('workspaceId')
  if (raw === undefined || raw === null || raw === '') {
    return undefined
  }
  return String(raw)
}

/** 低版本客户端没有 closeByWorkspace，只关已经出现在已打开列表里的窗口 */
async function closeRemovedWorkspaceBrowsers(workspaceId: string) {
  if (!globalThis.isElectron) {
    return
  }
  if (supportsApp4_0_7()) {
    try {
      await globalThis.electronAPI.send('browser:closeByWorkspace', workspaceId)
      return
    }
    catch (error) {
      console.error('[API] closeByWorkspace failed, fallback to opened browsers', error)
    }
  }
  const openedBrowsers = await globalThis.electronAPI.send('browser:getOpenedBrowser')
  const dirIds = openedBrowsers.flatMap(item =>
    String(item.workspaceId) === workspaceId && item.dirId ? [item.dirId] : [],
  )
  if (dirIds.length > 0) {
    await globalThis.electronAPI.send('browser:batchClose', dirIds)
  }
}

export function createHttpClient(
  Client: typeof HttpClient,
  resetConfigFn?: (config: any) => void | Promise<void>,
) {
  const httpClient = new Client({
  /**
   * baseURL: import.meta.env.VITE_BASE_URL,
   */
    /**
     * baseURL: 'https://roxybrowser.app/api',
     */
    paramsSerializer(params) {
      return serializeRequestParams(params)
    },
  })

  // 先于业务拦截器注册：axios request 拦截器逆序执行（业务先跑）、response
  // 拦截器顺序执行（ETag 先跑），使 304 在业务拦截器看到之前就被归一为 200 + 本地 body
  installEtagCache(httpClient.instance)

  httpClient.instance.interceptors.request.use(async (config) => {
    const baseURL = getBaseUrl() || await getGatewayConfig()
    inviteCode ??= await getInviteCode()
    const officialSiteAuth = globalThis.isElectron && isOfficialSiteAuth()

    if (needDeviceIdApis.some(api => config.url?.includes(api))) {
      deviceId ||= await getDeviceId()
      config.headers['R-DEVICE-ID'] = deviceId
    }

    if (globalThis.$lastSelectedNetworkNode === 'auto' || !globalThis.$lastSelectedNetworkNode?.gate) {
      config.baseURL = getBaseUrl() || await getGatewayConfig()
    }
    else {
      config.baseURL = `https://${globalThis.$lastSelectedNetworkNode.gate}`
    }

    // 官网 token 不带 Electron source:app / R-DEVICE-NAME，否则 Limit 会拒；密码登录仍走原 commonHeaders
    if (!officialSiteAuth) {
      commonHeaders ||= await getCommonHeaders()
      Object.assign(config.headers, {
        ...commonHeaders,
        ...config.headers,
      })
    }

    console.debug('baseURL', baseURL)
    config.baseURL ||= baseURL

    const { token, appVersion } = useUserStore()
    const { currentWorkspace } = useWorkspaceStore()
    const { currentLocale } = useSimpleLocale()
    config.headers.token ||= token
    config.headers.source = globalThis.isElectron && !officialSiteAuth ? 'app' : 'web'
    config.headers.language = currentLocale
    config.headers.appVersion = appVersion
    config.headers.webVersion = __WEB_VERSION__
    config.headers.workspaceId = currentWorkspace?.id
    config.headers['R-INVITE-CODE'] = inviteCode
    config.metadata = {
      reqTime: Date.now(),
    }
    // R-OS:mac/win
    // R-OSBIT:apple/intel/64/11
    // R-VERSION:1.0.0
    // await handleRequest(config)

    await resetConfigFn?.(config)

    return config
  }, (error) => {
    console.error('request error', error)
    if (error?.message?.includes('ERR_CONNECTION_RESET')) {
      getGatewayConfig()
    }
    return Promise.reject(error)
  })

  httpClient.instance.interceptors.response.use(async (response) => {
    const { url, baseURL } = response.config

    reGetGatewayConfigByCountryChange({
      country: response.headers['r-real-country'],
      reqUrl: url ? new URL(url, baseURL).href : baseURL ?? '',
      reqTime: response.config.metadata?.reqTime ?? 0,
    })

    const code = response.data.code
    if (code === 405) {
    // 记录首次掉登录态时间（不重复覆盖，避免轮询 403 重置 1 小时计时）
      markSessionLost()
      // 踢出登录
      emitter.emit('kickedOut', response.data.data)
      closeOtherWindow()
      return response
    }
    else if (code === 403) {
      if (
        (isOfficialSiteAuth() && OFFICIAL_SITE_PASS_403_URLS.some(path => url?.includes(path)))
        || (globalThis.isElectron && sessionStorage.getItem(PROTOCOL_AUTO_LOGIN_PENDING))
      ) {
        console.warn('[API] skip 403 logout for official-site/protocol-pending', url)
        return response
      }
      markSessionLost() // 同上，仅记录首次失效时间
      closeOtherWindow()
      // 未登录，跳转登录页；强制升级弹窗由 useForceUpgradeOnSessionLostReturn 在用户回到 APP 时触发
      useUserStore().clearUserInfo()
      const { default: router } = await import('/@/router')
      router.push({ name: 'login' })
      return response
    }
    // 没有空间权限或被移出空间
    else if (code === 418) {
      const removedWorkspaceId = readWorkspaceIdHeader(response.config.headers)
      if (removedWorkspaceId !== undefined) {
        await closeRemovedWorkspaceBrowsers(removedWorkspaceId).catch((error) => {
          console.error('[API] close removed workspace browsers failed', error)
        })
      }
      const workspaceStore = useWorkspaceStore()
      await workspaceStore.fetchWorkspaceList()
      const defaultId = workspaceStore.defaultWorkspace?.id
      if (defaultId) {
        await workspaceStore.setCurrentWorkspace(defaultId)
      }
      globalThis.electronAPI.send('mcp:close')
      return response
    }
    else if (code === 422) {
      showBackDefaultWorkspace()
    }
    const { config } = response
    if (config.headers.token) {
      handleResponseHeaders(response)
    }
    // await handleResponse(response)
    return response
  })

  return httpClient
}

export const httpClient = createHttpClient(HttpClient)

export const API = {
  window: new WindowApi(httpClient),
  proxy: new ProxyApi(httpClient),
  plugins: new PluginsApi(httpClient),
  logging: new LoggingApi(httpClient),
  team: new TeamApi(httpClient),
  base: new BaseApi(httpClient),
  appStatistics: new AppStatisticsApi(httpClient),
  platform: new PlatformApi(httpClient),
  limit: new LimitApi(httpClient),
  api: new ApiApi(httpClient),
  pay: new PayApi(httpClient),
  appTrackingEvent: new AppTrackingEventApi(httpClient),
  userAddUninstallReasonAnswer: new UserAddUninstallReasonAnswerApi(httpClient),
  points: new PointsApi(httpClient),
  kyc: new KycApi(httpClient),
  userReportRolaJumpClick: new UserReportRolaJumpClickApi(httpClient),
}
