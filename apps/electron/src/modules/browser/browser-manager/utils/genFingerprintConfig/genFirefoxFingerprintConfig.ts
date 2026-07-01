import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { currentOS, isMac } from '/@/constants/common'
import { getRoxynetProcess } from '/@/modules/roxynet'
import { store } from '/@/modules/store'
import { isRoxynetUpstreamReady } from '/@/modules/store/networkMode'
import { getSystemProxyAddress } from '/@/utils'
import { ensureFirefoxIcon, fitBadgeText } from './browserIcon'
import { getCityCode, getEcommerceDirectWhiteList, toNumber } from './util'

/** 生成 Firefox 浏览器指纹配置（结构按 docs/firefox指纹参数使用说明.md） */
export async function genFirefoxFingerprintConfig(winInfo: WindowItemType, proxyInfo: Record<string, any> = {}, userDataDir: string) {
  const isMobile = [`Android`, `IOS`].includes(winInfo.os)

  function getPlatformString() {
    switch (winInfo.os) {
      case 'Windows':
        return 'Win32'
      case 'macOS':
        return 'MacIntel'
      case 'Android':
        return 'Linux armv81'
      case 'IOS':
        return 'iPhone'
      default:
        return 'Linux x86_64'
    }
  }

  let ecommerceDirectWhiteList: string[] = []
  if (winInfo.isDirect) {
    ecommerceDirectWhiteList = await getEcommerceDirectWhiteList()
  }

  // 任务栏图标写入 userDataDir/firefox-icon.{ext}；徽章未变时复用缓存，跳过重复渲染
  const browserIconPath = await ensureFirefoxIcon(
    store.taskbarIconDisplay === 'windowName' ? (fitBadgeText(winInfo.windowName) || winInfo.windowSortNum) : winInfo.windowSortNum,
    userDataDir,
  )

  return {
    userAgent: winInfo.userAgentNew,
    navigator: {
      platform: winInfo.navigatorPlatform || getPlatformString(),
      hardwareConcurrency: toNumber(winInfo.hardwareConcurrent),
      maxTouchPoints: isMobile ? 5 : 0,
      deviceMemory: toNumber(winInfo.deviceMemory),
      mobile: isMobile,
    },
    windowNum: winInfo.windowSortNum,
    get timeZone() {
      if (winInfo.isTimeZone && proxyInfo.timezone) {
        return proxyInfo.timezone
      }
      if (winInfo.timeZone) {
        return winInfo.timeZone.split(' ').at(-1)
      }
    },
    /** 火狐内核应用图标路径（按 windowSortNum 动态生成带数字徽章；格式随 OS 自适应：Windows→.ico / macOS→.icns / Linux→.png） */
    browserIconPath,
    get appLocale() {
      if (winInfo.isLanguageBaseIp) {
        return getCityCode(proxyInfo.country_code)
      }
      return winInfo.language
    },
    get acceptLang() {
      if (winInfo.isDisplayLanguageBaseIp) {
        return getCityCode(proxyInfo.country_code)
      }
      return winInfo.displayLanguage
    },
    audioBuffer: {
      enableAudioBufferNoise: winInfo.audioContext,
      audioBufferNoiseValue: toNumber(winInfo.audioContextValue, 0),
    },
    canvasContext: {
      enableCanvasContextNoise: winInfo.canvas,
      canvasContextNoiseValue: toNumber(winInfo.canvasValueV2, 0),
    },
    clientRects: {
      enable: winInfo.clientRects,
      clientRectsNoiseFactorX: winInfo.clientRectsValue.clientRectsNoiseFactorX,
      clientRectsNoiseFactorY: winInfo.clientRectsValue.clientRectsNoiseFactorY,
    },
    webGL: {
      enableWebGLRendererNoise: winInfo.webGL,
      webglRenderer: winInfo.webGLInfo ? winInfo.webGLRender : '',
      webglVendor: winInfo.webGLInfo ? winInfo.webGLManufacturer : '',
      webGLRendererNoiseValue: toNumber(winInfo.webGLValue, 0),
    },
    get geoLocation() {
      const { position, isPositionBaseIp = false } = winInfo
      const positionMode = {
        0: `prompt`,
        1: `allow`,
        2: `disable`,
      }[position] || 'disable'

      function transValue(key: string) {
        if (positionMode === 'disable')
          return 0
        const num = (isPositionBaseIp ? proxyInfo : winInfo)[key]
        return toNumber(num, 0)
      }

      return {
        mode: positionMode,
        enableFakeLocationData: true,
        locationLatitude: transValue('latitude'),
        locationLongitude: transValue('longitude'),
        locationAccuracy: transValue('precisionPos'),
        locationAltitude: 0,
      }
    },
    doNotTrack: winInfo.doNotTrack,
    get imageSizeLimit() {
      if (!winInfo.forbidImage) {
        return toNumber(winInfo.forbiddenPictureSize, 0)
      }
      return -1
    },
    disablePlayVideo: !winInfo.forbidMedia,
    get fproxy() {
      const { host, port, proxyUserName, proxyPassword, isDirect } = winInfo
      const systemProxyAddress = getSystemProxyAddress()
      const protocol = winInfo.protocol?.toLocaleLowerCase?.() || ''
      const isSSH = protocol === 'ssh'
      const isUseSystemProxy = isSSH || isDirect || (getRoxynetProcess() && isRoxynetUpstreamReady(systemProxyAddress))
      const type = isUseSystemProxy && protocol === 'https' ? 'http' : isSSH ? 'socks5' : protocol
      const isNoProxy = type.toLocaleLowerCase() === 'noproxy'

      if (isNoProxy && !isUseSystemProxy) {
        return
      }

      const proxyByPassList = winInfo.proxyByPassList?.length ? winInfo.proxyByPassList : store.ipBlackList

      return {
        host: isUseSystemProxy ? '127.0.0.1' : host,
        port: Number(isUseSystemProxy ? store.roxynetProxyPort : port),
        username: isUseSystemProxy ? winInfo.dirId : proxyUserName,
        password: isUseSystemProxy ? winInfo.dirId : proxyPassword,
        type: isUseSystemProxy && isNoProxy ? 'http' : type.toLocaleLowerCase(),
        proxyByPassList: proxyByPassList?.join?.(','),
      }
    },
    portScan: {
      enablePortScanWhiteList: winInfo.portScanProtect,
      portScanWhiteList: `${store.appPort};${winInfo.portScanList.replaceAll(',', ';')}`,
    },
    get screen() {
      return {
        pixelDepth: currentOS === winInfo.os.toLowerCase() ? 0 : 24,
        colorDepth: currentOS === winInfo.os.toLowerCase() ? 0 : 24,
        width: toNumber(winInfo.resolutionX, 0),
        height: toNumber(winInfo.resolutionY, 0),
        availWidth: toNumber(winInfo.resolutionX, 0),
        availHeight: toNumber(winInfo.resolutionY, 0),
        get devicePixelRatio() {
          if (currentOS !== winInfo.os.toLowerCase()) {
            return winInfo.devicePixelRatio
          }
          return 1
        },
      }
    },
    speechSynthesis: {
      ...winInfo.speechVoicesValue,
      enable: winInfo.speechVoices,
    },
    webrtc: {
      mode: { 0: 'altered', 1: 'real', 2: 'disable' }[winInfo.webRTC] || 'disable',
      get loaclIP() {
        if (proxyInfo.ip && this.mode === 'altered') {
          return proxyInfo.ip
        }
      },
      get remoteIP() {
        if (proxyInfo.ip && this.mode === 'altered') {
          return proxyInfo.ip
        }
      },
    },
    ssl: {
      /** 禁用SSL特性，选填. 为空表示不禁用 */
      get cipherSuiteBlacklist() {
        if (winInfo.disableSsl && Array.isArray(winInfo.disableSslList)) {
          return winInfo.disableSslList.join(',')
        }
        return ''
      },
    },
    get allowDomains() {
      const domainList = winInfo.allowDomainList?.split?.('\n')?.map((item) => {
        const trimmed = item.trim()
        return trimmed.replace(/^https?:\/\//, '')
      })?.filter(Boolean)
      return domainList?.length ? domainList.concat(ecommerceDirectWhiteList) : ecommerceDirectWhiteList.length ? ecommerceDirectWhiteList : []
    },
    get disableDomains() {
      const domainList = winInfo.blockDomainList?.split?.('\n')?.map((item) => {
        const trimmed = item.trim()
        return trimmed.replace(/^https?:\/\//, '')
      })?.filter(Boolean)
      return domainList?.length ? domainList : store.blockDomainList?.filter?.(Boolean) || []
    },
    blockDomainPageFile: join(appConfig.buildInWebDir, 'blockDomain.html'),
    autofillWebSiteMult: winInfo.windowPlatformList.map(item => ({
      url: item.platformUrl,
      username: item.platformUserName,
      password: item.platformPassword,
    })),
    disablePlaySound: !winInfo.forbidAudio,
    disablePasswordSaveTips: !winInfo.forbidSavePassword,
    get allowFontList() {
      if (winInfo.fontType) {
        return winInfo.allowFontList
      }
    },
    get windowName() {
      if (store.taskbarTabDisplay === 'windowName') {
        return winInfo.windowName
      }
    },
    get simulation() {
      const { simulation } = store
      const prefixKey = isMac ? 'Command' : 'Ctrl'
      return {
        ...simulation,
        shortcutKey: `${prefixKey} ${simulation.shortcutKey}`,
      }
    },
    get sessionStorageSync() {
      return {
        enable: winInfo.syncSessionStorage,
        allowDomains: winInfo.sessionStorages,
      }
    },
  }
}
