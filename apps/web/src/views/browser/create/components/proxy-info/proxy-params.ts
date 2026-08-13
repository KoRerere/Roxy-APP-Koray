/** 代理连接相关扁平字段（与创建/编辑 API、窗口详情一致） */
export const SINGLE_PROXY_FLAT_KEYS = [
  'moduleId',
  'proxyMethod',
  'proxyCategory',
  'protocol',
  'ipType',
  'host',
  'port',
  'proxyUserName',
  'proxyPassword',
  'refreshUrl',
  'checkChannel',
  'extraChannel',
  'isExtraNewIp',
  'isRepectCheck',
  'extraUrl',
  'lastIp',
  'lastCountry',
  'lastCity',
  'isEncryptProxy',
  'proxyEncryptInfo',
] as const

const NOPROXY_FLAT = {
  moduleId: 0,
  proxyMethod: 'noproxy',
  proxyCategory: 'noproxy',
  protocol: 'noproxy',
  host: '',
  port: '',
  proxyUserName: '',
  proxyPassword: '',
  refreshUrl: '',
  lastCity: '',
  lastCountry: '',
  lastIp: '',
} as const

function isPresent(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

function pickPresent(...values: unknown[]) {
  return values.find(isPresent)
}

function categoryOf(item: Record<string, any> | undefined) {
  return String(item?.proxyCategory || item?.protocol || '')
}

function isNoproxyItem(item: Record<string, any> | undefined) {
  if (!item)
    return true
  const category = categoryOf(item).toLowerCase()
  return category === 'noproxy' || item.proxyMethod === 'noproxy'
}

/** 展开批量里的 _proxyCount 占位 */
function expandProxyList(list: Record<string, any>[], proxyMethod: string) {
  return list.flatMap(({ _proxyCount, ...item }) => {
    const count = Math.max(1, Number(_proxyCount) || 1)
    const method = proxyMethod === 'api'
      ? 'api'
      : (item.id ? 'choose' : 'custom')
    return Array.from({ length: count }, () => ({ ...item, proxyMethod: method }))
  })
}

/** moduleId / id：0 与空视为未关联代理库 */
export function resolveProxyModuleId(...values: unknown[]) {
  const raw = pickPresent(...values)
  if (raw === undefined)
    return 0
  const n = Number(raw)
  return Number.isFinite(n) && n !== 0 ? n : 0
}

/**
 * 从任意来源（窗口详情 / 快速创建模板）归一成扁平代理字段。
 * 旧模板若只有 proxyInfoList[0]，在此补齐扁平字段（只读迁移，不把数组当事实源）。
 */
export function resolveFlatProxyFields(data: Record<string, any> = {}) {
  const fromList = Array.isArray(data.proxyInfoList) ? data.proxyInfoList[0] : null
  const proxyCategory = pickPresent(
    data.proxyCategory,
    data.protocol,
    fromList?.proxyCategory,
    fromList?.protocol,
  )
  const protocol = pickPresent(data.protocol, fromList?.protocol, proxyCategory)
  const moduleId = resolveProxyModuleId(data.moduleId, fromList?.id)
  const proxyMethod = String(
    pickPresent(data.proxyMethod, fromList?.proxyMethod)
    || (moduleId ? 'choose' : (proxyCategory && String(proxyCategory).toLowerCase() !== 'noproxy' ? 'custom' : 'noproxy')),
  )

  const flat: Record<string, any> = {
    moduleId: proxyMethod === 'custom' || proxyMethod === 'api' || proxyMethod === 'noproxy' ? 0 : moduleId,
    proxyMethod,
    proxyCategory: proxyCategory || 'noproxy',
    protocol: protocol || proxyCategory || 'noproxy',
  }

  for (const key of SINGLE_PROXY_FLAT_KEYS) {
    if (key in flat)
      continue
    // 仍有 UI list 时优先 list：避免 ...original 残留的旧 lastIp/host 盖住当前选中代理
    const value = pickPresent(fromList?.[key], data[key])
    if (value !== undefined)
      flat[key] = value
  }

  return flat
}

/**
 * 供 ProxyInfo UI 使用：由扁平字段组装长度 ≤ 1 的列表（与编辑页一致）。
 * 不把入参里的 proxyInfoList 原样带回，避免双源。
 */
export function buildUiProxyInfoList(data: Record<string, any> = {}) {
  const flat = resolveFlatProxyFields(data)
  const category = String(flat.proxyCategory || '').toLowerCase()
  if (!category || category === 'noproxy' || flat.proxyMethod === 'noproxy')
    return []

  const isChoose = flat.proxyMethod === 'choose' && flat.moduleId
  return [{
    ...flat,
    id: isChoose ? flat.moduleId : undefined,
    proxyMethod: isChoose ? 'choose' : (flat.proxyMethod === 'api' ? 'api' : 'custom'),
    proxyCategory: flat.proxyCategory,
    protocol: flat.protocol || flat.proxyCategory,
  }]
}

/**
 * 单窗创建 / 编辑 / 快速创建模板：去掉 proxyInfoList，只保留扁平代理字段。
 */
export function toSingleWindowProxyParams<T extends Record<string, any>>(params: T): T {
  const flat = resolveFlatProxyFields(params)
  const next: Record<string, any> = { ...params, ...flat }
  delete next.proxyInfoList
  if (next.proxyMethod === 'custom' || next.proxyMethod === 'api' || next.proxyMethod === 'noproxy')
    next.moduleId = 0
  return next as T
}

/**
 * proxyInfoList 的 formatValue：把 UI 草稿摊平进 formData，并返回批量用的数组。
 * 单窗随后会走 toSingleWindowProxyParams 去掉返回的 list。
 * 各分支写全量扁平字段，避免 ...original 残留 extraUrl/lastIp 等串到其他代理方式。
 */
export function formatProxyInfoListValue(
  input: { value?: unknown },
  formData: Record<string, any>,
): Record<string, any>[] {
  const list = (Array.isArray(input.value) ? input.value : []) as Record<string, any>[]
  const first = list[0]

  if (isNoproxyItem(first)) {
    Object.assign(formData, NOPROXY_FLAT)
    return list.length ? list : [{ id: 0, ...NOPROXY_FLAT }]
  }

  // 有库 id 一律按已有代理处理，避免误走 api 分支触发静默提取/测速
  const isChoose = Boolean(first.id)
  if (isChoose) {
    const category = categoryOf(first)
    Object.assign(formData, {
      moduleId: first.id,
      proxyMethod: 'choose',
      proxyCategory: category,
      protocol: first.protocol || first.proxyCategory || category,
      // 必须用当前选中项覆盖 ...original 残留，不能留 undefined 否则旧 lastIp 会渗回来
      lastCity: first.lastCity ?? '',
      lastCountry: first.lastCountry ?? '',
      lastIp: first.lastIp ?? '',
      // 清空自定义/API 连接字段，防止双源合并读到旧 host/extraUrl
      host: '',
      port: '',
      proxyUserName: '',
      proxyPassword: '',
      refreshUrl: '',
      extraUrl: '',
      extraChannel: '',
    })
    return expandProxyList(list, 'choose')
  }

  if (first.proxyMethod === 'api') {
    const category = categoryOf(first) || 'SOCKS5'
    Object.assign(formData, {
      moduleId: 0,
      proxyMethod: 'api',
      proxyCategory: category,
      protocol: first.protocol || first.proxyCategory || 'SOCKS5',
      host: first.host ?? '',
      port: first.port ?? '',
      proxyUserName: first.proxyUserName ?? '',
      proxyPassword: first.proxyPassword ?? '',
      ipType: first.ipType,
      extraUrl: first.extraUrl ?? '',
      extraChannel: first.extraChannel,
      isExtraNewIp: first.isExtraNewIp,
      isRepectCheck: first.isRepectCheck,
      lastCity: first.lastCity ?? '',
      lastCountry: first.lastCountry ?? '',
      lastIp: first.lastIp ?? '',
      refreshUrl: '',
    })
    return expandProxyList(list, 'api')
  }

  const category = categoryOf(first)
  Object.assign(formData, {
    moduleId: 0,
    proxyMethod: 'custom',
    proxyCategory: category,
    protocol: first.protocol || first.proxyCategory || category,
    lastCity: first.lastCity ?? '',
    lastCountry: first.lastCountry ?? '',
    lastIp: first.lastIp ?? '',
    ipType: first.ipType,
    host: first.host ?? '',
    port: first.port ?? '',
    proxyUserName: first.proxyUserName ?? '',
    proxyPassword: first.proxyPassword ?? '',
    refreshUrl: first.refreshUrl ?? '',
    checkChannel: first.checkChannel,
    isEncryptProxy: first.isEncryptProxy,
    proxyEncryptInfo: first.proxyEncryptInfo,
    extraUrl: '',
    extraChannel: '',
  })
  return expandProxyList(list, 'custom')
}
