import { BrowserWindow, BrowserWindowConstructorOptions, net, Protocol, Session, session } from "electron"
import { appConfig, mediaProtocolName, ROXY_MAIN_WINDOW_ID, ROXY_WINDOW_ID_KEY } from "/@/constants"
import { encryptAESGCM, getCommonRequestHeaders, getDeviceId, getInviteCode } from "/@/utils"
import { isPackaged } from "/@/constants/common"
import { store } from "/@/modules/store"
import { getBaseUrl } from "/@/api/getGatewayConfig"
import { getRemoteConfig } from "/@/modules/browser/browser-manager/utils"

/** 通用创建窗口 */
export function createWindow(options: BrowserWindowConstructorOptions & { roxyWindowId: string }) {
  const { roxyWindowId, ...restOptions } = options

  // const partition = 'persist:direct'
  // const ses = session.fromPartition(partition)

  // ses.setProxy({ mode: 'direct' })


  // 主窗口处理媒体协议
  if (roxyWindowId === ROXY_MAIN_WINDOW_ID) {
    handleRequest()
    handleCustomProtocol()
  }

  const browserWindow = new BrowserWindow({
    ...restOptions,
    webPreferences: {
      // partition,
      spellcheck: false,
      preload: appConfig.preloadFilePath,
      webviewTag: false,
      ...options.webPreferences,
    }
  })

  browserWindow[ROXY_WINDOW_ID_KEY] = roxyWindowId

  return browserWindow
}

export function handleCustomProtocol(protocol: Protocol = session.defaultSession.protocol) {
  if (protocol.isProtocolHandled(mediaProtocolName)) {
    return
  }

  protocol.handle(mediaProtocolName, (request) => {
    const filePath = request.url.slice(`${mediaProtocolName}:`.length)
    console.debug('protocol handle', filePath)
    return net.fetch(filePath)
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
  const localUrl = atob('aHR0cHM6Ly9yb3h5YnJvd3Nlci5hcHAvYXBp')// 拦截所有 URL
  const headers = getCommonRequestHeaders()

  protocol.handle(customProtocol, async (request) => {
    // 拦截所有 URL
    if (request.url.startsWith(localUrl)) {

      const remoteConfig = getRemoteConfig()

      if (Array.isArray(remoteConfig?.needDeviceIdApis)) {
        if (remoteConfig.needDeviceIdApis.some(api => request.url.includes(api))) {
          deviceId ||= encryptAESGCM(await getDeviceId())
          inviteCode = await getInviteCode()
          request.headers.set('R-DEVICE-ID', deviceId)
          request.headers.set('R-INVITE-CODE', inviteCode)
        }
      }

      for (const key in headers) {
        request.headers.set(key, headers[key])
      }
      const targetUrl = request.url.replace(localUrl, getBaseUrl())//将web的虚拟地址替换为真实地址

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
      });

    }

    if (request.url.includes('action/upload_file') && !request.headers.has('origin')) {
      request.headers.set('origin', request.referrer)
    }

    // 其它请求原样处理
    return net.fetch(request, {
      bypassCustomProtocolHandlers: true,
      duplex: 'half',
    }).catch(err => {
      console.error('net.fetch error', {
        url: request.url,
        error: err,
        headers: Object.fromEntries(request.headers),
      })
      return Promise.reject(err)
    })
  });
}
