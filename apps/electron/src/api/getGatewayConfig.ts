import axios from 'axios'
import type { ProxyDetectionResult } from '/@/utils'
import { isDev, isPackaged } from '/@/constants/common'
import { ipcSender } from '/@/modules/ipc/sender'

interface GateConf {
  test: string
  prod: string
  prod_api: string
  prod_apps: {
    hz: string[]
    hk: string[]
    sg: string[]
    us: string[]
  }
  prod_apis: {
    hz: string[]
    hk: string[]
    sg: string[]
    us: string[]
  }
}

const gateConfUrls = ['https://gw.roxyip.com/get_gate_conf', 'https://gw.roxyip.io/get_gate_conf']

let openAPIUrl = ''
let baseUrl = ''
/**
 *用户真实ip, 变动后重新获取网关配置
 */
let userIp = ''

/** 通过 API 调用的接口采用此域名 */
export function getOpenAPIUrl(): string {
  return openAPIUrl
}

/** 通过 API 调用的接口采用此域名 */
export function getBaseUrl(): string {
  return baseUrl
}

// CN(中国) --> hz
// NA，SA，EU(欧洲，北美洲，南美洲) --> us
// 其他州 --> sg

const US_CONTINENT_CODES = ['NA', 'SA', 'EU']
/** 备用的 IP 查询渠道 */
const IP_QUERY_URLS = [
  'https://ip234.in/ip.json',
  'https://pro.ip-api.com/json?fields=3207167&key=c1ulk9X5j8NKqTV',
  'https://api.ipinfo.io/lite/me?token=bf04980da05946',
  'http://myip.ip123.us/ip.json',
  'http://www.travel-eye.org/ip.json',
]

async function getMapKey() {
  const controllers: AbortController[] = []
  const timeouts: NodeJS.Timeout[] = []

  const requests = IP_QUERY_URLS.map((url) => {
    const controller = new AbortController()
    controllers.push(controller)

    // 单个源 10 秒超时，兼顾首启慢 DNS 的情况
    const timeout = setTimeout(() => controller.abort(), 10000)
    timeouts.push(timeout)

    return fetch(url, { signal: controller.signal, keepalive: true })
      .then(res => res.json())
      .then((data) => {
        data.continent_code ||= data.continentCode
        data.country_code ||= data.countryCode
        return data as ProxyDetectionResult
      })
  })

  // 整体 12 秒兜底超时，全部 abort
  const globalTimeout = setTimeout(() => {
    controllers.forEach(c => c.abort())
  }, 12000)

  let result: ProxyDetectionResult | null = null
  try {
    result = await Promise.any(requests)
  }
  catch (error) {
    console.debug(`getMapKey error`, error)
  }
  finally {
    timeouts.forEach(clearTimeout)
    clearTimeout(globalTimeout)
    controllers.forEach(c => c.abort())
  }

  // 如果获取不到，则默认走hz
  if (!result) {
    return 'hz'
  }

  // 如果获取到，则根据结果返回
  console.debug(`getMapKey result`, result)
  const { continent_code, country_code } = result as ProxyDetectionResult
  console.debug(`getMapKey ipInfo`, { continent_code, country_code })

  // 亚洲
  if (continent_code === 'AS') {
    // 中国内地
    if (country_code === 'CN') {
      return 'hz'
    }
    // 非中国内地都走香港
    return 'hk'
  }

  // 北美洲，南美洲，欧洲
  if (US_CONTINENT_CODES.includes(continent_code)) {
    return 'us'
  }

  // 亚洲以外都走新加坡
  return 'sg'
}

export async function reGetGatewayConfigByIpChange(ip: string) {
  if (!ip)
    return

  // 初始化会获取一次网关，所以只存 ip 不重新获取网关
  if (!userIp) {
    userIp = ip
    return
  }

  if (userIp !== ip) {
    console.log(`🚀 ~ IP changed, previous IP: ${userIp}, current IP: ${ip}`)
    userIp = ip
    getGatewayConfig()
  }
}

/**
 * 读取网关配置
 */
export async function getGatewayConfig(): Promise<string> {
  // if (isPackaged) {
  // TODO 临时处理
  // return 'http://47.239.9.178'
  // }

  const mapKey = await getMapKey()
  console.debug(`getGatewayConfig mapKey`, mapKey)

  for await (const url of gateConfUrls) {
    try {
      const response = await axios.get(url, {
        headers: {
          token: '112233998877rrttyy',
        },
        timeout: 15 * 1000,
      })
      console.debug(`getGatewayConfig response`, response.data)

      if (isDev) {
        baseUrl = response.data.test
        openAPIUrl = baseUrl
        return baseUrl
      }

      const data: GateConf = response.data
      const domain = await getAvailableUrl(data.prod_apps, mapKey)
      console.debug(`getAvailableUrl domain`, domain)

      if (baseUrl !== domain) {
        ipcSender.app.backendUrlChange(domain)
      }

      baseUrl = domain || baseUrl || data.prod_apps?.hz?.[0] || 'https://hz.gate.roxybrowser.cn'

      openAPIUrl = await getAvailableUrl(data.prod_apis, mapKey)
      console.debug(`getAvailableUrl openAPIUrl`, openAPIUrl)

      openAPIUrl ||= data.prod_apis?.hz?.[0] || 'https://hz.api.roxybrowser.cn'

      console.debug(`getGatewayConfig baseUrl`, baseUrl)
      console.debug(`getGatewayConfig openAPIUrl`, openAPIUrl)

      return baseUrl
    }
    catch (error) {
      console.log(`gatewayConfig error`, error)
    }
  }

  openAPIUrl ||= 'https://hz.api.roxybrowser.cn'
  baseUrl = isDev ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn'
  ipcSender.app.backendUrlChange(baseUrl)
  return baseUrl
}

/** 获取可用的 API 域名 */
async function getAvailableUrl(data: Record<string, string[]>, mapKey: string) {
  // 根据原始的 mapKey获取 API 域名
  let domain = await testBackendUrl(data[mapKey])

  // 当前是hz,拿数组的下一个,没有下一个了,就拿hk的数组, hk的数组也不通，就拿sg的数组.
  if (!domain && mapKey === 'hz') {
    mapKey = 'hk'
    domain = await testBackendUrl(data[mapKey])
  }
  // 当前是hk,拿数组的下一个,没有下一个了,就拿sg的数组.
  if (!domain && mapKey === 'hk') {
    mapKey = 'sg'
    domain = await testBackendUrl(data[mapKey])
  }
  // 当前是sg,拿数组的下一个,没有下一个了,就拿hk的数组.
  if (!domain && mapKey === 'sg') {
    mapKey = 'hk'
    domain = await testBackendUrl(data[mapKey])
  }
  // 当前是us,拿数组的下一个,没有下一个了,就拿hk的数组
  if (!domain && mapKey === 'us') {
    mapKey = 'hk'
    domain = await testBackendUrl(data[mapKey])
  }

  return domain
}

/** 测试后端域名是否可用 */
async function testBackendUrl(urls: string[] = []) {
  for await (const url of urls) {
    try {
      await axios.get(url, {
        validateStatus: () => true, // 接受所有状态码
      })
      return url
    }
    catch (error) {
      console.debug(`getBackendUrl error`, error)
    }
  }
  return ''
}

// 24小时拿一次
setInterval(() => {
  getGatewayConfig()
}, 1000 * 60 * 60 * 24)
