import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 账号/窗口转移流程文案：普通模式用「窗口/代理 IP/扩展」，电商模式用「账号/设备/插件」 */
export interface TransferEntityLabels {
  transferTempTab: string
  entityNameOption: string
  entityRemarkOption: string
  deleteEntityAfterTransfer: string
  deleteOrphanProxyOnTransfer: string
  transferHasPurchasedProxy: string
  deleteOrphanPlatformOnTransfer: string
  /** i18n-t keypath：转移将发送的数据说明（含 {bold}） */
  transferIncludesKeypath: string
  transferIncludesBold: string
  /** i18n-t keypath：转移无法发送的内容（含 {bold2}） */
  transferExcludesBold: string
  deleteProxyOnlyBoundToEntity: string
  deleteProxyBoundToMultipleKeep: string
  deleteProxyBoundToMultipleRemove: string
  platformDeleteSameAsProxy: string
  /** i18n-t keypath：转移不可撤销（含 bold1/bold2/bold3） */
  transferIrreversibleKeypath: string
  transferBlockedDuringProcess: string
  entityProxyOption: string
  entityPlatformOption: string
  proxyTestFailedBeforeTransfer: string
  someEntitiesMissingProxy: string
  someEntitiesMissingPlatform: string
  someEntitiesMissingProxyOrPlatform: string
  /** i18n-t keypath：必须包含 proxy 或 platform（含 bold1/bold2） */
  mustIncludeProxyOrPlatformKeypath: string
  proxyBold: string
  tempEntityValidity: string
  tempEntityValidityTooltip: string
  afterTransferMovedToRecycle: string
}

