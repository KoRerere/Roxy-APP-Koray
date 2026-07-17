import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'

export type ProviderJumpItem = Pick<UserGetProxyVendorListListData['data'][number], 'id' | 'jumpInfo' | 'isJump'>

/** 第三方合作商跳转：无 token 直跳、已有 apiKey、或注册后携带 token 跳转 */
export function useProviderJump() {
  const [showToast, onlyErrorToast] = useResponseToast()

  /** 是否为跳转型合作商（非站内购买流程） */
  function isProviderJump(item?: ProviderJumpItem | null): item is ProviderJumpItem {
    return !!(item?.isJump || item?.jumpInfo?.jumpUrl)
  }

  /**
   * 执行第三方合作商跳转
   * @returns 是否已按跳转流程处理（含失败 toast），调用方应跳过后续购买逻辑
   */
  async function jumpToProvider(item: ProviderJumpItem): Promise<boolean> {
    if (!isProviderJump(item))
      return false

    const { jumpInfo } = item
    if (!jumpInfo?.jumpUrl)
      return false

    // 不需要 token 的第三方合作商
    if (!jumpInfo.isToken) {
      window.open(jumpInfo.jumpUrl, '_blank')
      return true
    }

    if (jumpInfo.apiKey) {
      const url = new URL(jumpInfo.jumpUrl)
      url.searchParams.set('token', jumpInfo.apiKey)
      window.open(url.toString(), '_blank')
      return true
    }

    const result = await API.proxy.userRegisterProxyProviderUserCreate({ proxyProviderId: item.id! })

    if (result.code === 0) {
      const url = new URL(jumpInfo.jumpUrl)
      url.searchParams.set('token', result.data)
      Reflect.set(jumpInfo, 'apiKey', result.data)
      window.open(url.toString(), '_blank')
      return true
    }

    if (result.code === 466) {
      window.open(jumpInfo.jumpUrl, '_blank')
      showToast(466, $t('账号已存在，请联系技术支持！'))
      return true
    }

    onlyErrorToast(result.code, result.msg)
    return true
  }

  return {
    isProviderJump,
    jumpToProvider,
  }
}
