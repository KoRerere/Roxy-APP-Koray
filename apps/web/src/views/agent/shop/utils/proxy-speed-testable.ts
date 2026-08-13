import { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'

/** 测速资格判定所需的订单 / 过期 / 类型字段（代理列表与设备列表共用） */
export interface ProxySpeedTestableFields {
  orderStatus?: ProxyOrderStatus | number
  proxyExpireStatus?: ProxyExpireStatus | number
  proxyType?: ProxyType | number
}

/**
 * 是否允许测速：排除配置中、已退款；
 * 已购过期不可测，导入（resource）过期仍可测。
 * 代理 IP 列表与设备列表共用同一口径。
 */
export function isProxySpeedTestable(item: ProxySpeedTestableFields): boolean {
  if (item.orderStatus === ProxyOrderStatus.pending)
    return false
  if (item.orderStatus === ProxyOrderStatus.refunded)
    return false
  if (item.proxyExpireStatus === ProxyExpireStatus.expired)
    return item.proxyType === ProxyType.resource
  return true
}
