import axios from 'axios'
import { isDev, isPackaged, ProxyDetectionResult } from '/@/utils'
import { ipcMain } from '/@/modules/ipc'

const gateConfUrls = ['https://gw.roxyip.com/get_gate_conf', 'https://gw.roxyip.io/get_gate_conf']

let openAPIUrl = ''
let baseUrl = ''

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

async function getMapKey() {
  const result = await axios.get<ProxyDetectionResult>('https://ip234.in/ip.json')
  console.debug(`getMapKey result`, result.data)
  const { continent_code, country_code } = result.data
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

  baseUrl = isDev ? 'https://lumitest.lumibrowser.com' : 'https://gate.roxybrowser.net'
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
