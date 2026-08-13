import type { BrowserWindowConstructorOptions, Protocol } from 'electron'
import { BrowserWindow, net, session } from 'electron'
import { pathToFileURL } from 'node:url'
import { getBaseUrl } from '/@/api/getGatewayConfig'
import { appConfig, mediaProtocolName, ROXY_MAIN_WINDOW_ID, ROXY_WINDOW_ID_KEY } from '/@/constants'
import { isMac, isPackaged } from '/@/constants/common'
import { getRemoteConfig } from '/@/modules/browser/browser-manager/utils'
import { enableUnlockCombo } from '/@/modules/devtools-guard'
import { encryptAESGCM, getCommonRequestHeaders, getDeviceId, getInviteCode } from '/@/utils'

/** 通用创建窗口 */
export function createWindow(options: BrowserWindowConstructorOptions & { roxyWindowId: string }) {
  const { roxyWindowId, ...restOptions } = options

  // 主窗口处理媒体协议
  if (roxyWindowId === ROXY_MAIN_WINDOW_ID) {
    // handleRequest()
    handleCustomProtocol()
  }

  const browserWindow = new BrowserWindow({
    ...restOptions,
    webPreferences: {
      // partition,
      spellcheck: false,
      preload: appConfig.preloadFilePath,
      webviewTag: false,
      sandbox: false,
      ...options.webPreferences,
      // 该项创建后不可修改，若关掉则解锁时只能重建窗口；
      // 锁定统一由 setupDevToolsGuard 在 JS 层维持
      devTools: true,
    },
  })

  browserWindow[ROXY_WINDOW_ID_KEY] = roxyWindowId

  // Windows/Linux 下即使应用菜单已置空，窗口级菜单仍可能被 Alt 唤出
  if (!isMac) {
    browserWindow.setMenu(null)
  }

  // 主窗口保留隐藏连击入口，供开发人员排查问题；
  // 快捷键与 openDevTools 拦截由全局的 setupDevToolsGuard 负责
  if (roxyWindowId === ROXY_MAIN_WINDOW_ID) {
    enableUnlockCombo(browserWindow.webContents)
  }

  return browserWindow
}

/** 关闭所有窗口 */
export function closeAllWindows() {
  BrowserWindow.getAllWindows().forEach(win => win.destroy())
}

/** 根据窗口 ID 获取窗口 */
export function getWindowById(id: string) {
  return BrowserWindow.getAllWindows().find(win => win[ROXY_WINDOW_ID_KEY] === id)
}

/** 根据窗口 ID 关闭窗口 */
export function closeWindowById(id: string) {
  const win = getWindowById(id)
  win?.destroy()
}

/** 从 roxy-media 请求 URL 解析出本地绝对路径 */
function resolveMediaProtocolFilePath(requestUrl: string): string {
  const prefix = `${mediaProtocolName}:`
  let filePath = requestUrl.slice(prefix.length)

  try {
    const parsed = new URL(requestUrl)
    // roxy-media:///Users/... 会把 Users 解析为 hostname，需拼回完整路径
    if (parsed.hostname)
      filePath = `/${parsed.hostname}${parsed.pathname}`
    else if (parsed.pathname)
      filePath = parsed.pathname
  }
  catch {
    // slice 结果兜底
  }

  return decodeURIComponent(filePath)
}

export function handleCustomProtocol(protocol: Protocol = session.defaultSession.protocol) {
  if (protocol.isProtocolHandled(mediaProtocolName)) {
    return
  }

  protocol.handle(mediaProtocolName, (request) => {
    const filePath = resolveMediaProtocolFilePath(request.url)
    console.debug('protocol handle', filePath)
    return net.fetch(pathToFileURL(filePath).href, {
      bypassCustomProtocolHandlers: true,
    })
  })
}

function handleRequest(protocol: Protocol = session.defaultSession.protocol) {
  const customProtocol = 'https'
  if (protocol.isProtocolHandled(customProtocol)) {
    return
  }

  let deviceId = ''
  let inviteCode = ''
  // 原文为 https://roxybrowser.app/api
  /**
   * 拦截所有 URL
   */
  const localUrl = atob('aHR0cHM6Ly9yb3h5YnJvd3Nlci5hcHAvYXBp')
  const headers = getCommonRequestHeaders()

  protocol.handle(customProtocol, async (request) => {
    // 拦截所有 URL
    if (request.url.startsWith(localUrl)) {
      const remoteConfig = getRemoteConfig()

      if (Array.isArray(remoteConfig?.needDeviceIdApis)) {
        if (remoteConfig.needDeviceIdApis.some(api => request.url.includes(api))) {
          deviceId ||= await encryptAESGCM(await getDeviceId())
          inviteCode = await getInviteCode()
          request.headers.set('R-DEVICE-ID', deviceId)
          request.headers.set('R-INVITE-CODE', inviteCode)
        }
      }

      for (const key in headers) {
        request.headers.set(key, headers[key])
      }
      /**
       *将web的虚拟地址替换为真实地址
       */
      const targetUrl = request.url.replace(localUrl, getBaseUrl())

      if (isPackaged) {
        console.debug('request.url', targetUrl)
        console.debug('request.headers', Object.fromEntries(request.headers))
      }

      // 直接透传请求，原样转发
      return fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body, // 保留原始请求体
        redirect: 'follow',
        duplex: 'half',
      })
    }

    if (request.url.includes('action/upload_file') && !request.headers.has('origin')) {
      request.headers.set('origin', request.referrer)
    }

    // 其它请求原样处理
    return net.fetch(request, {
      bypassCustomProtocolHandlers: true,
      duplex: 'half',
    }).catch((err) => {
      console.error('net.fetch error', {
        url: request.url,
        error: err,
        headers: Object.fromEntries(request.headers),
      })
      return Promise.reject(err)
    })
  })
}
