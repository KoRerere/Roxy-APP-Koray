import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import type { AxiosProxyConfig } from 'axios'
import axios from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import http from 'node:http'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { API } from '/@/api'
import {
  delRoxynetProxy,
  getRoxynetProcess,
  setRoxynetProxy,
  startRoxynet,
} from '/@/modules/roxynet'
import { store } from '/@/modules/store'
import { safeGetURL } from '/@/utils/common'
import { getSystemProxy } from '/@/utils/getSystemProxy'

export interface ProxyDetectionResult {
  ip: string
  organization: string
  asn: number
  country: string
  country_code: string
  city: string
  continent: string
  continent_code: string
  latitude: number
  longitude: number
  timezone: string
  region: string
  protocol?: string
  port?: string
  checkChannel?: string
}

// 检测超时时间
const TIMEOUT = 20000

const commonAxiosConfig = {
  timeout: TIMEOUT,
  adapter: 'http',
}

function getDefaultCheckChannel() {
  return store.ipChecker || 'http://iprust.io/ip.json'
}

const protocolCheckMap = {
  SOCKS5: checkSocks5Proxy,
  SSH: checkSocks5Proxy,
  HTTP: checkHttpProxy,
  HTTPS: checkHttpProxy,
  noproxy: noProxy,
} as const

type ProtocolMapType = keyof typeof protocolCheckMap
export type ProxyDetectionParams = Pick<
  WindowItemType,
  | 'dirId'
  | 'checkChannel'
  | 'ipType'
  | 'protocol'
  | 'proxyCategory'
  | 'proxyUserName'
  | 'proxyPassword'
  | 'host'
  | 'port'
  | 'proxyNetwork'
> & {
  /** 是否优先使用外部的参数 */
  outerParamFirst: boolean
  /** 是否走龙哥 roxynet */
  systemProxySwitch: boolean
}

/** 根据协议获取检测方法 */
function getCheckFunction(protocol: ProtocolMapType) {
  return protocolCheckMap[protocol] || noProxy
}

/** 获取检测渠道 url */
function getCheckUrl(url = getDefaultCheckChannel(), ipType: string) {
  // console.log(`transIpUrl`, url, ipType)
  if (ipType === `IPV6`) {
    return store.ipv6CheckUrl
  }
  return url
}

/** 代理 => 刷新 URL */
export function tryRefreshUrl(refreshUrl: string) {
  return axios
    .get(refreshUrl)
    .then((response) => {
      return response.statusText === 'OK'
    })
    .catch(() => {
      return false
    })
}

