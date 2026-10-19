import { h } from 'vue'
import UpgradeCoreDialog from '/@/views/browser/list/profiles/components/upgrade-core-dialog.vue'
import { API } from '/@/api'
import type { UserGetUaWebglV2ListParams } from '@roxy/backend-api'
import { getCommonHeaders } from '/@/api/util'
import { CoreType } from '/@/enums'
import { useDialog } from '/@/hooks/useDialog'
import { getDictMap } from '/@/utils'
import {
  formatUpgradeProfileNames,
  groupUaRefreshBatches,
  normalizeUpgradeCoreType,
  placeFingerprintPatches,
  planCoreUpgrades,
} from './upgrade-core'
import type { CoreVersionCatalog, KernelFingerprintPatch, UaRefreshSource, UpgradeCoreGroup, UpgradeCoreRow } from './upgrade-core'

/** 字典版本与本机内核列表求交；列表为空时退回字典，避免 Web 环境完全不可升级 */
async function loadCoreVersionCatalog(): Promise<CoreVersionCatalog> {
  const [$dict_map, coreList, headers] = await Promise.all([
    getDictMap(),
    globalThis.electronAPI.send('app:getCoreList'),
    getCommonHeaders(),
  ])
  const cores = coreList ?? []

  const availableChrome = new Set(
    cores
      .filter(item => normalizeUpgradeCoreType(item.coreType) === CoreType.Chrome)
      .map(item => item.coreVersion)
      .filter((version): version is string => !!version),
  )
  const availableFirefox = new Set(
    cores
      .filter(item => normalizeUpgradeCoreType(item.coreType) === CoreType.Firefox)
      .map(item => item.coreVersion)
      .filter((version): version is string => !!version),
  )

  const chromeDict = ($dict_map.coreVersion ?? []).map(item => item.value).filter(Boolean)
  const firefoxDict = ($dict_map.firefoxCoreVersion ?? []).map(item => item.value).filter(Boolean)

  return {
    chrome: availableChrome.size ? chromeDict.filter(version => availableChrome.has(version)) : chromeDict,
    firefox: availableFirefox.size ? firefoxDict.filter(version => availableFirefox.has(version)) : firefoxDict,
    systemOs: headers['R-OS'],
    systemOsVersion: headers.osVersion,
  }
}

/** 详情接口按 id 过滤时单次不要过大，避免分页把部分窗口截掉 */
const WINDOW_DETAIL_PAGE_SIZE = 100

interface WindowCoreDetail extends UaRefreshSource {
  id?: number
}

interface UseUpgradeCoreOptions {
  batchModifyWindow: (params: { ids: number[], coreVersion: string, fingerDetail: KernelFingerprintPatch[] }, silent?: boolean) => Promise<void>
  onlyErrorToast: (code: number, msg: string) => void
  showToast: (code: number, msg: string) => void
  /** 与列表其他批量弹窗一致，使用带前缀的工作区名 */
  getWorkspaceName: () => string
}

/** 列表行没有浏览器版本，升级前用窗口详情补齐 setUaWebgl 需要的入参 */
async function loadWindowCoreDetails(ids: number[], onlyErrorToast: UseUpgradeCoreOptions['onlyErrorToast']) {
  const details: WindowCoreDetail[] = []

  for (let offset = 0; offset < ids.length; offset += WINDOW_DETAIL_PAGE_SIZE) {
    const slice = ids.slice(offset, offset + WINDOW_DETAIL_PAGE_SIZE)
    const result = await API.window.userGetWindowInfoV2List({
      windowIds: slice.join(','),
      isDelete: 0,
      page_index: 1,
      page_size: slice.length,
    })
    if (result.code !== 0) {
      onlyErrorToast(result.code, result.msg)
      throw new Error(result.msg)
    }
    details.push(...(result.data?.rows ?? []))
  }

  return details
}

