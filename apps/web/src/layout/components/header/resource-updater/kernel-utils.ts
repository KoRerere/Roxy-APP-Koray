/**
 * 内核升级相关工具函数
 *
 * Chrome / Firefox 可能存在相同的 coreVersion（如 109），
 * 因此所有匹配、排序、已读标记、使用中检测都基于 coreType + coreVersion 组合键。
 */
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { CoreType } from '/@/enums'
import { safeParseJSON } from '/@/utils'

/** 带 UI 状态的内核更新条目 */
export type KernelUpdateItem = ResourceUpdateMessage & {
  /** 是否高亮显示（未读的新版本/可更新） */
  _light?: boolean
  /** 高亮时的描述文案 */
  _desc?: string
}

/** localStorage 中存储内核已读状态的 key */
const KERNEL_READ_MAP_KEY = 'kernel-read-map'

/** 列表排序时 Chrome 排在 Firefox 前面 */
const CORE_TYPE_ORDER: Record<CoreType, number> = {
  [CoreType.Chrome]: 0,
  [CoreType.Firefox]: 1,
}

/** 归一化内核类型，缺省视为 Chrome */
export function normalizeCoreType(coreType?: string): CoreType {
  return coreType === CoreType.Firefox ? CoreType.Firefox : CoreType.Chrome
}

/** 生成内核唯一标识，格式：`Chrome:109` / `Firefox:128` */
export function getKernelKey(item: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>): string {
  return `${normalizeCoreType(item.coreType)}:${item.coreVersion ?? ''}`
}

/** 判断两条内核记录是否指向同一内核 */
export function matchKernelItem(
  a: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>,
  b: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>,
): boolean {
  return a.coreVersion === b.coreVersion && normalizeCoreType(a.coreType) === normalizeCoreType(b.coreType)
}

/** 先按内核类型分组，同类型内按版本号降序排列 */
export function sortKernelList<T extends Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const typeDiff = CORE_TYPE_ORDER[normalizeCoreType(b.coreType)] - CORE_TYPE_ORDER[normalizeCoreType(a.coreType)]
    if (typeDiff !== 0)
      return typeDiff
    return Number(b.coreVersion) - Number(a.coreVersion)
  })
}

/** 格式化内核显示名称，如 `RoxyChrome 109` */
export function formatKernelName(coreType?: string, coreVersion?: string): string {
  const type = normalizeCoreType(coreType)
  const brand = type === CoreType.Firefox ? 'RoxyFirefox' : 'RoxyChrome'
  return `${brand} ${coreVersion ?? ''}`
}

export function isFirefoxCore(coreType?: string): boolean {
  return normalizeCoreType(coreType) === CoreType.Firefox
}

export function isChromeCore(coreType?: string): boolean {
  return normalizeCoreType(coreType) === CoreType.Chrome
}

/** 获取内核已读映射，key 为 getKernelKey 格式 */
export function getKernelReadMap(): Record<string, boolean> {
  return safeParseJSON(localStorage.getItem(KERNEL_READ_MAP_KEY) || '{}')
}

/** 标记内核为已读，清除高亮状态 */
export function markKernelAsRead(item: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>) {
  const readMap = getKernelReadMap()
  readMap[getKernelKey(item)] = true
  localStorage.setItem(KERNEL_READ_MAP_KEY, JSON.stringify(readMap))
}

/** 清除已读标记（下载完成后重新进入"有新内容"分组） */
export function clearKernelRead(item: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>) {
  const readMap = getKernelReadMap()
  Reflect.deleteProperty(readMap, getKernelKey(item))
  localStorage.setItem(KERNEL_READ_MAP_KEY, JSON.stringify(readMap))
}

export function isKernelRead(item: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>): boolean {
  return !!getKernelReadMap()[getKernelKey(item)]
}

/** browser:usingCores 返回值，Electron 按 coreType 分组返回原始 coreVersion */
export interface UsingCoreVersions {
  chrome: string[]
  firefox: string[]
}

/** 将分组的使用中版本转换为 web 端组合键列表，如 `Chrome:109` */
export function toUsingKernelKeys(usingCores: UsingCoreVersions): string[] {
  return [
    ...usingCores.chrome.map(coreVersion => getKernelKey({ coreType: CoreType.Chrome, coreVersion })),
    ...usingCores.firefox.map(coreVersion => getKernelKey({ coreType: CoreType.Firefox, coreVersion })),
  ]
}

/** 拉取正在使用中的内核版本 */
export async function fetchUsingCoreVersions(): Promise<UsingCoreVersions> {
  return globalThis.electronAPI.send('browser:usingCores')
}

/**
 * 判断内核是否正在被浏览器窗口使用
 * Electron 返回按 coreType 分组的 coreVersion，此处根据 item.coreType 匹配对应列表
 */
export function isKernelInUse(
  usingCores: UsingCoreVersions,
  item: Pick<ResourceUpdateMessage, 'coreVersion' | 'coreType'>,
): boolean {
  if (!item.coreVersion)
    return false

  // 兼容旧版本 APP 返回值为数组
  if (Array.isArray(usingCores)) {
    return usingCores.includes(item.coreVersion)
  }

  if (isFirefoxCore(item.coreType)) {
    return usingCores.firefox.includes(item.coreVersion)
  }

  return usingCores.chrome.includes(item.coreVersion)
}