/** 代理检测 */
export async function proxyDetection(proxyDetectionParams: ProxyDetectionParams): Promise<ProxyDetectionResult> {
  async function __proxyDetection(proxyDetectionParams: ProxyDetectionParams): Promise<ProxyDetectionResult> {
    const {
      dirId,
      outerParamFirst,
      protocol,
      proxyCategory = protocol || 'noproxy',
      ipType,
      host,
      port,
      proxyUserName,
      proxyPassword,
    } = proxyDetectionParams
    const systemProxySwitch = Reflect.has(
      proxyDetectionParams,
      'systemProxySwitch',
    )
      ? proxyDetectionParams.systemProxySwitch
      : store.systemProxySwitch

    if (systemProxySwitch && !dirId) {
      throw new Error(`dirId is required when systemProxySwitch is true`)
    }
    console.log('systemProxySwitch', store.systemProxySwitch)
    console.log(`dirId && proxyUserName`, dirId, proxyUserName)
    const { addr: systemProxyAddress } = await getSystemProxy()
    await startRoxynet().catch(() => { })

    const isUseSystemProxy
      = proxyCategory === 'SSH'
        || (getRoxynetProcess() && systemProxySwitch && systemProxyAddress)

    if (isUseSystemProxy) {
      const protocal = proxyCategory.toLocaleLowerCase()
      const addr = host && port ? `${host}:${port}` : ''
      const roxynetParams = {
        addr: protocal === 'noproxy' ? '' : addr,
        user_name: proxyUserName || '',
        password: proxyPassword || '',
        protocal,
      }
      console.log('roxynetParams', roxynetParams)

      if (dirId) {
        await setRoxynetProxy({
          [dirId]: roxynetParams,
        })
      }
      console.log('This proxy detection goes through roxynet')
    }
    else {
      console.log('This proxy detection does not go through roxynet')
    }
    // 是否为直连
    const isNoProxy = proxyCategory.toLocaleLowerCase() === 'noproxy'
    let __protocol = proxyCategory
    if (outerParamFirst) {
      __protocol = proxyCategory
    }
    else if (isUseSystemProxy) {
      if (proxyCategory !== 'SOCKS5') {
        __protocol = proxyCategory === 'SSH' ? 'SOCKS5' : 'HTTP'
      }
    }
    else if (isNoProxy && systemProxyAddress) {
      __protocol = 'HTTP'
    }

    const checkChannel = isNoProxy
      ? store.ipChecker
      : proxyDetectionParams.checkChannel
    const params: ProxyDetectionParams = {
      proxyCategory: __protocol,
      host: isUseSystemProxy ? '127.0.0.1' : host,
      port: isUseSystemProxy ? store.roxynetProxyPort : port,
      proxyUserName: isUseSystemProxy ? dirId! : proxyUserName,
      proxyPassword: isUseSystemProxy ? dirId! : proxyPassword,
      checkChannel: getCheckUrl(checkChannel, ipType) || getDefaultCheckChannel(),
    }

    // console.log('proxyDetectionParams', proxyDetectionParams)
    const checkMode = getCheckFunction(params.proxyCategory)
    console.log('proxyDetection params', params)
    const result = await checkMode(params, !!isUseSystemProxy).catch((error) => {
      Reflect.deleteProperty(error, 'config')
      console.error('proxyDetection error', error)
      return Promise.reject($t('代理 IP 检测失败'))
    })

    console.log('proxyDetection original result', result)

    // 下面为什么会有这么多的判断？因为不同的检测渠道返回的数据字段名不一样，所以需要做一些兼容处理
    if (result) {
      if (!result.city || typeof result.city !== 'string')
        result.city = result.city_name
      if (!result.region || typeof result.region !== 'string')
        result.region = result.region_name
      if (!result.country || typeof result.country !== 'string')
        result.country = result.country_name || result.country_long

      const [latitude, longitude] = result.loc?.split(',').map(item => Number(item)) || []

      result.checkChannel = params.checkChannel
      result.ip ||= result.query
      result.country_code ||= result.country_short || result.countryCode || result.country
      result.timezone ||= result.time_zone
      result.latitude ||= result.lat || latitude
      result.longitude ||= result.lon || longitude

      // 如果检测渠道不是 ip-api，则获取时区
      if (!safeGetURL(result.checkChannel)?.host.toLocaleLowerCase().includes('ip-api')) {
        const { code, data } = await API.proxy
          .userGetTimezoneByIpList({ ip: result.ip })
          .catch((error) => {
            console.log(`Failed to get timezone === user_get_timezone_by_ip`, error)
            return { code: 1, data: { timezone: '' } }
          })
        if (code === 0) {
          result.timezone = data.timezone
        }
      }
    }

    console.log('proxyDetection final result', result)

    return result || {}
  }

  // 处理多协议的情况，比如 socks5/http 或者 http/https 这样支持多协议的代理
  const { protocol, proxyCategory = protocol || 'noproxy', port } = proxyDetectionParams
  const protocols = proxyCategory?.split('/').map(item => item.toUpperCase()) || []
  const ports = port?.toString().split('/') || []
  const errors: any[] = []

  for (let index = 0; index < protocols.length; index++) {
    const protocol = protocols[index]
    const port = ports[index] || ports[0]
    const res = await __proxyDetection({
      ...proxyDetectionParams,
      proxyCategory: protocol,
      protocol,
      port,
    }).catch((error) => {
      errors.push(error)
    })
    if (res?.ip) {
      return { ...res, protocol, port }
    }
  }

  if (errors.length === protocols.length) {
    return Promise.reject(errors[0])
  }

  return {} as ProxyDetectionResult
}