/** 按 workspace 模式生成转移流程文案 */
export function createTransferEntityLabels(isEcommerce: boolean): TransferEntityLabels {
  if (isEcommerce) {
    return {
      transferTempTab: $t('转移临时账号'),
      entityNameOption: $t('账号名称'),
      entityRemarkOption: $t('账号备注'),
      deleteEntityAfterTransfer: $t('转移后彻底删除账号（该操作无法撤销）'),
      deleteOrphanProxyOnTransfer: $t('同时删除设备资源中仅与转移账号有绑定关系的设备'),
      transferHasPurchasedProxy: $t('转移账号中存在购买设备'),
      deleteOrphanPlatformOnTransfer: $t('同时删除平台账号中仅与转移账号有绑定关系的账号'),
      transferIncludesKeypath: $t('账号转移将发送您所选账号{bold}，但无法发送{bold2}。', { bold: '{bold}', bold2: '{bold2}' }),
      transferIncludesBold: $t('已同步过的云端数据、设备信息、平台账号、Cookies 和指纹参数等'),
      transferExcludesBold: $t('插件应用，需要接收方手动安装'),
      deleteProxyOnlyBoundToEntity: $t('若设备 a 仅与账号 A 绑定，账号 A 被转移，则设备 a 将从设备资源中删除'),
      deleteProxyBoundToMultipleKeep: $t('若设备 a 与账号 A、B 绑定，仅账号 A 被转移，则设备 a 不会被删除'),
      deleteProxyBoundToMultipleRemove: $t('若设备 a 与账号 A、B 绑定，账号 A、B 均被转移，则设备 a 将从设备资源中删除'),
      platformDeleteSameAsProxy: $t('(平台账号删除规则同设备)'),
      transferIrreversibleKeypath: $t('转移无法撤销，若{bold1}或{bold2}，则所有账号自动退回。{bold3}', { bold1: '{bold1}', bold2: '{bold2}', bold3: '{bold3}' }),
      transferBlockedDuringProcess: $t('转移过程中账号无法被操作。'),
      entityProxyOption: $t('账号设备'),
      entityPlatformOption: $t('账号平台账号'),
      proxyTestFailedBeforeTransfer: $t('部分账号设备检测失败，请确保设备测试均正常或删除检测失败的设备后再继续操作'),
      someEntitiesMissingProxy: $t('部分账号缺少设备'),
      someEntitiesMissingPlatform: $t('部分账号缺少平台账号'),
      someEntitiesMissingProxyOrPlatform: $t('部分账号缺少设备或平台账号'),
      mustIncludeProxyOrPlatformKeypath: $t('转移的账号必须包含 {bold1} 或 {bold2}', { bold1: '{bold1}', bold2: '{bold2}' }),
      proxyBold: $t('设备'),
      tempEntityValidity: $t('临时账号有效期'),
      tempEntityValidityTooltip: $t('临时账号过期之前均可以正常使用，过期后如用量不足则无法打开，但账号信息（平台账号、设备等）均能正常导出。'),
      afterTransferMovedToRecycle: $t('* 完成账号转移后，账号将被移至回收站。'),
    }
  }

  return {
    transferTempTab: $t('转移临时窗口'),
    entityNameOption: $t('窗口名称'),
    entityRemarkOption: $t('窗口备注'),
    deleteEntityAfterTransfer: $t('转移后彻底删除窗口（该操作无法撤销）'),
    deleteOrphanProxyOnTransfer: $t('同时删除代理 IP 资源中仅与转移窗口有绑定关系的代理 IP'),
    transferHasPurchasedProxy: $t('转移窗口中存在购买代理 IP'),
    deleteOrphanPlatformOnTransfer: $t('同时删除平台账号中仅与转移窗口有绑定关系的账号'),
    transferIncludesKeypath: $t('窗口转移将发送您所选窗口{bold}，但无法发送{bold2}。', { bold: '{bold}', bold2: '{bold2}' }),
    transferIncludesBold: $t('已同步过的云端数据、代理 IP 信息、平台账号、Cookies 和指纹参数等'),
    transferExcludesBold: $t('扩展应用，需要接收方手动安装'),
    deleteProxyOnlyBoundToEntity: $t('若代理 IP a 仅与窗口 A 绑定，窗口 A 被转移，则代理 IP a 将从代理 IP 资源中删除'),
    deleteProxyBoundToMultipleKeep: $t('若代理 IP a 与窗口 A、B 绑定，仅窗口 A 被转移，则代理 IP a 不会被删除'),
    deleteProxyBoundToMultipleRemove: $t('若代理 IP a 与窗口 A、B 绑定，窗口 A、B 均被转移，则代理 IP a 将从代理 IP 资源中删除'),
    platformDeleteSameAsProxy: $t('(平台账号删除规则同代理 IP)'),
    transferIrreversibleKeypath: $t('转移无法撤销，若{bold1}或{bold2}，则所有窗口自动退回。{bold3}', { bold1: '{bold1}', bold2: '{bold2}', bold3: '{bold3}' }),
    transferBlockedDuringProcess: $t('转移过程中窗口无法被操作。'),
    entityProxyOption: $t('窗口代理 IP'),
    entityPlatformOption: $t('窗口平台账号'),
    proxyTestFailedBeforeTransfer: $t('部分窗口代理 IP 检测失败，请确保代理 IP 测试均正常或删除检测失败的代理 IP 后再继续操作'),
    someEntitiesMissingProxy: $t('部分窗口缺少代理 IP'),
    someEntitiesMissingPlatform: $t('部分窗口缺少平台账号'),
    someEntitiesMissingProxyOrPlatform: $t('部分窗口缺少代理 IP 或平台账号'),
    mustIncludeProxyOrPlatformKeypath: $t('转移的窗口必须包含 {bold1} 或 {bold2}', { bold1: '{bold1}', bold2: '{bold2}' }),
    proxyBold: $t('代理 IP'),
    tempEntityValidity: $t('临时窗口有效期'),
    tempEntityValidityTooltip: $t('临时窗口过期之前均可以正常使用，过期后如用量不足则无法打开，但窗口信息（账号、代理 IP 等）均能正常导出。'),
    afterTransferMovedToRecycle: $t('* 完成窗口转移后，窗口将被移至回收站。'),
  }
}

/** 组件内按当前 workspace 类型读取转移文案 */
export function useTransferEntityLabels(): ComputedRef<TransferEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createTransferEntityLabels(isEcommerce.value))
}
