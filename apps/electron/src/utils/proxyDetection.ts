import type { AxiosProxyConfig } from 'axios'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import http from 'node:http'
import https from 'node:https'
import { SocksProxyAgent } from 'socks-proxy-agent'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'
import { delLuminetProxy, setLuminetProxy, startLuminet } from '/@/modules/luminet'
import { store } from '/@/modules/store'
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
}

const getDefaultCheckChannel = () => store.ipChecker || 'http://iprust.io/ip.json'

const protocolCheckMap = {
  SOCKS5: checkSocks5Proxy,
  HTTP: checkHttpProxy,
  HTTPS: checkHttpsProxy,
  noproxy: noProxy,
} as const

type ProtocolMapType = keyof typeof protocolCheckMap
export type ProxyDetectionParams = Pick<WindowItemType, 'dirId' | 'checkChannel' | 'ipType' | 'protocol' | 'proxyCategory' | 'proxyUserName' | 'proxyPassword' | 'host' | 'port' | 'proxyNetwork'> & {
  /** 是否优先使用外部的参数 */
  outerParamFirst: boolean
}

// 检测超时时间
const TIMEOUT = 6000

/** 根据协议获取检测方法 */
function getCheckFunction(protocol: ProtocolMapType) {
  return protocolCheckMap[protocol] || noProxy
}

/** 获取检测渠道 url */
function getCheckUrl(url = getDefaultCheckChannel(), ipType: string) {
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
  const { dirId, checkChannel, outerParamFirst, protocol, proxyCategory = protocol || 'noproxy', ipType, host, port, proxyUserName, proxyPassword } = proxyDetectionParams
  const { systemProxySwitch } = store

  if (!dirId) {
    throw new Error(`dirId is required`)
  }
  console.log(`systemProxySwitch`, systemProxySwitch)
  console.log(`dirId && proxyUserName`, dirId && proxyUserName)
  if (systemProxySwitch) {
    await startLuminet()
    const luminetParams = {
      addr: host && port ? `${host}:${port}` : '',
      user_name: proxyUserName || '',
      password: proxyPassword || '',
      protocal: proxyCategory.toLocaleLowerCase(),
    }
    console.log('luminetParams', luminetParams)

    if (dirId) {
      await setLuminetProxy({
        [dirId]: luminetParams,
      })
    }
  }

  const params: ProxyDetectionParams = {
    proxyCategory,
    host: systemProxySwitch ? '127.0.0.1' : host,
    port: systemProxySwitch ? (outerParamFirst ? port : store.luminetProxyPort) : port,
    proxyUserName: systemProxySwitch ? dirId : proxyUserName,
    proxyPassword: systemProxySwitch ? dirId : proxyPassword,
    checkChannel: getCheckUrl(checkChannel, ipType) || getDefaultCheckChannel(),
  }

  // console.log('proxyDetectionParams', proxyDetectionParams)
  const checkMode = getCheckFunction(proxyCategory as ProtocolMapType)
  console.log('proxyDetection params', params)
  const result = await checkMode(params)

  console.log('proxyDetection result', result)

  // 下面为什么会有这么多的判断？因为不同的检测渠道返回的数据字段名不一样，所以需要做一些兼容处理
  if (result) {
    result.ip ||= result.query
    result.region ||= result.region_name
    result.city ||= result.city_name
    result.country ||= result.country_name || result.country_long
    result.country_code ||= result.country_short || result.countryCode
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
  const { checkChannel = getDefaultCheckChannel() } = winInfo
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
  const protocol = store.systemProxySwitch ? `http` : `https`
  const httpUrl = `${protocol}://${auth}${host}:${port}`
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

  const url = `socks5h://${auth}${host}:${port}`
  console.log(`SocksProxyAgent url`, url)
  const agent = new SocksProxyAgent(url, {
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

export async function detectNetwork(type?: 'local' | 'system') {
  const { systemProxySwitch } = store
  const dirId = Math.random().toString(36).slice(2)

  if (systemProxySwitch || type === 'system') {
    const systemProxy = await getSystemProxy()
    console.log('systemProxy', systemProxy)
    const [host, port] = systemProxy.split(':')
    return proxyDetection({ dirId, host, port, protocol: 'HTTP' }).catch(() => {
      // 如果系统代理检测失败，则走本地网络检测
      return proxyDetection({ dirId }).finally(() => {
        delLuminetProxy(dirId)
      })
    }).finally(() => {
      delLuminetProxy(dirId)
    })
  }
  else {
    return proxyDetection({ dirId }).finally(() => {
      delLuminetProxy(dirId)
    })
  }
}
