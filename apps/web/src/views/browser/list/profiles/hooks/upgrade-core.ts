import { isChromiumCoreUnsupported } from '@roxy/shared'
import { CoreType } from '/@/enums'

/** 参与内核升级规划的窗口字段 */
export interface UpgradeCoreRow {
  id?: number
  windowSortNum?: number
  windowName?: string
  coreType?: string
  coreVersion?: string
  os?: string
  osVersion?: string
}

/** 本机可选用的内核版本，以及宿主系统信息（用于排除不兼容的 Chromium） */
export interface CoreVersionCatalog {
  chrome: string[]
  firefox: string[]
  systemOs?: string
  systemOsVersion?: string
}

/** 同一目标内核版本的一批窗口 */
export interface UpgradeCoreGroup {
  coreType: CoreType
  coreVersion: string
  ids: number[]
  rows: UpgradeCoreRow[]
}

/** 无可升级窗口时区分「已经是最新」和「没有可用内核」 */
export type UpgradeCorePlan
  = | { status: 'ready', groups: UpgradeCoreGroup[] }
    | { status: 'latest' }
    | { status: 'unavailable' }

/** Win7 / Win8 指纹只允许 109，与创建窗口表单保持一致 */
const LEGACY_WINDOWS_CORE = '109'

/** 弹窗里最多列出的窗口标识数量，其余用省略号收起 */
const MAX_VISIBLE_NAMES = 10

/** 归一化内核类型，缺省视为 Chrome */
export function normalizeUpgradeCoreType(coreType?: string): CoreType {
  return coreType === CoreType.Firefox ? CoreType.Firefox : CoreType.Chrome
}

/** 版本号降序；字典顺序不稳定时仍取数值最大的作为升级目标 */
function sortVersionsDesc(versions: string[]) {
  return [...versions].sort((a, b) => Number(b) - Number(a))
}

/** 指纹系统是 Windows 7 / 8 时，Chrome 只能停在 109 */
function isLegacyWindowsProfile(os?: string, osVersion?: string) {
  return os?.toLocaleLowerCase() === 'windows' && ['7', '8'].includes(osVersion?.at(0) ?? '')
}

/**
 * 该窗口在当前宿主和指纹系统下能用的最高内核版本。
 * 不代表一定需要升级；调用方再和现有版本比较。
 */
export function resolveLatestCompatibleCoreVersion(row: UpgradeCoreRow, catalog: CoreVersionCatalog) {
  const coreType = normalizeUpgradeCoreType(row.coreType)
  let versions = coreType === CoreType.Firefox ? catalog.firefox : catalog.chrome

  if (coreType === CoreType.Chrome && isLegacyWindowsProfile(row.os, row.osVersion)) {
    versions = versions.filter(version => version === LEGACY_WINDOWS_CORE)
  }

  if (coreType === CoreType.Chrome) {
    versions = versions.filter(version => !isChromiumCoreUnsupported(
      catalog.systemOs,
      catalog.systemOsVersion,
      coreType,
      version,
    ))
  }

  const [latest] = sortVersionsDesc(versions.filter(Boolean))
  return latest
}

/** 只向更高版本升级，避免把窗口降到本机字典里更低的版本 */
export function isNewerCoreVersion(current: string | undefined, target: string) {
  const next = Number.parseInt(target, 10)
  if (!Number.isFinite(next)) {
    return false
  }

  const previous = Number.parseInt(current ?? '', 10)
  if (!Number.isFinite(previous)) {
    return true
  }

  return next > previous
}

/**
 * 按目标内核类型和版本分组。
 * 批量接口一次只能写一个 coreVersion，Chrome / Firefox 或 Win7 限制必须拆开提交。
 */
