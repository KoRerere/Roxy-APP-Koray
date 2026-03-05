import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import type { DictKey } from '/@/modules/dict'
import type { AxiosProxyConfig, AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { isEmpty } from 'es-toolkit/compat'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import http from 'node:http'
import pLimit from 'p-limit'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { API } from '/@/api'
import { dictStore, updateDict } from '/@/modules/dict'
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

// curl -x "http://roxy-ip-107.205.24.175:mk7chZxJWB0i@pr.roxybrowser.co:5782"   -X POST "https://ipcheck.roxybrowser.com/api/query"   -H "Content-Type: application/json"   -d '{"channel": "ip-api"}'

// {"code":200,"message":"success","data":{"ip":"107.205.24.175","city":"Villa Rica","region":"Georgia","country":"United States","latitude":33.7295,"longitude":-84.9298,"time_zone":"America/New_York","postal":"30180"}}

// 检测超时时间
const TIMEOUT = 20000
/** 默认检测渠道 */
const CHECK_CHANNEL_DEFAULT = 'ip-api'
/** 查询渠道地址 */
// const CHECK_CHANNEL_URL = 'https://ipcheck.roxybrowser.com/api/query'

const commonAxiosConfig: AxiosRequestConfig = {
  timeout: TIMEOUT,
  adapter: 'http',
  // 让 Node.js 的 HTTP 解析器“别那么严格”，遇到不完全符合 HTTP 规范的响应也尽量别直接报错
  insecureHTTPParser: true,
  // 不复用连接
  keepAlive: false,
  // 限制并发连接数
  maxSockets: 10,
}

function getCheckChannelByUrl(url = store.ipChecker) {
  try {
    return dictStore.checkChannel?.[new URL(url).hostname] || CHECK_CHANNEL_DEFAULT
  }
  catch (error) {
    return CHECK_CHANNEL_DEFAULT
  }
}

/** 获取 ipv6 检测地址 */
async function getIPV6CheckUrl() {
  const { origin, pathname } = new URL(store.ipv6CheckUrl)

  if (isEmpty(dictStore['ip2location-key'])) {
    await updateDict(['ip2location-key'])
  }

  const urls = dictStore['ip2location-key']?.map(key => `${origin}${pathname}?key=${key}`) || []
  console.log('getIPV6CheckUrl urls', urls)

  if (urls.length === 0) {
    console.warn('No IP2Location keys found, falling back to default url')
    return store.ipv6CheckUrl
  }

  const checkUrl = (url: string) => {
    return fetch(url)
      .then(res => res.json())
      .then(res => res.error ? Promise.reject(res.error) : url)
      .catch((err) => {
        console.log('getIPV6CheckUrl checkUrl error', err)
        return Promise.reject(err)
      })
  }
  const finalUrl = await Promise.any(urls.map(checkUrl)).catch((err) => {
    console.error('getIPV6CheckUrl error', err)
    return store.ipv6CheckUrl
  })
  store.lastUseIp2locationUrl = finalUrl
  console.log('getIPV6CheckUrl finalUrl', finalUrl)
  return finalUrl
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
  const needUpdateDict: DictKey[] = []
  if (isEmpty(dictStore.checkChannel)) {
    needUpdateDict.push('checkChannel')
  }

  if (isEmpty(dictStore['ip-check-domains'])) {
    needUpdateDict.push('ip-check-domains')
  }

  if (needUpdateDict.length > 0) {
    await updateDict(needUpdateDict).catch(() => { })
  }

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
      ipType,
      proxyCategory: __protocol,
      host: isUseSystemProxy ? '127.0.0.1' : host,
      port: isUseSystemProxy ? store.roxynetProxyPort : port,
      proxyUserName: isUseSystemProxy ? dirId! : proxyUserName,
      proxyPassword: isUseSystemProxy ? dirId! : proxyPassword,
      checkChannel: getCheckChannelByUrl(checkChannel),
    }

    // console.log('proxyDetectionParams', proxyDetectionParams)
    const checkMode = getCheckFunction(params.proxyCategory as ProtocolMapType)
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

      result.checkChannel = ipType === 'IPV6' ? store.lastUseIp2locationUrl : checkChannel
      result.ip ||= result.query
      result.country_code ||= result.country_short || result.countryCode || result.country
      result.timezone ||= result.time_zone
      result.latitude ||= result.lat
      result.longitude ||= result.lon

      // 如果检测渠道不是 ip-api，则获取时区
      if (ipType === 'IPV6') {
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
  const limit = pLimit(3)
  const { checkChannel = getCheckChannelByUrl() } = winInfo

  const tasks = dictStore['ip-check-domains'].map((checkUrl) => {
    return limit(async () => {
      const response = await axios({
        url: checkUrl,
        method: 'POST',
        data: {
          channel: checkChannel,
        },
        ...commonAxiosConfig,
        maxRedirects: 0,
        proxy: false,
      })

      // 只要有一个成功了，立刻清空剩下的排队任务
      limit.clearQueue()
      // 直接返回数据
      return response.data.data
    })
  })

  // 直接返回 Promise.any 的结果：
  // 若最快的一个成功，直接返回该值。
  // 若全部失败（或 tasks 为空数组），将会自动抛出 AggregateError 从而触发外层的 catch
  return Promise.any(tasks)
}

/**
 * Http 代理
 */
async function checkHttpProxy(
  winInfo: ProxyDetectionParams,
  isUseSystemProxy: boolean,
  tryCount = 0,
) {
  const {
    proxyUserName,
    proxyPassword,
    host,
    port,
    checkChannel,
    proxyCategory,
    ipType,
  } = winInfo
  logProxyConfig(winInfo, `checkHttpProxy`)
  const protocol = isUseSystemProxy
    ? 'http'
    : proxyCategory.toLocaleLowerCase()

  let auth: AxiosProxyConfig['auth']
  const isIPV6 = ipType === 'IPV6'

  let ipv6CheckUrl = store.lastUseIp2locationUrl
  if (isIPV6 && !ipv6CheckUrl) {
    ipv6CheckUrl = await getIPV6CheckUrl()
  }

  if (proxyUserName && proxyPassword) {
    // eslint-disable-next-line unused-imports/no-unused-vars
    auth = {
      username: proxyUserName,
      password: proxyPassword,
    }
  }

  let proxyConfig
  const checkChannelIsHttp = ipv6CheckUrl?.startsWith('http://')

  if (host) {
    const auth = encodeAuth(proxyUserName, proxyPassword)
    const httpUrl = `${protocol}://${auth}${host}:${port}`
    const Agent = checkChannelIsHttp && isIPV6 ? HttpProxyAgent : HttpsProxyAgent
    proxyConfig = {
      [checkChannelIsHttp && isIPV6 ? 'httpAgent' : 'httpsAgent']: new Agent(
        httpUrl,
        {
          ...commonAxiosConfig,
          rejectUnauthorized: false,
        } as any,
      ),
    }
    console.log(`checkHttpProxy proxyConfig`, httpUrl)
  }

  try {
    if (isIPV6) {
      const response = await axios({
        url: ipv6CheckUrl,
        method: 'GET',
        ...commonAxiosConfig,
        maxRedirects: 0,
        proxy: false,
        ...proxyConfig,
      })

      console.log(`HTTP IPV6 detection successful url:${checkChannel}`, response.data)

      return response.data
    }
    else {
      const limit = pLimit(3)

      const tasks = dictStore['ip-check-domains'].map((checkUrl) => {
        return limit(async () => {
          const response = await axios({
            url: checkUrl,
            method: 'POST',
            data: {
              channel: checkChannel,
            },
            ...commonAxiosConfig,
            maxRedirects: 0,
            proxy: false,
            ...proxyConfig,
          })

          console.log(`HTTP detection successful url:${checkChannel}`, response.data)

          // 只要有一个成功了，立刻清空剩下的排队任务
          limit.clearQueue()
          // 直接返回数据
          return response.data.data
        })
      })

      // 直接返回 Promise.any 的结果：
      // 若最快的一个成功，直接返回该值。
      // 若全部失败（或 tasks 为空数组），将会自动抛出 AggregateError 从而触发外层的 catch
      return Promise.any(tasks)
    }
  }
  catch (error: any) {
    console.error(`checkHttpProxy error`, error)
    console.error(`checkSocks5Proxy error.response?.data`, error.response?.data)
    // 现在ipv6的检测用的免费key，一个月只有5w额度，用完就得重新配新key。前端做成自动切吧
    // {"error":{"error_code":10000,"error_message":"Invalid API key or insufficient credit."}}
    if (error.response?.data?.error?.error_code !== undefined) {
      console.log('try getIPV6CheckUrl', tryCount)
      if (tryCount < 1) {
        await getIPV6CheckUrl()
        return checkHttpProxy(winInfo, isUseSystemProxy, tryCount + 1)
      }
      else {
        throw new Error(error.response?.data?.error?.error_message || 'IP2Location API key is invalid or out of credit')
      }
    }
    throw error
  }
}

/**
 * socket5 代理
 */
async function checkSocks5Proxy(params: any, isUseSystemProxy: boolean, tryCount = 0) {
  const { proxyUserName, proxyPassword, host, port, checkChannel, ipType = 'IPV4' } = params
  logProxyConfig(params, `socket5`)

  const isIPV6 = ipType === 'IPV6'

  let ipv6CheckUrl = store.lastUseIp2locationUrl
  if (isIPV6 && !ipv6CheckUrl) {
    ipv6CheckUrl = await getIPV6CheckUrl()
  }

  const checkChannelIsHttp = ipv6CheckUrl?.startsWith('http://')
  const auth = encodeAuth(proxyUserName, proxyPassword)
  const url = `socks5h://${auth}${host}:${port}`
  console.log(`SocksProxyAgent url`, url, checkChannel)

  try {
    if (isIPV6) {
      const response = await axios({
        url: ipv6CheckUrl,
        method: 'GET',
        ...commonAxiosConfig,
        proxy: false,
        [checkChannelIsHttp ? 'httpAgent' : 'httpsAgent']: new SocksProxyAgent(url, commonAxiosConfig),
      })

      return response.data
    }
    else {
      const limit = pLimit(3)

      const tasks = dictStore['ip-check-domains'].map((checkUrl) => {
        return limit(async () => {
          const response = await axios({
            url: checkUrl,
            method: 'POST',
            ...commonAxiosConfig,
            data: {
              channel: checkChannel,
            },
            proxy: false,
            httpsAgent: new SocksProxyAgent(url, commonAxiosConfig),
          })

          console.log(`socket5 detection successful url:${checkChannel}`, response.data)

          // 只要有一个成功了，立刻清空剩下的排队任务
          limit.clearQueue()
          // 直接返回数据
          return response.data.data
        })
      })

      // 直接返回 Promise.any 的结果：
      // 若最快的一个成功，直接返回该值。
      // 若全部失败（或 tasks 为空数组），将会自动抛出 AggregateError 从而触发外层的 catch
      return Promise.any(tasks)
    }
  }
  catch (error: any) {
    console.error(`checkSocks5Proxy error`, error)
    console.error(`checkSocks5Proxy error.response?.data`, error.response?.data)
    // 现在ipv6的检测用的免费key，一个月只有5w额度，用完就得重新配新key。前端做成自动切吧
    // {"error":{"error_code":10000,"error_message":"Invalid API key or insufficient credit."}}
    if (error.response?.data?.error?.error_code !== undefined) {
      console.log('try getIPV6CheckUrl', tryCount)
      if (tryCount < 1) {
        await getIPV6CheckUrl()
        return checkSocks5Proxy(params, tryCount + 1)
      }
      else {
        throw new Error(error.response?.data?.error?.error_message || 'IP2Location API key is invalid or out of credit')
      }
    }
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
