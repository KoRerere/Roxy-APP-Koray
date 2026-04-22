import type { UnwrapRowType, UserGetUserConfigListData, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { currentOS, isMac, WHITE_LIST_FILE } from '~/constants/common'
import language from '~/constants/language.json'

/** 列表 typings 未覆盖但运行时可能存在的指纹字段 */
interface FingerprintWinInfoExtra {
  searchEngine?: string
  canvasValueV2?: string
  allowFontList?: string
  architecture?: string
  model?: string
  devicePixelRatio?: number
  proxyByPassList?: string[]
  allowDomainList?: string
  blockDomainList?: string
  enableGoogleLogin?: number
  syncSessionStorage?: boolean
  sessionStorages?: unknown
  networkType?: string
}

const DOMAIN_STRIP_HTTPS_PREFIX = /^https?:\/\//
const SLOW_2G_LABEL = /slow-2G/i

function getCityCode(key: string) {
  return language.find(item => item.key === key)?.code
}

/** 转换数字, 如果转换后为 NaN, 则返回 null */
function toNumber(num: string | number | undefined | null) {
  if (num === undefined || num === null)
    return null
  const number = Number(num)
  return Number.isNaN(number) ? null : number
}

const key = '402ead7d23b43b6d1e0528d4f99c59bd'
const nonce = '3a105229aa31'

export function encryptFingerprintConfig(data: string) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const encryptedValue = Buffer.concat([
    cipher.update(data),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return encryptedValue.toString('base64')
}

interface GenFingerprintConfigParams {
  winInfo: UnwrapRowType<UserGetWindowInfoV2ListData> & FingerprintWinInfoExtra
  proxyInfo: Record<string, any>
  globalConfig: UserGetUserConfigListData['data'] & {
    simulation?: Record<string, unknown> & { shortcutKey?: string }
  }
}

/** 生成浏览器指纹配置 */
export async function genFingerprintConfig({ winInfo, proxyInfo, globalConfig }: GenFingerprintConfigParams) {
  const isMobile = [`Android`, `IOS`].includes(winInfo.os!)
  const isMacOS = winInfo.os === `macOS`

  const defaultWhiteList = await readFile(WHITE_LIST_FILE, 'utf-8').then(content => JSON.parse(content) as string[]).catch(() => [])

  return {
    computerName: winInfo.computerName,
    macAddress: winInfo.macAddress,
    searchEngine: {
      name: winInfo.searchEngine,
    },
    /** 窗口名称 */
    get windowName() {
      if (winInfo.isDisplayName) {
        return winInfo.windowName
      }
    },
    /** 浏览器界面语言，不填则跟随系统, 如果要填，客户端根据IP自动生成或者用户选择一个 */
    get appLocale() {
      if (winInfo.isLanguageBaseIp) {
        return getCityCode(proxyInfo.country_code)
      }
      return winInfo.language
    },
    /** 浏览器所在语言，不填则跟随系统，如果要填，客户端根据IP自动生成或者用户选择一个 */
    get acceptLang() {
      if (winInfo.isDisplayLanguageBaseIp) {
        return getCityCode(
          proxyInfo.country_code,
        )
      }
      else {
        return winInfo.displayLanguage
      }
    },
    /** 浏览器所在时区，不填则跟随系统，如果要填，客户端根据IP自动生成或者用户选择一个 */
    get timeZone() {
      if (winInfo.isTimeZone && proxyInfo.timezone) {
        // $LOG(`时区 if`, proxyInfo.timezone)
        return proxyInfo.timezone
      }
      else {
        // $LOG(`时区 else`, data.timeZone)
        if (winInfo.timeZone) {
          return winInfo.timeZone.split(' ').at(-1)
        }
      }
    },
    /** 浏览器完整的版本 */
    chromeVersion: winInfo.userAgentVersion,
    /** 浏览器类型， Google Chrome  或者 Edge */
    chromeType: 'Google Chrome',
    userAgent: winInfo.userAgentNew,
    /** AudioContext 指纹配置 */
    audioBuffer: {
      /** 版本固定是2 */
      version: '2',
      /** 启用，或禁用 */
      enableAudioBufferNoise: winInfo.audioContext,
      /** 随机值，浮点数 */
      audioBufferNoiseValue: Number(winInfo.audioContextValue),
      /** 固定是100 */
      audioBufferNoiseInterval: 100,
    },
    /** 给不同的环境生成不同的Canvas */
    canvasContext: {
      /** 是否开启 */
      enableCanvasContextNoise: winInfo.canvas,
      /** 16位 0-9,a-z字符串组合，前两位是数字如：54RGV5FTO1Q7C5NK  */
      canvasContextNoiseValue: winInfo.canvasValue,
      canvasContextNoiseValueV2: Number(winInfo.canvasValueV2 ?? winInfo.canvasValue),
    },
    /** 给不同的环境生成不同的ClientRects */
    clientRects: {
      /** 是否开启 */
      enable: winInfo.clientRects,
      clientRectsNoiseFactorX: winInfo.clientRectsValue?.clientRectsNoiseFactorX ?? 0,
      clientRectsNoiseFactorY: winInfo.clientRectsValue?.clientRectsNoiseFactorY ?? 0,
    },
    /** WebGL 显卡数据，从列表中随机 */
    WebGL: {
      webglRenderer: winInfo.webGLInfo ? winInfo.webGLRender : '',
      webglVendor: winInfo.webGLInfo ? winInfo.webGLManufacturer : '',
      /** webGL图像是否开启 */
      enableWebGLRendererNoise: winInfo.webGL,
      /** 固定为1 */
      webGLRendererNoiseInterval: 1,
      /** 16位 0-9,a-z字符串组合，前两位是数字如：54RGV5FTO1Q7C5NK  */
      webGLRendererNoiseValue: winInfo.webGLValue,
    },
    // webgpu
    WebGPU: {
      /** webgl基于webgl匹配、real 真实、block 禁止 */
      mode: winInfo.webGpu,
      vendor: winInfo.webGpuVendor,
    },
    /** 禁用的字体列表 */
    get disableFontListV2() {
      if (winInfo.fontType) {
        return winInfo.font
      }
    },
    /** 字体选择随机的时候，就从 font.json 文件里面随机选择100-500个，传给allowFontList ，用; 分割 */
    get allowFontList() {
      if (winInfo.fontType) {
        return winInfo.allowFontList
      }
    },
    /** 当前浏览器是否不被站点追踪个人信息 */
    doNotTrack: winInfo.doNotTrack,

    /** 地理位置信息， */
    get geoLocation() {
      const { position, isPositionBaseIp = false } = winInfo
      const positionMode = position === undefined
        ? undefined
        : ({
            0: `prompt`,
            1: `allow`,
            2: `block`,
          } as const)[position as 0 | 1 | 2]

      const proxy_data = proxyInfo
      type GeoKey = 'latitude' | 'longitude' | 'precisionPos'
      function transisPositionBaseIp(key: GeoKey) {
        if (positionMode === `block`) {
          return null
        }
        const source = (isPositionBaseIp ? proxy_data : winInfo) as Record<string, string | number | undefined>
        return toNumber(source[key])
      }

      return {
        /** prompt 提示、allow 允许、block 禁止 */
        mode: positionMode || '',
        /** 是否允许fake位置信息 */
        enableFakeLocationData: true,
        locationLatitude: transisPositionBaseIp(`latitude`),
        locationLongitude: transisPositionBaseIp(`longitude`),
        locationAccuracy: transisPositionBaseIp(`precisionPos`),
        locationAltitude: null,
      }
    },
    /** 禁止打开图片,true 禁止，false 放开 */
    blockImages: !winInfo.forbidImage,
    /** 忽略https证书错误 */
    ignoreCertificateErrors: winInfo.ignoreHttpsError,
    /** 禁止自动播放视频 */
    disablePlayVideo: !winInfo.forbidMedia,
    /** 禁止播放网站声音 */
    disablePlaySound: !winInfo.forbidAudio,
    /** 禁止弹出google翻译 */
    // disableGoogleTranslate: true,
    /** 禁止保存密码弹窗 */
    disablePasswordSaveTips: !winInfo.forbidSavePassword,

    /** 媒体网络,给不同的环境生成不同的媒体设备ID  */
    // mediaDeviceList: [
    //   {
    //     /** audioinput ,audiooutput,videoinput,videooutput  4个类型选一个 */
    //     deviceType: 'audioinput',
    //     /** 可以为空 */
    //     deviceId: 'aaa',
    //     /** 可以为空 */
    //     label: '',
    //     /** 可以为空 */
    //     groupId: 'bbb',
    //   },
    // ],
    navigator: {
      /** 平台名称 */
      platform: winInfo.navigatorPlatform,
      /** 当前环境的CPU核心数 */
      hardwareConcurrency: toNumber(winInfo.hardwareConcurrent),
      /** 触控点数量, 手机端使用 */
      maxTouchPoints: isMobile ? 5 : 0,
      /** 当前环境的机器内存 */
      deviceMemory: toNumber(winInfo.deviceMemory),
      /**
       * 默认不填就是系统自带的，填入就是新增的
       * Chrome PDF Viewer 是自带标准的参数，也是默认自带的。
       *  test 是示例
       */
      get plugins() {
        if (winInfo.enablePlugin) {
          return [
            {
              name: 'PDF Viewer',
              path: 'internal-pdf-viewer',
              desc: 'Portable Document Format|Portable Document Format',
              version: '',
              mime: [
                {
                  mime_type: 'application/pdf',
                  file_extensions: 'pdf',
                },
                {
                  mime_type: 'text/pdf',
                  file_extensions: 'pdf',
                },
              ],
            },
            {
              name: 'Chrome PDF Viewer',
              path: 'internal-pdf-viewer',
              desc: 'Portable Document Format|Portable Document Format',
              version: '',
              mime: [
                {
                  mime_type: 'application/pdf',
                  file_extensions: 'pdf',
                },
                {
                  mime_type: 'text/pdf',
                  file_extensions: 'pdf',
                },
              ],
            },
            {
              name: 'Chromium PDF Viewer',
              path: 'internal-pdf-viewer',
              desc: 'Portable Document Format|Portable Document Format',
              version: '',
              mime: [
                {
                  mime_type: 'application/pdf',
                  file_extensions: 'pdf',
                },
                {
                  mime_type: 'text/pdf',
                  file_extensions: 'pdf',
                },
              ],
            },
            {
              name: 'Microsoft Edge PDF Viewer',
              path: 'internal-pdf-viewer',
              desc: 'Portable Document Format|Portable Document Format',
              version: '',
              mime: [
                {
                  mime_type: 'application/pdf',
                  file_extensions: 'pdf',
                },
                {
                  mime_type: 'text/pdf',
                  file_extensions: 'pdf',
                },
              ],
            },
            {
              name: 'WebKit built-in PDF',
              path: 'internal-pdf-viewer',
              desc: 'Portable Document Format|Portable Document Format',
              version: '',
              mime: [
                {
                  mime_type: 'application/pdf',
                  file_extensions: 'pdf',
                },
                {
                  mime_type: 'text/pdf',
                  file_extensions: 'pdf',
                },
              ],
            },
          ]
        }
        return []
      },
    },

    /** client hits 区域的属性-模拟手机模式时使用 */
    userAgentMetadata: {
      /** 平台名称 */
      platform: winInfo.platform,
      mobile: isMobile,
      /**  操作系统版本,可以不填 */
      platformVersion: winInfo.platformVersion,
      get architecture() {
        if (isMacOS) {
          return winInfo.architecture
        }
      },
      get model() {
        return winInfo.os === 'Android' ? winInfo.model : undefined
      },
      /** 芯片架构, 可以不填 */
      // architecture: 'arm',
      /** 系统位数，可以填 */
      // bitness: '64',
    },

    /** 端口扫描保护.启用后，将会阻止网站检测您使用了本地网络的哪些端口,示例：4000;4001 */
    portScan: {
      enablePortScanWhiteList: winInfo.portScanProtect,
      portScanWhiteList: winInfo.portScanList?.replaceAll(',', ';') ?? '',
    },
    /** 选填 屏幕分辨率 */
    get screen() {
      const resY = Number(winInfo.resolutionY ?? 0)
      const availHeight = toNumber(resY - (isMobile ? 0 : 38)) || 0
      return {
        pixelDepth: 24,
        colorDepth: 24,
        width: toNumber(winInfo.resolutionX ?? 0) || 0,
        height: toNumber(winInfo.resolutionY ?? 0) || 0,
        availWidth: toNumber(winInfo.resolutionX ?? 0) || 0,
        availHeight: availHeight < 0 ? 0 : availHeight,
        /** 设备像素比 */
        get devicePixelRatio() {
          // 如果操作系统不一致，则返回设备像素比，否则默认采用用户系统自带的设备像素比
          if (winInfo.os && currentOS !== winInfo.os.toLowerCase()) {
            return winInfo.devicePixelRatio
          }
        },
      }
    },

    /**
     * 生成不同的系统中可用的语音列表,语言列表有很多。以下是随机举例，
     * 按照参考list 一般是18-20个。
     * 其中isLocalService代表是否是local，如果不是就自动设成了 remote 属性 ，
     * 一般isLocalService 会有3个true
     */
    speechSynthesis: {
      ...winInfo.speechVoicesValue,
      enable: winInfo.speechVoices,
    },
    /**
     * 开启WebRTC,将公网网络替换为代理网络，并隐藏真实网络
     *
     * altered ,real, disableOk  分别代表:开启,使用本机，关闭三种模式
     */
    get webRtcMode() {
      const rtc = winInfo.webRTC
      return rtc === undefined
        ? undefined
        : ({
            0: 'altered',
            1: 'real',
            2: 'disableOk',
          } as const)[rtc as 0 | 1 | 2]
    },
    /** 例如：192.168.1.12 */
    // webRtcLocalIp: null,
    /** 出口ip 例如：78.253.25.116 从getinfo中获取 */
    get webRtcRemoteIp() {
      // webRTCValue 为 altered（替换）用代理ip赋值
      if (proxyInfo.ip && this.webRtcMode === `altered`) {
        return proxyInfo.ip
      }
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

    get fproxy() {
      // proxyMethod noproxy 直连  platform 购买的ip import 自定义
      // if (winInfo.proxyMethod !== `noproxy`) {
      // {label: "SOCKS5", value: "SOCKS5"}{label: "HTTP", value: "HTTP"}{label: "HTTPS", value: "HTTPS"}
      const { host, port, proxyUserName, proxyPassword, protocol } = winInfo
      // 是否为直连
      const isNoProxy = protocol?.toLocaleLowerCase() === 'noproxy'

      if (isNoProxy) {
        return
      }

      const proxyByPassList = winInfo.proxyByPassList?.length ? winInfo.proxyByPassList : globalConfig.ipBlackList

      return {
        // 代理类型 http https,socks5
        // 需要特殊处理的：当用户配置的代理为HTTPS时，传给浏览器的代理类型改成HTTP，传给roxynet的代理保持为HTTPS
        type: protocol?.toLocaleLowerCase() ?? 'http',
        // 代理主机
        host,
        // 代理端口
        port: Number(port),
        // 用户名 ，选填
        username: proxyUserName,
        // 密码，选填
        password: proxyPassword,
        // 不走代理的地址 - google会导致代理被墙，开发环境默认加上
        proxyByPassList: proxyByPassList?.join?.(';'),
      }
      // $LOG(`newData.fproxy.ipBlackList`, $config.userConfig?.ipBlackList?.join?.(';'))
      // }
    },
    autofillWebSite: {
      /** 自动填写账号密码的网站 */
      url: winInfo.platformUrl,
      username: winInfo.platformUserName,
      password: winInfo.platformPassword,
    },
    autofillWebSiteMult: winInfo.windowPlatformList?.map(item => ({
      url: item.platformUrl,
      username: item.platformUserName,
      password: item.platformPassword,
    })),
    /** 在任务栏ICON上绘制小圆点 */
    taskBarIcon: {
      /** 圆点的颜色 */
      color: 'FF6000d7',
      /** 圆点里面的内容，这个内容同时也会显示到左边工具栏 */
      get text() {
        const { windowSortNum } = winInfo
        return `${windowSortNum}`
      },
    },
    /** 仅允许访问特定的域名 */
    get allowDomainList() {
      const allowDomainList = winInfo.allowDomainList?.split?.('\n') ?? []

      const domainList = allowDomainList.concat(defaultWhiteList).map((item: string) => {
        const trimmed = item.trim()
        return trimmed.replace(DOMAIN_STRIP_HTTPS_PREFIX, '')
      })?.filter(Boolean)

      return domainList?.length ? domainList : undefined
    },
    get blockDomainList() {
      const domainList = winInfo.blockDomainList?.split?.('\n')?.map((item: string) => {
        const trimmed = item.trim()
        return trimmed.replace(DOMAIN_STRIP_HTTPS_PREFIX, '')
      })?.filter(Boolean)

      return domainList?.length ? domainList : globalConfig.blockDomainList?.filter?.(Boolean)
    },
    /** 禁止域名的提示页面 */
    blockDomainPageFile: join('/var/www/html-template', 'blockDomain.html'),
    /** 禁止加载图片的大小，单位:KB, 0 表示为禁止加载所有图片，如果要禁止，建议设置为10 */
    get imageSizeLimit() {
      if (!winInfo.forbidImage) {
        return Number(winInfo.forbiddenPictureSize)
      }
    },
    get simulation() {
      const simulation = globalConfig.simulation ?? { shortcutKey: '' }
      const prefixKey = isMac ? 'Command' : 'Ctrl'
      return {
        ...simulation,
        shortcutKey: `${prefixKey} ${simulation.shortcutKey ?? ''}`,
      }
    },
    googleApi: {
      apiKey: 'AIzaSyBvBVNwfpQjdQIiLQJYaiBg3P-DoAUPGmQ',
      clientId: '77185425430.apps.googleusercontent.com',
      clientSecret: 'OTJgUOQcT7lO7GsGZq2G4IlT',
      enable: Boolean(winInfo.enableGoogleLogin === 2 ? globalConfig.googleLoginEnable : winInfo.enableGoogleLogin),
    },
    SessionStorageSyncConfig: {
      enable: winInfo.syncSessionStorage,
      list: winInfo.sessionStorages,
    },
    battery: {
      enable: winInfo.openBattery ?? false,
      charging: winInfo.openCharging ?? false,
      chargingTime: winInfo.chargingTime ?? '', // (单位：秒，参数不传时间单位)
      dischargingTime: winInfo.dischargingTime ?? '', // (单位：秒，参数不传时间单位)
      level: winInfo.level ?? '', // (0-1)
    },
    network: {
      enable: winInfo.openNetwork ?? false,
      nettype: winInfo.networkType === 'cellular' ? winInfo.networkSpeed?.replace(SLOW_2G_LABEL, '2G') : winInfo.networkType, // wifi，cellular，ethernet，bluetooth，wimax，other，unknown
      effectiveType: winInfo.networkSpeed, // slow-2G/2G/3G/4G
      downlink: winInfo.downloadSpeed ?? '', // 单位Mbps
      downlinkMax: winInfo.maxDownloadSpeed ?? '', // 单位Mbps
      rtt: winInfo.latency ?? '', // 单位毫秒ms
      saveData: winInfo.saveFlowMode ?? false,
    },
    bluetooth: {
      enable: winInfo.openBluetooth ?? false,
      bluetoothAdapter: winInfo.bluetoothAdapter ?? false,
    },
  }
}