export function planCoreUpgrades(rows: UpgradeCoreRow[], catalog: CoreVersionCatalog): UpgradeCorePlan {
  const groups = new Map<string, UpgradeCoreGroup>()
  let hasCompatibleVersion = false

  for (const row of rows) {
    if (row.id == null) {
      continue
    }

    const target = resolveLatestCompatibleCoreVersion(row, catalog)
    if (!target) {
      continue
    }

    hasCompatibleVersion = true
    if (!isNewerCoreVersion(row.coreVersion, target)) {
      continue
    }

    const coreType = normalizeUpgradeCoreType(row.coreType)
    const key = `${coreType}:${target}`
    const group = groups.get(key) ?? { coreType, coreVersion: target, ids: [], rows: [] }
    group.ids.push(row.id)
    group.rows.push(row)
    groups.set(key, group)
  }

  if (groups.size) {
    return { status: 'ready', groups: [...groups.values()] }
  }

  return { status: hasCompatibleVersion ? 'latest' : 'unavailable' }
}

/** 生成 UA / WebGL 时需要和目标内核版本一起交给接口的窗口字段 */
export interface UaRefreshSource {
  os?: string
  osVersion?: string
  browserVersion?: string
  coreType?: string
}

/** 同一套系统、浏览器版本、内核类型可以一次批量取指纹 */
export interface UaRefreshBatch {
  os: string
  osVersion?: string
  browserVersion?: string
  coreType: CoreType
  coreVersion: string
  /** 在本次升级分组里的下标，回填时必须和窗口顺序对齐 */
  indexes: number[]
}

/**
 * 按创建表单的 setUaWebgl 入参分组。
 * 缺操作系统时返回 undefined：没有它就无法生成与新内核匹配的 UA。
 */
export function groupUaRefreshBatches(rows: UaRefreshSource[], coreVersion: string): UaRefreshBatch[] | undefined {
  const batches = new Map<string, UaRefreshBatch>()

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!
    if (!row.os) {
      return undefined
    }

    const coreType = normalizeUpgradeCoreType(row.coreType)
    const osVersion = row.osVersion || undefined
    const browserVersion = row.browserVersion || undefined
    const key = [coreType, coreVersion, row.os, osVersion ?? '', browserVersion ?? ''].join('\0')
    const batch = batches.get(key) ?? {
      os: row.os,
      osVersion,
      browserVersion,
      coreType,
      coreVersion,
      indexes: [],
    }
    batch.indexes.push(index)
    batches.set(key, batch)
  }

  return [...batches.values()]
}

/** 内核版本变更后需要一起写回的指纹字段，对应 setUaWebgl 的回填结果 */
export interface KernelFingerprintPatch {
  userAgent?: string
  webGLManufacturer?: string
  webGLRender?: string
}

/**
 * 把批量接口返回的指纹按原窗口顺序放好。
 * 数量不够或缺少 UA 时返回 undefined，避免只改内核版本号。
 */
export function placeFingerprintPatches(
  size: number,
  placements: { indexes: number[], patches: KernelFingerprintPatch[] }[],
): KernelFingerprintPatch[] | undefined {
  const slots: Array<KernelFingerprintPatch | undefined> = Array.from({ length: size })

  for (const { indexes, patches } of placements) {
    if (patches.length < indexes.length) {
      return undefined
    }
    indexes.forEach((index, offset) => {
      const patch = patches[offset]
      if (!patch?.userAgent) {
        return
      }
      slots[index] = {
        userAgent: patch.userAgent,
        webGLManufacturer: patch.webGLManufacturer,
        webGLRender: patch.webGLRender,
      }
    })
  }

  if (slots.some(slot => !slot?.userAgent)) {
    return undefined
  }

  return slots as KernelFingerprintPatch[]
}

/** 与「移动项目」弹窗同一套窗口标识：工作区名-编号，超出数量省略 */
export function formatUpgradeProfileNames(workspaceName: string, rows: UpgradeCoreRow[]) {
  const names = rows.slice(0, MAX_VISIBLE_NAMES).map((row) => {
    if (row.windowSortNum != null) {
      return `${workspaceName}-${row.windowSortNum}`
    }
    return row.windowName || ''
  }).filter(Boolean).join(', ')

  return `${names}${rows.length > MAX_VISIBLE_NAMES ? '...' : ''}`
}
