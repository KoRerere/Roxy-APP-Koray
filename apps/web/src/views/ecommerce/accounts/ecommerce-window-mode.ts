import type { Accordions } from '/@/views/browser/create/components/type'
import type { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'

export interface AccountPlatform {
  countryCode?: string
  displayName?: string
  id?: string | number
  name?: string
  platformIcon?: string
  platformIconDark?: string
  sort?: number
  url?: string
}

export interface EcommerceWindowPlatformItem {
  platformUrl: string
  displayName: string
  /** 级联选择器选中路径的展示文案，与表单 cascade 组件一致 */
  displayPlatform: string
  displayId: string | number
  platformIcon?: string
  platformIconDark?: string
  platformUserName?: string
  platformPassword?: string
  /** 提交时保留级联选中的原始节点，编辑回显优先读取 */
  _accountPlatform?: AccountPlatform | null
}

export interface EcommerceDeviceInfo {
  id?: string | number
  lastCountry?: string
  lastCity?: string
  lastIp?: string
  host?: string
  port?: string | number
  expireDate?: string
  isPermanent?: number
  proxyType?: ProxyType | number
  proxyExpireStatus?: ProxyExpireStatus | number
  orderStatus?: ProxyOrderStatus | number
}

/** 绑定风险弹窗展示的表单上下文（账号平台 + 绑定设备） */
export interface BindRiskFormContext {
  accountPlatform: AccountPlatform | null
  windowName: string
  platformUserName: string
  deviceInfo: EcommerceDeviceInfo | null
}

export interface EcommerceBasicInfo {
  accountPlatform: AccountPlatform | null
  windowName: string
  platformUserName: string
  platformPassword: string
  moduleId?: string | number
  /** 自定义平台地址，提交时写入 windowPlatformList.platformUrl */
  customPlatformUrl?: string
  proxyInfoList?: Record<string, unknown>[]
  deviceInfo?: EcommerceDeviceInfo | null
}

export interface EcommerceRequestFields {
  windowName: string
  /** 未关联为 0，已关联的代理模块 ID 保持字符串 */
  moduleId: string | number
  windowPlatformList: EcommerceWindowPlatformItem[]
  proxyInfoList?: Record<string, unknown>[]
  proxyMethod?: string
  lastCity?: string
  lastCountry?: string
  lastIp?: string
  [key: string]: unknown
}

/** 0 / 空不是有效业务 ID。真实 ID 保持字符串，不能用 Number() 判断。 */
export function isPresentBusinessId(value: unknown): value is string | number {
  return value != null && value !== '' && value !== 0 && String(value) !== '0'
}

export const ECOMMERCE_LEGACY_TOP_LEVEL_FIELDS = [
  'platformUrl',
  'platformUserName',
  'platformPassword',
  'accountPlatform',
] as const

export const ECOMMERCE_EXCLUDED_WINDOW_FIELDS = ['windowName', 'proxyInfoList', 'windowPlatformList']

export function stripEcommerceLegacyTopLevelFields(params: Record<string, unknown>) {
  ECOMMERCE_LEGACY_TOP_LEVEL_FIELDS.forEach((key) => {
    Reflect.deleteProperty(params, key)
  })
}

interface CascadeLabelOptions {
  optionLabel?: string
  optionGroupLabel?: string
  optionGroupChildren?: string[] | string
  dataKey?: string
  separator?: string
}

const ACCOUNT_PLATFORM_CASCADE_CONFIG: CascadeLabelOptions = {
  optionGroupChildren: ['children', 'children'],
  dataKey: 'id',
}

/** 所属平台级联选择器统一配置，表单与路径解析共用 */
export const ACCOUNT_PLATFORM_CASCADE_PROPS = {
  optionLabel: 'name',
  optionGroupLabel: 'name',
  optionGroupChildren: ['children', 'children'],
  dataKey: 'id',
  pathSeparator: '/',
  filter: true,
} as const

/** 所属平台级联：仅平台列（第 2 级，level=1）展示图标；分类/国家列不展示 */
export const ACCOUNT_PLATFORM_ICON_LEVELS = [1, 2] as const

/**
 * 将平台树的 platformIcon / platformIconDark 映射为级联选择器 image / darkImage
 * iconLevels 需要展示图标的层级；不传则每一级都映射
 */
export function withCascadePlatformImages(
  options: unknown[],
  iconLevels?: readonly number[],
  level = 0,
): unknown[] {
  const showIcon = !iconLevels || iconLevels.includes(level)

  return options.map((item) => {
    if (!item || typeof item !== 'object')
      return item

    const option = item as Record<string, unknown>
    const children = Array.isArray(option.children)
      ? withCascadePlatformImages(option.children, iconLevels, level + 1)
      : option.children

    return {
      ...option,
      ...(showIcon
        ? { image: option.platformIcon, darkImage: option.platformIconDark }
        : {}),
      ...(children !== undefined ? { children } : {}),
    }
  })
}

function getCascadeChildren(
  option: Record<string, unknown>,
  level: number,
  optionGroupChildren: string[] | string = 'children',
) {
  const resolver = Array.isArray(optionGroupChildren)
    ? optionGroupChildren[level]
    : optionGroupChildren

  const children = resolver ? option?.[resolver] : option?.children
  return Array.isArray(children) ? children : []
}

function findAccountPlatformPath(
  options: unknown[],
  platform: AccountPlatform,
  level = 0,
  parents: Record<string, unknown>[] = [],
  config: CascadeLabelOptions = {},
): Record<string, unknown>[] | null {
  const {
    optionGroupChildren = ['children', 'children'],
    dataKey = 'id',
  } = config

  for (const option of options) {
    if (!option || typeof option !== 'object')
      continue

    const current = option as Record<string, unknown>
    const children = getCascadeChildren(current, level, optionGroupChildren)
    const path = [...parents, current]

    if (!children.length) {
      const matched = dataKey
        ? String(current[dataKey] ?? '') === String(platform[dataKey as keyof AccountPlatform] ?? '')
        : current === platform

      if (matched)
        return path
      continue
    }

    const found = findAccountPlatformPath(children, platform, level + 1, path, config)
    if (found)
      return found
  }

  return null
}

function resolveCascadeLabel(
  option: Record<string, unknown>,
  level: number,
  pathLength: number,
  config: CascadeLabelOptions,
) {
  const {
    optionLabel = 'name',
    optionGroupLabel = 'name',
  } = config

  const labelKey = level < pathLength - 1 ? optionGroupLabel : optionLabel
  return String(option[labelKey] ?? option.name ?? option.label ?? '').trim()
}

export function buildWindowNameFromAccountPlatform(
  options: unknown[],
  platform: AccountPlatform | null,
  config: CascadeLabelOptions = {},
): string {
  if (!platform || !options.length)
    return ''

  const path = findAccountPlatformPath(options, platform, 0, [], config)
  if (!path?.length)
    return ''

  const { separator = '-' } = config

  return path
    .map((option, index) => resolveCascadeLabel(option, index, path.length, config))
    .filter(Boolean)
    .join(separator)
}

/** 所属平台级联选中项展示文案，与表单 cascade 的 selectedDisplayText 一致 */
export function buildAccountPlatformDisplayLabel(
  options: unknown[],
  platform: AccountPlatform | null,
): string {
  return buildWindowNameFromAccountPlatform(options, platform, {
    ...ACCOUNT_PLATFORM_CASCADE_CONFIG,
    optionLabel: ACCOUNT_PLATFORM_CASCADE_PROPS.optionLabel,
    optionGroupLabel: ACCOUNT_PLATFORM_CASCADE_PROPS.optionGroupLabel,
    separator: ACCOUNT_PLATFORM_CASCADE_PROPS.pathSeparator,
  })
}

export function createEmptyEcommerceBasicInfo(): EcommerceBasicInfo {
  return {
    accountPlatform: null,
    windowName: '',
    platformUserName: '',
    platformPassword: '',
    moduleId: '',
    customPlatformUrl: '',
    deviceInfo: null,
  }
}

/** 从代理/窗口源数据映射设备展示字段（id 由调用方解析） */
function buildDeviceInfo(
  source: Record<string, unknown>,
  id: string | number | undefined,
): EcommerceDeviceInfo {
  return {
    id,
    lastCountry: String(source.lastCountry ?? ''),
    lastCity: String(source.lastCity ?? ''),
    lastIp: String(source.lastIp ?? source.host ?? ''),
    host: source.host as string,
    port: source.port as string | number | undefined,
    expireDate: String(source.expireDate ?? ''),
    isPermanent: source.isPermanent as number | undefined,
    proxyType: (source.proxyType || source.buyProxyType) as ProxyType | number | undefined,
    proxyExpireStatus: source.proxyExpireStatus as ProxyExpireStatus | number | undefined,
    orderStatus: source.orderStatus as ProxyOrderStatus | number | undefined,
  }
}

export function buildDeviceInfoFromProxy(proxy: Record<string, unknown>): EcommerceDeviceInfo {
  const id = proxy.id
  return buildDeviceInfo(proxy, isPresentBusinessId(id) ? String(id) : undefined)
}

function buildDeviceInfoFromSource(source: Record<string, unknown>): EcommerceDeviceInfo | null {
  const moduleId = source.moduleId
  if (!isPresentBusinessId(moduleId))
    return null

  return buildDeviceInfo(source, String(moduleId))
}

function normalizeAccountPlatform(value: unknown): AccountPlatform | null {
  if (!value || typeof value !== 'object')
    return null

  const platform = value as AccountPlatform
  if (!platform.url && platform.id === undefined)
    return null

  return platform
}

function getPlatformDisplayId(platform: AccountPlatform | null | undefined) {
  const id = platform?.id
  return id == null ? '' : String(id)
}

/** 第一层最后一项 id，即自定义平台根节点（按数据结构位置识别，不依赖文案） */
function getCustomPlatformRootId(options: unknown[]) {
  if (!options.length)
    return null

  const root = options.at(-1) as Record<string, unknown> | undefined
  return root?.id == null ? null : String(root.id)
}

/** 判断当前所选平台是否属于自定义平台分支 */
export function isCustomAccountPlatform(
  platform: AccountPlatform | null | undefined,
  options: unknown[],
) {
  const customId = getCustomPlatformRootId(options)
  if (!platform || !customId)
    return false

  if (String(platform.id ?? '') === customId)
    return true

  const path = findAccountPlatformPath(options, platform, 0, [], ACCOUNT_PLATFORM_CASCADE_CONFIG)
  return path?.[0] != null && String(path[0].id ?? '') === customId
}

/** 级联 onChange 回调 payload 解析为平台对象 */
export function parseAccountPlatformChangePayload(payload: unknown): AccountPlatform | null {
  if (!payload || typeof payload !== 'object')
    return null

  return ('value' in payload
    ? (payload as { value: unknown }).value
    : payload) as AccountPlatform | null
}

interface BuildBasicInfoFromFormOptions {
  deviceInfo?: EcommerceBasicInfo['deviceInfo']
}

/** 从 TsForm 表单值构建统一的 EcommerceBasicInfo 快照 */
export function buildBasicInfoFromFormValues(
  values: Record<string, unknown>,
  options: BuildBasicInfoFromFormOptions = {},
): EcommerceBasicInfo {
  return {
    accountPlatform: (values.accountPlatform as AccountPlatform | null) ?? null,
    windowName: String(values.windowName ?? ''),
    platformUserName: String(values.platformUserName ?? ''),
    platformPassword: String(values.platformPassword ?? ''),
    moduleId: typeof values.moduleId === 'string' || typeof values.moduleId === 'number'
      ? values.moduleId
      : '',
    customPlatformUrl: String(values.customPlatformUrl ?? ''),
    deviceInfo: options.deviceInfo ?? null,
  }
}

export interface ValidateEcommerceBasicInfoOptions {
  onError?: (message: string) => void
}

export interface ValidateEcommerceBasicInfoResult {
  valid: boolean
  /** 自定义平台地址字段错误，供 UI  inline 展示 */
  customPlatformUrlError?: string
}

/** 校验账号基础信息，返回是否通过及字段级错误 */
export function validateEcommerceBasicInfo(
  info: EcommerceBasicInfo,
  platformOptions: unknown[],
  options: ValidateEcommerceBasicInfoOptions = {},
): ValidateEcommerceBasicInfoResult {
  const { onError } = options
  const platform = info.accountPlatform
  const isCustom = isCustomAccountPlatform(platform, platformOptions)
  const hasPlatform = Boolean(
    platform && (String(platform.url ?? '').trim() || platform.id !== undefined),
  )
  const hasCustomUrl = Boolean(info.customPlatformUrl?.trim())
  const hasName = Boolean(info.windowName.trim())

  let customPlatformUrlError: string | undefined
  if (isCustom && !hasCustomUrl) {
    customPlatformUrlError = $t('请输入平台地址')
    onError?.(customPlatformUrlError)
  }

  return {
    valid: hasPlatform && hasName && (!isCustom || hasCustomUrl),
    customPlatformUrlError,
  }
}

/** 编辑页保存时的原始绑定上下文，用于对比是否需重新检测 */
export const PROXY_BIND_RISK_NOT_REMIND_KEY = 'proxyBindRiskNotRemind'

export interface BindRiskOriginalContext {
  moduleId: string | number
  displayId: string
}

export interface BindRiskSubmitPlan {
  /** 是否需要在提交前执行绑定风险检测 */
  shouldCheck: boolean
  params: {
    proxyId: string | number
    displayId: string
  }
}

/** 从账号基础信息提取绑定风险检测用的原始上下文 */
export function buildBindRiskOriginalContext(info: EcommerceBasicInfo): BindRiskOriginalContext {
  return {
    moduleId: info.moduleId ?? '',
    displayId: getPlatformDisplayId(info.accountPlatform),
  }
}

/**
 * 解析提交前绑定风险检测计划：
 * - 自定义平台：不检测
 * - 未选择设备：不检测
 * - 创建：有设备时检测
 * - 编辑：moduleId 或 displayId 变化时才检测
 */
export function resolveBindRiskSubmitPlan(
  info: EcommerceBasicInfo,
  platformOptions: unknown[],
  original?: BindRiskOriginalContext,
): BindRiskSubmitPlan {
  const params = {
    proxyId: info.moduleId ?? '',
    displayId: getPlatformDisplayId(info.accountPlatform),
  }

  if (isCustomAccountPlatform(info.accountPlatform, platformOptions))
    return { shouldCheck: false, params }

  // 未选择设备时不做绑定风险检测
  if (!isPresentBusinessId(info.moduleId))
    return { shouldCheck: false, params }

  if (!original)
    return { shouldCheck: true, params }

  const contextChanged = String(params.proxyId) !== String(original.moduleId ?? '')
    || params.displayId !== String(original.displayId ?? '')

  return { shouldCheck: contextChanged, params }
}

/** 从列表行数据提取平台 displayId，供绑定风险检测使用 */
export function getWindowPlatformDisplayId(source: Record<string, unknown>): string {
  const info = createEcommerceBasicInfo(source)
  const id = info.accountPlatform?.id
  return id == null ? '' : String(id)
}

/** 从列表行与所选设备构建风险弹窗展示上下文 */
export function buildBindRiskFormContextFromWindow(
  row: Record<string, unknown>,
  proxy: Record<string, unknown>,
): BindRiskFormContext {
  const info = createEcommerceBasicInfo(row)
  return {
    accountPlatform: info.accountPlatform,
    windowName: info.windowName,
    platformUserName: info.platformUserName,
    deviceInfo: buildDeviceInfoFromProxy(proxy),
  }
}

/**
 * 列表更换设备时是否需做绑定风险检测：
 * 自定义平台、设备未变更、无有效平台 id 时跳过
 */
export function shouldCheckProxyBindRiskForDeviceChange(
  row: Record<string, unknown>,
  newModuleId: string | number,
  platformOptions: unknown[] = [],
): boolean {
  const info = createEcommerceBasicInfo(row)
  if (isCustomAccountPlatform(info.accountPlatform, platformOptions))
    return false
  if (String(newModuleId) === String(info.moduleId ?? ''))
    return false
  if (!getWindowPlatformDisplayId(row))
    return false
  return true
}

function buildAccountPlatformFromSource(source: Record<string, unknown>): AccountPlatform | null {
  const accountPlatform = normalizeAccountPlatform(source.accountPlatform)
  if (accountPlatform)
    return accountPlatform

  const windowPlatform = Array.isArray(source.windowPlatformList)
    ? source.windowPlatformList[0] as Record<string, unknown> | undefined
    : undefined

  // 优先用提交时写入的原始级联节点，避免从 displayId/url 反推丢层级信息
  const fromStored = normalizeAccountPlatform(windowPlatform?._accountPlatform)
  if (fromStored)
    return fromStored

  if (!windowPlatform && !source.platformUrl)
    return null

  return normalizeAccountPlatform({
    url: windowPlatform?.platformUrl ?? source.platformUrl,
    displayName: windowPlatform?.displayName,
    id: windowPlatform?.displayId ?? windowPlatform?.id,
    countryCode: windowPlatform?.countryCode,
    name: windowPlatform?.name,
    platformIcon: windowPlatform?.platformIcon,
    platformIconDark: windowPlatform?.platformIconDark,
  })
}

export function createEcommerceBasicInfo(source: Record<string, unknown> = {}): EcommerceBasicInfo {
  const windowPlatform = Array.isArray(source.windowPlatformList)
    ? source.windowPlatformList[0] as Record<string, unknown> | undefined
    : undefined

  return {
    accountPlatform: buildAccountPlatformFromSource(source),
    windowName: String(source.windowName ?? ''),
    platformUserName: String(source.platformUserName ?? windowPlatform?.platformUserName ?? ''),
    platformPassword: String(source.platformPassword ?? windowPlatform?.platformPassword ?? ''),
    moduleId: typeof source.moduleId === 'string' || typeof source.moduleId === 'number'
      ? source.moduleId
      : '',
    customPlatformUrl: String(windowPlatform?.platformUrl ?? source.platformUrl ?? ''),
    deviceInfo: buildDeviceInfoFromSource(source),
  }
}

/**
 * 从级联路径解析图标：优先取上级节点，1 级有则用 1 级，否则依次落到 2、3… 级
 */
function resolvePlatformIconFromPath(
  path: Record<string, unknown>[] | null | undefined,
  key: 'platformIcon' | 'platformIconDark',
): string {
  if (!path?.length)
    return ''

  for (const option of path) {
    const value = String(option[key] ?? '').trim()
    if (value)
      return value
  }
  return ''
}

export function buildWindowPlatformList(
  info: Pick<EcommerceBasicInfo, 'accountPlatform' | 'platformUserName' | 'platformPassword' | 'customPlatformUrl'>,
  options: unknown[] = [],
): EcommerceWindowPlatformItem[] {
  const platform = info.accountPlatform
  if (!platform)
    return []

  const isCustom = isCustomAccountPlatform(platform, options)
  const platformUrl = isCustom
    ? String(info.customPlatformUrl ?? '').trim()
    : String(platform.url ?? '').trim()

  // 图标按级联路径从上往下取，保证提交结果与上级分类品牌图标一致
  const path = options.length
    ? findAccountPlatformPath(options, platform, 0, [], ACCOUNT_PLATFORM_CASCADE_CONFIG)
    : null
  const platformIcon = resolvePlatformIconFromPath(path, 'platformIcon')
    || String(platform.platformIcon ?? '').trim()
  const platformIconDark = resolvePlatformIconFromPath(path, 'platformIconDark')
    || String(platform.platformIconDark ?? '').trim()

  return [{
    platformUrl,
    displayName: String(platform.displayName ?? '').trim(),
    displayPlatform: buildAccountPlatformDisplayLabel(options, platform),
    displayId: isPresentBusinessId(platform.id) ? String(platform.id) : 0,
    platformIcon,
    platformIconDark,
    platformUserName: info.platformUserName.trim(),
    platformPassword: info.platformPassword.trim(),
    _accountPlatform: { ...platform },
  }]
}

/** 电商设备绑定/更换：从设备库选择；未绑定时与解除代理一致标记为 noproxy */
function buildChooseDeviceFields(source: {
  moduleId: string | number
  lastCity?: string
  lastCountry?: string
  lastIp?: string
}): Pick<EcommerceRequestFields, 'moduleId' | 'proxyMethod' | 'lastCity' | 'lastCountry' | 'lastIp'> & {
  proxyCategory?: string
} {
  if (!isPresentBusinessId(source.moduleId)) {
    return {
      moduleId: 0,
      proxyCategory: 'noproxy',
      proxyMethod: 'custom',
      lastCity: '',
      lastCountry: '',
      lastIp: '',
    }
  }

  return {
    moduleId: String(source.moduleId),
    proxyMethod: 'choose',
    lastCity: source.lastCity ?? '',
    lastCountry: source.lastCountry ?? '',
    lastIp: source.lastIp ?? '',
  }
}

function formatProxyInfoListItem(item: Record<string, unknown>): Record<string, unknown> {
  const { _proxyCount, ...rest } = item
  void _proxyCount

  return {
    ...rest,
    proxyMethod: 'choose',
  }
}

export function toEcommerceRequestFields(info: EcommerceBasicInfo, options: unknown[] = []): EcommerceRequestFields {
  const platformUserName = info.platformUserName.trim()
  const platformPassword = info.platformPassword.trim()
  const accountPlatform = normalizeAccountPlatform(info.accountPlatform)

  const formattedProxyList = info.proxyInfoList?.length
    ? info.proxyInfoList.map(formatProxyInfoListItem)
    : undefined

  const chooseDeviceFields = formattedProxyList?.length
    ? buildChooseDeviceFields({
        moduleId: formattedProxyList[0].id as string | number,
        lastCity: formattedProxyList[0].lastCity as string | undefined,
        lastCountry: formattedProxyList[0].lastCountry as string | undefined,
        lastIp: formattedProxyList[0].lastIp as string | undefined,
      })
    : buildChooseDeviceFields({
        moduleId: info.moduleId!,
        lastCity: info.deviceInfo?.lastCity,
        lastCountry: info.deviceInfo?.lastCountry,
        lastIp: info.deviceInfo?.lastIp,
      })

  return {
    windowName: info.windowName.trim(),
    ...(formattedProxyList?.length ? { proxyInfoList: formattedProxyList } : {}),
    ...chooseDeviceFields,
    windowPlatformList: buildWindowPlatformList({
      accountPlatform,
      platformUserName,
      platformPassword,
      customPlatformUrl: info.customPlatformUrl,
    }, options),
  }
}

export function createEcommerceWindowAccordions(): Accordions {
  return {
    value: [],
    panels: [
      {
        title: $t('浏览器环境配置'),
        value: 'environment',
        groupIndex: 0,
        placement: 'accordion',
        variant: 'window',
        excludedFields: ECOMMERCE_EXCLUDED_WINDOW_FIELDS,
      },
      ...[$t('基础设置'), $t('高级指纹设置'), $t('偏好设置')]
        .map((title, index) => ({
          title,
          value: `settings-${index}`,
          groupIndex: index + 1,
          placement: 'accordion' as const,
        })),
    ],
  }
}
