import type { WindowItemType } from '~/browser/browser-item/types'
import type { AxiosProxyConfig, AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(__filename)

type ProxyAgentCtor = new (url: string, options?: object) => unknown

const { HttpsProxyAgent } = nodeRequire('https-proxy-agent') as { HttpsProxyAgent: ProxyAgentCtor }
const { SocksProxyAgent } = nodeRequire('socks-proxy-agent') as { SocksProxyAgent: ProxyAgentCtor }

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

// curl -x "http://roxy-ip-107.205.24.175:mk7chZxJWB0i@pr.roxybrowser.co:5782"   -X POST "https://ipcheck.roxybrowser.com/api/query"   -H "Content-Type: application/json"   -d '{"channel": "ip-api"}'

// {"code":200,"message":"success","data":{"ip":"107.205.24.175","city":"Villa Rica","region":"Georgia","country":"United States","latitude":33.7295,"longitude":-84.9298,"time_zone":"America/New_York","postal":"30180"}}

// 检测超时时间
const TIMEOUT = 20000
/** IPV4 默认检测渠道 */
const CHECK_CHANNEL_DEFAULT_IPV4 = 'ip-api'
/** IPV6 默认检测渠道 */
const CHECK_CHANNEL_DEFAULT_IPV6 = 'ip2location'
/** IPv4 默认检测渠道地址 */
const CHECK_CHANNEL_URL_IPV4 = 'https://ipcheck.roxybrowser.com/api/query'
/** IPv6 默认检测渠道地址 */
const CHECK_CHANNEL_URL_IPV6 = 'https://ipv6-check.roxybrowser.com/api/query'

const commonAxiosConfig: AxiosRequestConfig = {
  timeout: TIMEOUT,
  adapter: 'http',
  // 让 Node.js 的 HTTP 解析器“别那么严格”，遇到不完全符合 HTTP 规范的响应也尽量别直接报错
  insecureHTTPParser: true,
}

function getCheckUrl(ipType: ProxyDetectionParams['ipType'] = 'IPV4') {
  const isIPV6 = ipType === 'IPV6'
  return isIPV6 ? CHECK_CHANNEL_URL_IPV6 : CHECK_CHANNEL_URL_IPV4
}

function getCheckChannelByUrl(ipType: ProxyDetectionParams['ipType'] = 'IPV4') {
  const isIPV6 = ipType === 'IPV6'
  const checkChannelDefault = isIPV6 ? CHECK_CHANNEL_DEFAULT_IPV6 : CHECK_CHANNEL_DEFAULT_IPV4
  const suffix = isIPV6 ? '-ipv6' : ''

  return checkChannelDefault + suffix
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

function normalizeProtocol(protocol?: string): ProtocolMapType {
  switch (protocol?.trim().toUpperCase()) {
    case 'SOCKS5':
    case 'SSH':
    case 'HTTP':
    case 'HTTPS':
      return protocol.trim().toUpperCase() as ProtocolMapType
    default:
      return 'noproxy'
  }
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
      protocol,
      proxyCategory = protocol || 'noproxy',
      ipType,
    } = proxyDetectionParams
    const normalizedProxyCategory = normalizeProtocol(proxyCategory)

    const params: ProxyDetectionParams = {
      ...proxyDetectionParams,
      proxyCategory: normalizedProxyCategory,
      protocol: normalizedProxyCategory,
      checkChannel: proxyDetectionParams.checkChannel || getCheckChannelByUrl(ipType),
    }

    // console.log('proxyDetectionParams', proxyDetectionParams)
    const checkMode = getCheckFunction(normalizedProxyCategory)
    console.log('代理检测参数', params)
    const result = await checkMode(params).catch((error) => {
      Reflect.deleteProperty(error, 'config')
      console.error('代理检测失败', error)
      return Promise.reject($t('代理 IP 检测失败'))
    })

    console.log('代理检测原始结果', result)

    // 下面为什么会有这么多的判断？因为不同的检测渠道返回的数据字段名不一样，所以需要做一些兼容处理
    if (result) {
      if (!result.city || typeof result.city !== 'string')
        result.city = result.city_name
      if (!result.region || typeof result.region !== 'string')
        result.region = result.region_name
      if (!result.country || typeof result.country !== 'string')
        result.country = result.country_name || result.country_long

      result.ip ||= result.query
      result.country_code ||= result.country_short || result.countryCode || result.country
      result.timezone ||= result.time_zone
      result.latitude ||= result.lat
      result.longitude ||= result.lon
    }

    console.log('代理检测最终结果', result)

    return result || {}
  }

  // 处理多协议的情况，比如 socks5/http 或者 http/https 这样支持多协议的代理
  const { protocol, proxyCategory = protocol || 'noproxy', port } = proxyDetectionParams
  const protocols = (proxyCategory?.split('/') || ['noproxy']).map(item => normalizeProtocol(item))
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
      return {
        ...res,
        protocol: protocol === 'noproxy' ? undefined : protocol,
        port,
      }
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
      检测渠道:${checkChannel}\n
      代理用户名:${proxyUserName}\n
      代理密码:${proxyPassword}\n
      主机:${host}\n
      端口:${port}\n
      代理网络:${proxyNetwork}`)
}

/**
 * 无代理
 */
async function noProxy(winInfo: ProxyDetectionParams) {
  const { checkChannel = getCheckChannelByUrl(winInfo.ipType), ipType } = winInfo

  const response = await axios({
    url: getCheckUrl(ipType),
    method: 'POST',
    data: {
      channel: checkChannel,
    },
    ...commonAxiosConfig,
    maxRedirects: 0,
    proxy: false,
  })
  // 直接返回数据
  return response.data.data
}

/**
 * Http 代理
 */
async function checkHttpProxy(
  winInfo: ProxyDetectionParams,
) {
  const {
    proxyUserName,
    proxyPassword,
    host,
    port,
    checkChannel,
    ipType,
  } = winInfo
  logProxyConfig(winInfo, 'HTTP 代理检测配置')

  let auth: AxiosProxyConfig['auth']

  if (proxyUserName && proxyPassword) {
    // eslint-disable-next-line unused-imports/no-unused-vars
    auth = {
      username: proxyUserName,
      password: proxyPassword,
    }
  }

  let proxyConfig

  if (host) {
    const auth = encodeAuth(proxyUserName, proxyPassword)
    const httpUrl = `http://${auth}${host}:${port}`
    proxyConfig = {
      httpsAgent: new HttpsProxyAgent(
        httpUrl,
        {
          ...commonAxiosConfig,
          rejectUnauthorized: false,
        } as any,
      ),
    }
    console.log('HTTP 代理配置', httpUrl)
  }

  try {
    const response = await axios({
      url: getCheckUrl(ipType),
      method: 'POST',
      data: {
        channel: checkChannel,
      },
      ...commonAxiosConfig,
      maxRedirects: 0,
      proxy: false,
      ...proxyConfig,
    })

    console.log(`HTTP 代理检测成功，渠道:${checkChannel}`, response.data)
    // 直接返回数据
    return response.data.data
  }
  catch (error: any) {
    console.error('HTTP 代理检测失败', error, error.response?.data)
    throw error
  }
}

/**
 * socket5 代理
 */
async function checkSocks5Proxy(params: any) {
  const { proxyUserName, proxyPassword, host, port, checkChannel, ipType = 'IPV4' } = params
  logProxyConfig(params, 'SOCKS5 代理检测配置')

  const auth = encodeAuth(proxyUserName, proxyPassword)
  const url = `socks5h://${auth}${host}:${port}`
  console.log('SOCKS5 代理地址', url, checkChannel)

  try {
    const response = await axios({
      url: getCheckUrl(ipType),
      method: 'POST',
      ...commonAxiosConfig,
      data: {
        channel: checkChannel,
      },
      proxy: false,
      httpsAgent: new SocksProxyAgent(url, commonAxiosConfig),
    })

    console.log(`SOCKS5 代理检测成功，渠道:${checkChannel}`, response.data)
    // 直接返回数据
    return response.data.data
  }
  catch (error: any) {
    console.error('SOCKS5 代理检测失败', error)
    console.error('SOCKS5 代理检测失败响应数据', error.response?.data)
    throw error
  }
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
