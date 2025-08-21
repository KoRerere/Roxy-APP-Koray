import axios from 'axios'
import { ProxyDetectionResult } from '/@/utils'
import { isDev, isPackaged } from '/@/constants/common'
import { ipcMain } from '/@/modules/ipc'

const gateConfUrls = ['https://gw.roxyip.com/get_gate_conf', 'https://gw.roxyip.io/get_gate_conf']

let openAPIUrl = ''
let baseUrl = ''
let userIp = ''//用户真实ip, 变动后重新获取网关配置

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
  let result

  for await (const url of IP_QUERY_URLS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5秒超时
    try {
      result = await fetch(url, { signal: controller.signal }).then(res => res.json())
      result.continent_code ||= result.continentCode
      result.country_code ||= result.countryCode
      break
    }
    catch (error) {
      console.debug(`getMapKey error`, error)
    } finally {
      clearTimeout(timeout)
    }
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
  }

  // 北美洲，南美洲，欧洲
  if (US_CONTINENT_CODES.some(code => code === continent_code)) {
    return 'us'
  }

  // 亚洲以外都走新加坡
  return 'sg'
}

export async function reGetGatewayConfigByIpChange(ip: string) {
  if (!ip) return

  // 初始化会获取一次网关，所以只存 ip 不重新获取网关
  if (!userIp) {
    userIp = ip
    return
  }

  if (userIp !== ip) {
    console.log(`🚀 ~ ip发生变化, 上一次ip: ${userIp}, 当前ip: ${ip}`)
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

  let mapKey = await getMapKey()
  console.debug(`getGatewayConfig mapKey`, mapKey)

  for await (const url of gateConfUrls) {
    try {
      const response = await axios.get(url, {
        headers: {
          token: '112233998877rrttyy',
        },
      })
      console.debug(`getGatewayConfig response`, response.data)

      if (isDev) {
        baseUrl = response.data.test
        openAPIUrl = baseUrl
        return baseUrl
      }

      const domain = await getAvailableUrl(response.data.prod_apps, mapKey)
      console.debug(`getAvailableUrl domain`, domain)

      if (baseUrl !== domain) {
        ipcMain.send('app:backend-url-change', domain)
      }

      baseUrl = domain || response.data.prod || baseUrl

      openAPIUrl = await getAvailableUrl(response.data.prod_apis, mapKey)
      console.debug(`getAvailableUrl openAPIUrl`, openAPIUrl)

      openAPIUrl ||= response.data.prod_api

      console.debug(`getGatewayConfig baseUrl`, baseUrl)
      console.debug(`getGatewayConfig openAPIUrl`, openAPIUrl)

      return baseUrl
    }
    catch (error) {
      console.log(`gatewayConfig error`, error)
    }
  }

  openAPIUrl ||= 'https://hz.api.roxybrowser.cn'
  baseUrl = isDev ? 'https://lumitest.lumibrowser.com' : 'https://hz.gate.roxybrowser.cn'
  return baseUrl
}

/** 获取可用的 API 域名 */
async function getAvailableUrl(data: Record<string, string[]>, mapKey: string) {
  // 根据原始的 mapKey获取 API 域名
  let domain = await testBackendUrl(data[mapKey])

  // 当前是hz,拿数组的下一个,没有下一个了,就拿sg的数组, sg的数组也不通，就拿us的数组
  if (!domain && mapKey === 'hz') {
    mapKey = 'sg'
    domain = await testBackendUrl(data[mapKey])
  }
  // 当前是sg,拿数组的下一个,没有下一个了,就拿us的数组.
  if (!domain && mapKey === 'sg') {
    mapKey = 'us'
    domain = await testBackendUrl(data[mapKey])
  }
  // 当前是us,拿数组的下一个,没有下一个了,就拿sg的数组.
  if (!domain && mapKey === 'us') {
    mapKey = 'sg'
    domain = await testBackendUrl(data[mapKey])
  }

  return domain
}

/** 测试后端域名是否可用 */
async function testBackendUrl(urls: string[] = []) {
  for await (const url of urls) {
    try {
      await axios.get(url, {
        validateStatus: () => true // 接受所有状态码
      })
      return url
    } catch (error) {
      console.debug(`getBackendUrl error`, error)
    }
  }
  return ''
}

// 24小时拿一次
setInterval(() => {
  getGatewayConfig()
}, 1000 * 60 * 60 * 24)