function logProxyConfig(params: ProxyDetectionParams, name = ``) {
  // return
  const {
    checkChannel,
    host,
    port,
    proxyUserName,
    proxyPassword,
    proxyNetwork,
  } = params
  console.log(`${name}\n
        checkChannel:${checkChannel}\n
        proxyUserName:${proxyUserName}\n
        proxyPassword:${proxyPassword}\n
        host:${host}\n
        port:${port}\n
        proxyNetwork:${proxyNetwork}`)
}

/**
 * 无代理
 */
async function noProxy(winInfo: ProxyDetectionParams) {
  const { checkChannel = getDefaultCheckChannel() } = winInfo
  const response = await axios.get(checkChannel, commonAxiosConfig)
  response.data.country
    ||= response.data.country_name || response.data.country_long
  response.data.country_code ||= response.data.country_short

  return response.data
}

/**
 * Http 代理
 */
async function checkHttpProxy(
  winInfo: ProxyDetectionParams,
  isUseSystemProxy: boolean,
) {
  const {
    proxyUserName,
    proxyPassword,
    host,
    port,
    checkChannel,
    proxyCategory,
  } = winInfo
  logProxyConfig(winInfo, `checkHttpProxy`)
  const protocol = isUseSystemProxy
    ? 'http'
    : proxyCategory.toLocaleLowerCase()

  const checkChannelIsHttp = checkChannel.startsWith('http://')

  let auth: AxiosProxyConfig['auth']

  if (proxyUserName && proxyPassword) {
    auth = {
      username: proxyUserName,
      password: proxyPassword,
    }
  }

  let proxyConfig

  if (host) {
    const auth = encodeAuth(proxyUserName, proxyPassword)
    const httpUrl = `${protocol}://${auth}${host}:${port}`
    const Agent = checkChannelIsHttp ? HttpProxyAgent : HttpsProxyAgent
    proxyConfig = {
      [checkChannelIsHttp ? 'httpAgent' : 'httpsAgent']: new Agent(
        httpUrl,
        {
          ...commonAxiosConfig,
          rejectUnauthorized: false,
        },
      ),
    }
    console.log(`checkHttpProxy proxyConfig`, httpUrl)
  }

  const response = await axios({
    url: checkChannel,
    ...commonAxiosConfig,
    maxRedirects: 0,
    proxy: false,
    ...proxyConfig,
  })

  console.log(`HTTP detection successful url:${checkChannel}`, response.data)

  return response.data
}

/**
 * socket5 代理
 */
async function checkSocks5Proxy(parmes: any) {
  const { proxyUserName, proxyPassword, host, port, checkChannel } = parmes
  logProxyConfig(parmes, `socket5`)

  const auth = encodeAuth(proxyUserName, proxyPassword)
  const url = `socks5h://${auth}${host}:${port}`
  console.log(`SocksProxyAgent url`, url)
  const agent = new SocksProxyAgent(url, commonAxiosConfig)

  const response = await axios.get(checkChannel, {
    // headers: {
    //   Host: new URL(checkChannel).host
    // },
    ...commonAxiosConfig,
    proxy: false,
    [checkChannel.startsWith('https') ? 'httpsAgent' : 'httpAgent']: agent,
  })

  return response.data
}

function encodeAuth(proxyUserName: string, proxyPassword: string) {
  if (proxyUserName && proxyPassword) {
    // 正确编码用户名和密码中的特殊字符
    const encodedUserName = encodeURIComponent(proxyUserName)
    const encodedPassword = encodeURIComponent(proxyPassword)
    return `${encodedUserName}:${encodedPassword}@`
  }
  return ``
}

export async function detectNetwork(type?: 'local' | 'system') {
  type ||= store.systemProxySwitch ? 'system' : 'local'
  if (type === 'system') {
    const systemProxy = await getSystemProxy()
    console.log('detectNetwork systemProxy', systemProxy)
    const [host, port] = systemProxy.addr.split(':')
    return proxyDetection({
      host,
      port,
      proxyCategory: systemProxy.protocol.toUpperCase(),
      systemProxySwitch: false,
    })
  }
  else {
    return proxyDetection({
      systemProxySwitch: false,
      outerParamFirst: true,
      proxyCategory: 'noproxy',
    })
  }
}