/**
 * 对齐创建表单里内核版本 change → setUaWebgl：
 * 新 coreVersion 必须和按该版本重新生成的 UA、WebGL 厂商、WebGL 渲染一起提交。
 */
async function buildKernelFingerprintPatches(
  group: UpgradeCoreGroup,
  onlyErrorToast: UseUpgradeCoreOptions['onlyErrorToast'],
) {
  const details = await loadWindowCoreDetails(group.ids, onlyErrorToast)
  const detailById = new Map(details.map(item => [item.id, item]))
  const sources = group.rows.map(row => detailById.get(row.id))
  const batches = sources.every(Boolean)
    ? groupUaRefreshBatches(sources as UaRefreshSource[], group.coreVersion)
    : undefined

  if (!batches) {
    onlyErrorToast(-1, $t('无法同步内核关联的指纹信息，升级已取消'))
    throw new Error('Missing profile fields required to refresh kernel fingerprint')
  }

  const placements: { indexes: number[], patches: KernelFingerprintPatch[] }[] = []
  for (const batch of batches) {
    const query: UserGetUaWebglV2ListParams = {
      os: batch.os,
      coreVersion: batch.coreVersion,
      // 生成客户端的 coreType 是另一份同值枚举，运行时都是 Chrome / Firefox
      coreType: batch.coreType as unknown as UserGetUaWebglV2ListParams['coreType'],
      count: batch.indexes.length,
      ...(batch.osVersion ? { osVersion: batch.osVersion } : {}),
      ...(batch.browserVersion ? { browserVersion: batch.browserVersion } : {}),
    }
    const result = await API.window.userGetUaWebglV2List(query)
    if (result.code !== 0) {
      onlyErrorToast(result.code, result.msg)
      throw new Error(result.msg)
    }
    placements.push({ indexes: batch.indexes, patches: result.data ?? [] })
  }

  const fingerDetail = placeFingerprintPatches(group.rows.length, placements)
  if (!fingerDetail) {
    onlyErrorToast(-1, $t('无法同步内核关联的指纹信息，升级已取消'))
    throw new Error('Kernel fingerprint refresh returned incomplete data')
  }

  return fingerDetail
}

/** 打开升级确认弹窗，确认后写入新内核版本以及与之匹配的 UA / WebGL */
export function useUpgradeCore(options: UseUpgradeCoreOptions) {
  const [showModal] = useDialog()

  async function onUpgradeCore(rows: UpgradeCoreRow[]) {
    const catalog = await loadCoreVersionCatalog()
    const plan = planCoreUpgrades(rows, catalog)

    if (plan.status === 'unavailable') {
      options.onlyErrorToast(-1, $t('当前没有可升级的内核版本'))
      return
    }
    if (plan.status === 'latest') {
      options.onlyErrorToast(-1, $t('所选窗口已是最新内核'))
      return
    }

    const workspaceName = options.getWorkspaceName()
    const messages = plan.groups.map(group => $t('[{names}]窗口将升级到 {version} 内核版本', {
      names: formatUpgradeProfileNames(workspaceName, group.rows),
      version: `${group.coreType} ${group.coreVersion}`,
    }))

    showModal({
      uniqueKey: 'upgrade-core',
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0',
      },
      slots: {
        container: ({ hideModal }) => h(UpgradeCoreDialog, {
          messages,
          close: hideModal,
          confirmUpgrade: async () => {
            for (const group of plan.groups) {
              const fingerDetail = await buildKernelFingerprintPatches(group, options.onlyErrorToast)
              await options.batchModifyWindow({
                ids: group.ids,
                coreVersion: group.coreVersion,
                fingerDetail,
              }, true)
              group.rows.forEach((row) => {
                row.coreVersion = group.coreVersion
              })
            }
            // 多个内核分组会分批提交，成功提醒只出现一次
            options.showToast(0, $t('升级成功'))
          },
        }),
      },
    })
  }

  return { onUpgradeCore }
}
