import { ProxyCheckStatus, ProxyType } from '/@/enums'

/** 切到个人空间后用该 query 拉起 RoxyIP 购买，避免旧页面实例卸载后回调失效 */
export const OPEN_ROXY_IP_BUY_QUERY = 'openRoxyIpBuy'

/** 检测失败引导：广告 / 联系技术支持；无失败或系统异常时不展示 */
export type ProxyDetectFailGuideKind = 'ad' | 'support'

/** 引导判断所需的检测结果字段 */
export interface ProxyDetectFailGuideResult {
  checkStatus?: ProxyCheckStatus | number
  proxyType?: ProxyType | number
  /** IPC / 本地网络等系统异常，不得误触发广告或客服入口 */
  systemError?: boolean
  /** 第三方失败时保留的 lastCountry；RoxyIP / 系统异常不应带此字段 */
  preDetectLastCountry?: string
  lastCountry?: string
}

/** 是否为 RoxyIP（buyProxyType / proxyType === 1） */
export function isRoxyIpProxyType(proxyType?: ProxyType | number) {
  return proxyType === ProxyType.buy
}

/** 是否为可计入引导的真实代理失败（排除系统异常） */
export function isGuidableProxyFailure(result: ProxyDetectFailGuideResult) {
  return result.checkStatus === ProxyCheckStatus.failure && !result.systemError
}

/** 从 reject 值取出可读文案（IPC 有时是 string，有时是 Error） */
function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return String(error ?? '')
}

/**
 * 仅 IPC / 通道异常才跳过广告。
 * 主进程对代理连不上会 reject 业务文案（如「检测失败，请检查相关配置」），那是第三方失败的主路径，必须出广告。
 */
export function isProxyDetectSystemError(error: unknown) {
  const msg = getErrorMessage(error)
  return msg.startsWith('[IPC]') || msg.includes('Unknown message')
}

/**
 * 按本次失败 IP 来源决定引导：
 * 失败中存在第三方 → 广告；失败全部为 RoxyIP → 客服；否则不展示。
 */
export function resolveProxyDetectFailGuide(
  results: ProxyDetectFailGuideResult | ProxyDetectFailGuideResult[],
): ProxyDetectFailGuideKind | null {
  const list = (Array.isArray(results) ? results : [results]).filter(Boolean)
  const failed = list.filter(isGuidableProxyFailure)
  if (!failed.length) {
    return null
  }

  const hasThirdPartyFail = failed.some(item => !isRoxyIpProxyType(item.proxyType))
  return hasThirdPartyFail ? 'ad' : 'support'
}

/** 失败结果上的 lastCountry；检测失败会清空展示字段，故优先读检测时留下的副本 */
function resolveFailLastCountry(item: ProxyDetectFailGuideResult) {
  return item.preDetectLastCountry?.trim() || item.lastCountry?.trim() || ''
}

/** 购买弹窗初始化用：按结果顺序取第一条第三方失败且存在的 lastCountry */
export function pickPreferredBuyCountry(
  results: ProxyDetectFailGuideResult | ProxyDetectFailGuideResult[],
): string | undefined {
  const list = (Array.isArray(results) ? results : [results]).filter(Boolean)
  const first = list.find((item) => {
    return !!resolveFailLastCountry(item) && isGuidableProxyFailure(item) && !isRoxyIpProxyType(item.proxyType)
  })
  const country = first ? resolveFailLastCountry(first) : ''
  return country || undefined
}

/** 打开窗口时的本地网络拦截，不触发广告 */
export function isLocalNetworkStopOpenMessage(message: string) {
  return message === $t('网络不通停止打开')
}

/** 打开窗口 warning 是否为代理检测失败（不含本地网络不通） */
export function isProxyDetectOpenWarning(message: string) {
  return [
    $t('代理 IP 检测失败'),
    $t('设备检测失败'),
    $t('无法连接至代理 IP，请检查您当前的网络环境并重试。'),
    $t('无法连接至设备，请检查您当前的网络环境并重试。'),
  ].includes(message)
}
