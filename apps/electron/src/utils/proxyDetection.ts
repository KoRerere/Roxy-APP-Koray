import type { AxiosProxyConfig } from 'axios'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import http from 'node:http'
import https from 'node:https'
import { SocksProxyAgent } from 'socks-proxy-agent'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { setLuminetProxy } from '/@/modules/luminet'
import { store } from '/@/modules/store'

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
}

const defaultCheckChannel = 'http://iprust.io/ip.json'

const protocolCheckMap = {
  SOCKS5: checkSocks5Proxy,
  HTTP: checkHttpProxy,
  HTTPS: checkHttpsProxy,
  noproxy: noProxy,
} as const

type ProtocolMapType = keyof typeof protocolCheckMap
export type ProxyDetectionParams = Pick<WindowItemType, 'dirId' | 'checkChannel' | 'ipType' | 'protocol' | 'proxyCategory' | 'proxyUserName' | 'proxyPassword' | 'host' | 'port' | 'proxyNetwork'>

// 检测超时时间
const TIMEOUT = 6000

/** 根据协议获取检测方法 */
function getCheckFunction(protocol: ProtocolMapType) {
  return protocolCheckMap[protocol] || noProxy
}

/** 获取检测渠道 url */
function getCheckUrl(url = defaultCheckChannel, ipType: string) {
  // console.log(`transIpUrl`, url, ipType)
  if (ipType === `IPV6`) {
    return `http://api.ip2location.io/?key=266EF4FE57093F065C2FA5C5835686AE`
  }
  return url
}

/** 代理 => 刷新 URL */
export function tryRefreshUrl(refreshUrl: string) {
  return axios.get(refreshUrl).then((response) => {
    return response.statusText === 'OK'
  }).catch(() => {
    return false
  })
}

/** 代理检测 */
export async function proxyDetection(proxyDetectionParams: ProxyDetectionParams): Promise<ProxyDetectionResult> {
  const { dirId, checkChannel, protocol, proxyCategory = protocol, ipType, host, port, proxyUserName, proxyPassword } = proxyDetectionParams

  console.log(`dirId && proxyUserName`, dirId && proxyUserName)
  const luminetParams = {
    addr: host && port ? `${host}:${port}` : '',
    user_name: proxyUserName || '',
    password: proxyPassword || '',
    protocal: proxyCategory.toLocaleLowerCase(),
  }

  if (dirId) {
    await setLuminetProxy({
      [dirId]: luminetParams,
    })
  }

  const params: ProxyDetectionParams = {
    proxyCategory,
    host: dirId ? '127.0.0.1' : host,
    port: dirId ? store.luminetProxyPort : port,
    proxyUserName: dirId || proxyUserName,
    proxyPassword: dirId || proxyPassword,
    checkChannel: getCheckUrl(checkChannel, ipType) || defaultCheckChannel,
  }

  // console.log('proxyDetectionParams', proxyDetectionParams)
  const checkMode = getCheckFunction(proxyCategory as ProtocolMapType)
  console.log('luminetParams', luminetParams)
  console.log('proxyDetection params', params)
  const result = await checkMode(params)

  console.log('proxyDetection result', result)

  if (result) {
    result.region ||= result.region_name
    result.city ||= result.city_name
    result.country ||= result.country_name || result.country_long
    result.country_code ||= result.country_short
  }

  return result
}

function logProxyConfig(params: ProxyDetectionParams, name = ``) {
  // return
  const { checkChannel, host, port, proxyUserName, proxyPassword, proxyNetwork } = params
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
  const { checkChannel = defaultCheckChannel } = winInfo
  const response = await axios.get(checkChannel, { timeout: TIMEOUT })
  response.data.country ||= response.data.country_name || response.data.country_long
  response.data.country_code ||= response.data.country_short

  return response.data
}

/**
 * Https 代理
 */
function checkHttpsProxy(winInfo: ProxyDetectionParams) {
  const { promise, resolve, reject } = Promise.withResolvers()
  const { checkChannel, host, port, proxyUserName, proxyPassword } = winInfo

  const auth = proxyPassword && proxyUserName ? `${proxyUserName}:${proxyPassword}@` : ``

  // let auth = $isNull(proxyPassword) || $isNull(proxyUserName) ? `` : `${proxyUserName}:${proxyPassword}@`

  const httpUrl = `http://${auth}${host}:${port}`
  console.log(`httpUrl`, httpUrl)
  http.get(checkChannel, {
    headers: {
      'user-agent': 'electron ',
    },
    timeout: TIMEOUT,
    agent: new HttpsProxyAgent(httpUrl, { timeout: TIMEOUT }),
  }, (res) => {
    // res.pipe(process.stdout);
    let data = ``

    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      try {
        console.log(`checkHttpsProxy data`, data)
        const json = JSON.parse(data)
        resolve(json)
      }
      catch (error) {
        console.log(`checkHttpsProxy error 转json 出错 返回 所有结果`)
        reject(error)
      }
    })

    res.on(`error`, (error) => {
      console.log(`checkHttpsProxy error`, error)
      reject(error)
    })
  }).on(`error`, (error) => {
    console.log(`checkHttpsProxy error`, error)
    reject(error)
  })

  return promise
}

/**
 * Http 代理
 */
async function checkHttpProxy(winInfo: ProxyDetectionParams) {
  const { proxyUserName, proxyPassword, host, port, checkChannel } = winInfo
  logProxyConfig(winInfo, `Http`)

  let auth: AxiosProxyConfig['auth']

  if (proxyUserName && proxyPassword) {
    auth = {
      username: proxyUserName,
      password: proxyPassword,
    }
  }

  const api = axios.create({
    timeout: TIMEOUT,
    proxy: {
      host,
      port: Number(port),
      auth,
    },
  })
  api.interceptors.request.use((config) => {
    config.maxRedirects = 0
    console.log(`禁止重定向`)
    return config
  })
  const response = await api.get(checkChannel)

  console.log(`http 检测成功 url:${checkChannel}`, response.data)

  return response.data
}

/**
 * socket5 代理
 */
async function checkSocks5Proxy(parmes: any) {
  const { proxyUserName, proxyPassword, host, port, checkChannel } = parmes
  logProxyConfig(parmes, `socket5`)

  let auth = `${proxyUserName}:${proxyPassword}@`
  if (proxyUserName === `` || proxyPassword === ``) {
    auth = ``
  }

  const agent = new SocksProxyAgent(`socks5h://${auth}${host}:${port}`, {
    timeout: TIMEOUT,
  })

  const response = await axios.get(checkChannel, {
    // headers: {
    //   Host: new URL(checkChannel).host
    // },
    timeout: TIMEOUT,
    httpAgent: agent,
  })

  return response.data
}
