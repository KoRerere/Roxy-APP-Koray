import { useProxyStore } from '/@/stores/proxy'
import { useProviderJump } from './useProviderJump'

/** 供应商列表中的 Rola-IP 厂商名 */
const ROLA_VENDOR_NAME = 'Rola-IP'

/**
 * 打开 Rola-IP。
 * 入口只负责触发，厂商查找和 token 跳转集中在这里，避免每个入口各写一套。
 */
export function useRolaJump() {
  const { getProxyVendors } = useProxyStore()
  const { jumpToProvider } = useProviderJump()

  /** 按厂商名找到 Rola-IP 后走第三方跳转；找不到时返回 false */
  async function jumpToRola() {
    const vendors = await getProxyVendors()
    const rola = vendors?.find(item => item.vendorName === ROLA_VENDOR_NAME)
    if (!rola) {
      return false
    }
    return jumpToProvider(rola)
  }

  return { jumpToRola }
}
