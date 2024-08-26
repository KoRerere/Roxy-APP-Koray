import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import https from 'node:https'
import http from 'node:http'
import axios from 'axios'
import type { WindowItemType } from '/@/modules/browser/browser-manager/types'

interface CheckResult {
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

const protocolCheckMap = {
  SOCKS5: checkSocks5Proxy,
  HTTP: checkHttpProxy,
  HTTPS: checkHttpsProxy,
  noproxy: noProxy,
} as const

// 检测超时时间
const TIMEOUT = 6000

/** 根据协议获取检测方法 */
function getCheckFunction(protocol: string) {
  return protocolCheckMap[protocol] || noProxy
}

/** 获取检测渠道 url */
function getCheckUrl(url = `http://ip123.in/ip.json`, ipType: string) {
  // console.log(`transIpUrl`, url, ipType)
  if (ipType === `IPV6`) {
    return `http://api.ip2location.io/?key=266EF4FE57093F065C2FA5C5835686AE`
  }
  return url
}

/** 代理检测 */
export async function proxyDetection(winInfo: WindowItemType): Promise<CheckResult> {
  const params = {
    ...winInfo,
    checkChannel: getCheckUrl(winInfo.checkChannel, winInfo.ipType) || `http://ip123.in/ip.json`,
  }

  console.log('params.proxyCategory', params.proxyCategory, params.protocol)

  const checkMode = getCheckFunction(params.proxyCategory || params.protocol)

  const result = await checkMode(params)

  if (result.info && result.data) {
    result.data.region ||= result.data.region_name
    result.data.city ||= result.data.city_name
    result.data.country ||= result.data.country_name
  }

  return result
}

function logProxyConfig(params, name = ``) {
  // return
  const { checkChannel, host, port, proxyUserName, proxyPassword, proxyNetwork } = params
  console.log(`${name}\n
        checkChannel:${checkChannel}\n
        proxyUserName:${proxyUserName}\n
        password:${proxyPassword}\n
        host:${host}\n
        port:${port}\n
        proxyNetwork:${proxyNetwork}`)
}

/**
 * 无代理
 */
async function noProxy(winInfo: WindowItemType) {
  const { checkChannel = `https://ip123.in/ip.json` } = winInfo
  const response = await axios.get(checkChannel, { timeout: TIMEOUT })

  return response.data
}

/**
 * Https 代理
 */
function checkHttpsProxy(winInfo: WindowItemType) {
  const { promise, resolve, reject } = Promise.withResolvers()
  const { checkChannel, host, port, proxyUserName, proxyPassword } = winInfo

  const auth = proxyPassword && proxyUserName ? `${proxyUserName}:${proxyPassword}@` : ``

  // let auth = $isNull(proxyPassword) || $isNull(proxyUserName) ? `` : `${proxyUserName}:${proxyPassword}@`

  const httpUrl = `https://${auth}${host}:${port}`
  const options = {
    headers: {
      'user-agent': 'electron ',
    },
    agent: new HttpsProxyAgent(httpUrl, { timeout: TIMEOUT }),
  };
  (!(`${checkChannel}`).includes(`https`) ? http : https).get(checkChannel, options, (res) => {
    // res.pipe(process.stdout);
    let data = ``

    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      try {
        const json = JSON.parse(data)
        resolve(json)
      }
      catch (error) {
        console.log(`checkHttpsProxy error 转json 出错 返回 所有结果`)
        reject(error)
      }
    }).on(`error`, (error) => {
      console.log(`checkHttpsProxy error`, error)
      reject(error)
    })
  })

  return promise
}

/**
 * Http 代理
 */
async function checkHttpProxy(winInfo: WindowItemType) {
  const { proxyUserName, proxyPassword, host, port, checkChannel } = winInfo
  logProxyConfig(winInfo, `Http`)

  const api = axios.create({
    timeout: TIMEOUT,
    proxy: {
      host,
      port: Number(port),
      ...(proxyUserName === `` || proxyPassword === ``
        ? {}
        : {
            auth: {
              username: proxyUserName,
              password: proxyPassword,
            },
          }),
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
async function checkSocks5Proxy(parmes) {
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
    httpAgent: agent,
  })

  return response.data
}
