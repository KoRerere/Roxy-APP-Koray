import { IPType } from '/@/enums/proxy'
import { isEmptyValue, parseProxyUrl } from '/@/utils'
import type { CheckResult } from '/@/views/agent/hooks'

/** 提取链接解析后的代理连接信息 */
export interface ApiExtractProxyConnection {
  host: string
  port: string
  proxyUserName: string
  proxyPassword: string
  ipType: IPType
  protocol: string
  proxyCategory: string
  extraUrl: string
}

export type ApiExtractFetchResult
  = | { ok: true, connection: ApiExtractProxyConnection }
    | { ok: false, message: string }

export type ApiExtractAndTestResult
  = | {
    ok: true
    connection: ApiExtractProxyConnection
    checkResult: CheckResult
  }
  | { ok: false, message: string }

/** 判断提取接口返回是否为失败对象（含 code / message） */
export function isExtractErrorPayload(data: unknown): data is { code?: number | string, message?: string, msg?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return false
  return 'code' in data || 'message' in data || 'msg' in data
}

/**
 * GET 提取链接并解析为 host:port（及可选账号）。
 * 成功为纯文本；失败多为 JSON：{ code, message }。
 */
export async function fetchAndParseApiExtract(
  extraUrl: string,
  proxyCategory = 'SOCKS5',
): Promise<ApiExtractFetchResult> {
  const url = extraUrl.trim()
  if (isEmptyValue(url))
    return { ok: false, message: $t('请输入提取链接') }

  try {
    // 直连提取商 API，不走业务 HttpClient，避免带上鉴权头
    const response = await fetch(url, { method: 'GET' })
    const text = (await response.text()).trim()

    if (!text)
      return { ok: false, message: $t('提取失败') }

    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const payload = JSON.parse(text)
        if (isExtractErrorPayload(payload))
          return { ok: false, message: payload.message || payload.msg || $t('提取失败') }
      }
      catch {
        // 非合法 JSON，按普通文本继续解析
      }
    }

    if (!response.ok)
      return { ok: false, message: text || $t('提取失败') }

    const { host, port, proxyUserName, proxyPassword } = parseProxyUrl(text)
    if (!host || !port)
      return { ok: false, message: $t('提取结果格式错误') }

    return {
      ok: true,
      connection: {
        host: host.replace(/\[|\]/g, ''),
        port: String(port),
        proxyUserName: proxyUserName ?? '',
        proxyPassword: proxyPassword ?? '',
        ipType: host.startsWith('[') ? IPType.IPV6 : IPType.IPV4,
        protocol: proxyCategory,
        proxyCategory,
        extraUrl: url,
      },
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return { ok: false, message: message || $t('提取失败') }
  }
}

/** 提取成功后执行一次代理测速 */
export async function runApiExtractAndTest(options: {
  extraUrl: string
  proxyCategory?: string
  checkChannel?: string
  isDirect?: boolean
  testProxy: (data: Record<string, any>) => Promise<CheckResult>
}): Promise<ApiExtractAndTestResult> {
  const proxyCategory = options.proxyCategory || 'SOCKS5'
  const fetched = await fetchAndParseApiExtract(options.extraUrl, proxyCategory)
  if (!fetched.ok)
    return fetched

  const { connection } = fetched
  const proxyPayload = {
    ...connection,
    checkChannel: options.checkChannel,
    isDirect: options.isDirect,
    apiCheck: false,
  }

  const checkResult = await options.testProxy(proxyPayload)
  return { ok: true, connection, checkResult }
}

/** 创建参数是否为「仅填了提取链接、尚未测过」的 API 提取 */
export function needsSilentApiExtract(params: Record<string, any>): boolean {
  const proxyMethod = params.proxyMethod
  const extraUrl = String(params.extraUrl || '').trim()
  if (proxyMethod !== 'api' || isEmptyValue(extraUrl))
    return false
  // 测过会写入扁平 host；无 host 视为未测
  return isEmptyValue(params.host)
}

/** 将提取 + 测速结果合并进扁平代理字段（单窗事实源） */
export function mergeApiExtractIntoCreateParams(
  params: Record<string, any>,
  connection: ApiExtractProxyConnection,
  checkResult: CheckResult,
): Record<string, any> {
  return {
    ...params,
    proxyMethod: 'api',
    moduleId: 0,
    proxyCategory: connection.proxyCategory,
    protocol: connection.protocol,
    extraUrl: connection.extraUrl,
    host: connection.host,
    port: connection.port,
    proxyUserName: connection.proxyUserName,
    proxyPassword: connection.proxyPassword,
    ipType: connection.ipType,
    lastIp: checkResult.lastIp ?? '',
    lastCity: checkResult.lastCity ?? '',
    lastCountry: checkResult.lastCountry ?? '',
    timezone: checkResult.timezone,
    checkStatus: checkResult.checkStatus,
    checkTime: checkResult.checkTime,
  }
}

/**
 * 创建/编辑提交前：若 API 提取未测过，静默提取并测速，写回扁平代理字段。
 * 仅 proxyMethod === 'api' 且有 extraUrl、无 host 时触发；choose/custom/noproxy 原样返回同一引用。
 * 提取失败不阻断提交，原样返回 params。
 */
export async function ensureApiExtractProxyInfo(
  params: Record<string, any>,
  options: {
    checkChannel?: string
    isDirect?: boolean
    testProxy: (data: Record<string, any>) => Promise<CheckResult>
  },
): Promise<Record<string, any>> {
  if (!needsSilentApiExtract(params))
    return params

  // 非客户端无法测速，跳过静默提取，不阻断创建
  if (!globalThis.isElectron)
    return params

  const extraUrl = String(params.extraUrl || '').trim()
  const proxyCategory = String(params.proxyCategory || params.protocol || 'SOCKS5')

  const result = await runApiExtractAndTest({
    extraUrl,
    proxyCategory,
    checkChannel: options.checkChannel,
    isDirect: options.isDirect,
    testProxy: options.testProxy,
  })

  if (!result.ok)
    return params

  return mergeApiExtractIntoCreateParams(params, result.connection, result.checkResult)
}
