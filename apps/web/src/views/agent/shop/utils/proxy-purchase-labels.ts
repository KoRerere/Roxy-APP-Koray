import { computed, inject, provide, toValue } from 'vue'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue'
import { getDevicePurchaseNotes, getProxyPurchaseNotes } from './proxy-purchase-notes'
import type { ProxyPurchaseNote } from './proxy-purchase-notes'

export type ProxyPurchaseMode = 'proxy' | 'device'

/** 购买弹窗文案：代理 IP 与电商设备模式共用同一套组件 */
export interface ProxyPurchaseLabels {
  mode: ProxyPurchaseMode
  /** 电商模式隐藏「大陆直连」等业务 badge */
  hideDirectTag: boolean
  /** 电商模式隐藏用途选项下的限时促销文案 */
  hideSpecialOfferHint: boolean
  entityType: string
  entityInfo: string
  entityBandwidth: string
  entityQuantity: string
  entityPrice: string
  entityQuantityLabel: string
  /**
   * entityUsage: string
   */
  /**
   * selectCountry: string
   */
  cnNetworkAlert: string
  specialOfferNote: string
  bandwidthUpgradeTooltip: string
  notes: ProxyPurchaseNote[]
}

interface ProxyPurchaseLabelsBase {
  entityType: string
  entityInfo: string
  entityBandwidth: string
  entityQuantity: string
  entityPrice: string
  entityQuantityLabel: string
  /**
   * entityUsage: string
   */
  /**
   * selectCountry: string
   */
  cnNetworkAlert: string
  specialOfferNote: string
  bandwidthUpgradeTooltip: string
  getNotes: () => ProxyPurchaseNote[]
}

const PROXY_PURCHASE_LABELS: ProxyPurchaseLabelsBase = {
  entityType: $t('代理 IP 类型'),
  entityInfo: $t('代理 IP 信息'),
  entityBandwidth: $t('代理 IP 带宽'),
  entityQuantity: $t('代理 IP 数量'),
  entityPrice: $t('代理 IP 价格'),
  entityQuantityLabel: $t('代理 IP 数量:'),
  // entityUsage: $t('用途:'),
  // selectCountry: $t('国家/地区:'),
  cnNetworkAlert: $t('检测到您当前网络环境位于中国大陆，当前代理 IP 暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。'),
  specialOfferNote: $t('请注意：当前代理 IP 为特价商品，不退不换'),
  bandwidthUpgradeTooltip: $t('当前仅支持美国、香港、法国和日本的超高质量代理 IP 进行带宽升级。'),
  getNotes: getProxyPurchaseNotes,
}

const DEVICE_PURCHASE_LABELS: ProxyPurchaseLabelsBase = {
  entityType: $t('设备类型'),
  entityInfo: $t('设备信息'),
  entityBandwidth: $t('设备带宽'),
  entityQuantity: $t('设备数量'),
  entityPrice: $t('设备价格'),
  entityQuantityLabel: $t('设备数量:'),
  // entityUsage: $t('用途:'),
  // selectCountry: $t('国家/地区:'),
  cnNetworkAlert: $t('检测到您当前网络环境位于中国大陆，当前设备暂不支持直连，请切换至海外网络后使用。\nRoxy 持续助力中国互联网环境健康发展，倡导安全、合规的网络环境。'),
  specialOfferNote: $t('请注意：购买后不支持退换'),
  bandwidthUpgradeTooltip: $t('当前仅支持美国、香港、法国和日本的超高质量设备进行带宽升级。'),
  getNotes: getDevicePurchaseNotes,
}

/** 按购买入口模式生成弹窗文案 */
export function createProxyPurchaseLabels(mode: ProxyPurchaseMode): ProxyPurchaseLabels {
  const base = mode === 'device' ? DEVICE_PURCHASE_LABELS : PROXY_PURCHASE_LABELS
  return {
    mode,
    hideDirectTag: mode === 'device',
    hideSpecialOfferHint: mode === 'device',
    entityType: base.entityType,
    entityInfo: base.entityInfo,
    entityBandwidth: base.entityBandwidth,
    entityQuantity: base.entityQuantity,
    entityPrice: base.entityPrice,
    entityQuantityLabel: base.entityQuantityLabel,
    // entityUsage: base.entityUsage,
    // // selectCountry: base.selectCountry,
    cnNetworkAlert: base.cnNetworkAlert,
    specialOfferNote: base.specialOfferNote,
    bandwidthUpgradeTooltip: base.bandwidthUpgradeTooltip,
    notes: base.getNotes(),
  }
}

const PROXY_PURCHASE_LABELS_KEY: InjectionKey<ComputedRef<ProxyPurchaseLabels>> = Symbol('proxyPurchaseLabels')

/** 购买弹窗入口：传入 mode 并完成 provide */
export function useProxyPurchaseLabels(mode: MaybeRefOrGetter<ProxyPurchaseMode>): ComputedRef<ProxyPurchaseLabels>
/** 子组件：读取上层 provide 的文案，缺省回退 proxy 模式 */
export function useProxyPurchaseLabels(): ComputedRef<ProxyPurchaseLabels>
export function useProxyPurchaseLabels(mode?: MaybeRefOrGetter<ProxyPurchaseMode>) {
  if (mode !== undefined) {
    const labels = computed(() => createProxyPurchaseLabels(toValue(mode)))
    provide(PROXY_PURCHASE_LABELS_KEY, labels)
    return labels
  }

  return inject(
    PROXY_PURCHASE_LABELS_KEY,
    () => computed(() => createProxyPurchaseLabels('proxy')),
    true,
  )
}
