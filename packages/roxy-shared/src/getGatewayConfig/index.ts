/** 网关配置接口返回的数据 */
export interface GateConfData {
  ip: string
  country: string
  app_gateway: string
  api_gateway: string
}

/** 网关配置接口完整响应结构 */
export interface GateConfResponse {
  code: number
  data: GateConfData
  msg: string
}

/** 创建网关配置实例所需的选项 */
export interface CreateGatewayConfigOptions {
  /** 网关地址列表，会以 Promise.any 的方式并发请求，第一个成功即返回 */
  gateConfUrls: string[]
  /** 全部网关请求失败时使用的兜底 app 网关 */
  defaultAppGateway: string
  /** 全部网关请求失败时使用的兜底 API 网关 */
  defaultApiGateway: string
  /** 单次请求超时时间（毫秒），默认 10 秒 */
  timeoutMs?: number
  /** 网关配置接口要求的鉴权 token */
  token?: string
  /** 网关地址（baseUrl/openAPIUrl）变更后的回调 */
  onChange?: (urls: { baseUrl: string, openAPIUrl: string }) => void
  /**
   *国家变化触发重新拉取后的回调
   */
  onCountryChanged?: (country: string) => void
}

export interface ReGetGatewayConfigByCountryChangeOptions {
  /** 国家 */
  country: string
  /** 请求 URL */
  reqUrl: string
  /** 请求时间 */
  reqTime: number
}

/** 通过工厂创建出的网关配置实例 */
export interface GatewayConfigInstance {
  /** 通过 APP 调用的接口域名 */
  getBaseUrl: () => string
  /** 通过 API 调用的接口域名 */
  getOpenAPIUrl: () => string
  /** 用户真实国家 */
  getCountry: () => string
  /** 拉取网关配置，返回 baseUrl */
  getGatewayConfig: () => Promise<string>
  /** 根据真实国家变化决定是否重新拉取网关配置 */
  reGetGatewayConfigByCountryChange: (options: ReGetGatewayConfigByCountryChangeOptions) => Promise<void>
}

const DEFAULT_TOKEN = '112233998877rrttyy'
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * 创建一个网关配置实例。electron 与 web 共用同一份核心逻辑，
 * 各端只需传入自己的 URL 列表、默认值与可选回调。
 */
export function createGatewayConfig(options: CreateGatewayConfigOptions): GatewayConfigInstance {
  const {
    gateConfUrls,
    defaultAppGateway,
    defaultApiGateway,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    token = DEFAULT_TOKEN,
    onChange,
    onCountryChanged,
  } = options

  let baseUrl = ''
  let openAPIUrl = ''
  /** 用户真实国家，变动后重新获取网关配置 */
  let userCountry = ''
  /** 正在进行中的网关拉取 Promise，并发调用时复用同一个，避免重复请求 */
  let inflightPromise: Promise<string> | null = null
  /** 上一次拉取网关配置的时间 */
  let lastFetchTime = 0

  async function fetchGateConf(url: string): Promise<GateConfData> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { token },
        signal: controller.signal,
      })
      if (!res.ok)
        throw new Error(`gate conf request failed, status: ${res.status}`)

      const result = await res.json()

      if (result?.code === 0 && result?.data?.app_gateway && result?.data?.api_gateway) {
        return result.data
      }
      else {
        throw new Error(`invalid gate conf from ${url}: ${JSON.stringify(result)}`)
      }
    }
    finally {
      clearTimeout(timer)
    }
  }

  async function fetchAndApplyGatewayConfig(): Promise<string> {
    const attempts = gateConfUrls.map(url => fetchGateConf(url))

    try {
      const conf = await Promise.any(attempts)
      console.log(`fetchGateConf first success`, conf)

      // if (conf.ip) {
      //   userIp = conf.ip
      //   onIpChanged?.(conf.ip)
      // }

      baseUrl = conf.app_gateway
      openAPIUrl = conf.api_gateway
      console.log(`getGatewayConfig first ok`, conf)
    }
    catch (error) {
      console.log(`getGatewayConfig all failed`, error)
      if (!baseUrl)
        baseUrl = defaultAppGateway
      if (!openAPIUrl)
        openAPIUrl = defaultApiGateway
    }

    onChange?.({ baseUrl, openAPIUrl })
    return baseUrl
  }

  /**
   * 拉取网关配置，返回 baseUrl。
   * 并发调用时只发起一次实际请求，所有调用方共享同一个 Promise。
   */
  async function getGatewayConfig(): Promise<string> {
    // 已有正在进行的请求，直接复用，避免并发时重复拉取
    if (inflightPromise)
      return inflightPromise

    inflightPromise = fetchAndApplyGatewayConfig().finally(() => {
      inflightPromise = null
    })
    return inflightPromise
  }

  async function reGetGatewayConfigByCountryChange(options: ReGetGatewayConfigByCountryChangeOptions): Promise<void> {
    const { country, reqUrl, reqTime } = options

    console.debug(`🚀 ~ reGetGatewayConfigByCountryChange`, options, lastFetchTime)
    if (!country)
      return

    // 初始化时已经获取过一次网关，所以只记录 IP，不重复拉取
    if (!userCountry) {
      userCountry = country
      return
    }

    // 如果请求时间与上一次拉取网关配置的时间差小于 1 秒，则不重复拉取
    if (reqTime - lastFetchTime < 1000) {
      console.log(`🚀 ~ reGetGatewayConfigByCountryChange skip, reqTime - lastFetchTime < 1000`, reqTime, lastFetchTime)
      return
    }

    if (userCountry !== country && reqUrl.startsWith(baseUrl)) {
      console.log(`🚀 ~ country changed, previous country: ${userCountry}, current country: ${country}`)
      userCountry = country
      await getGatewayConfig()
      onCountryChanged?.(country)
      lastFetchTime = Date.now()
    }
  }

  return {
    getBaseUrl: () => baseUrl,
    getOpenAPIUrl: () => openAPIUrl,
    getCountry: () => userCountry,
    getGatewayConfig,
    reGetGatewayConfigByCountryChange,
  }
}
