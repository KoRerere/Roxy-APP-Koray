import type { UserGetProxyVendorListListData, UserRegisterProxyProviderUserV2CreateData } from '@roxy/backend-api'
import { h } from 'vue'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import ProxyTrafficUnlockedModal from '/@/views/agent/shop/components/proxy-traffic-unlocked-modal.vue'

export type ProviderJumpItem = Pick<UserGetProxyVendorListListData['data'][number], 'id' | 'jumpInfo' | 'isJump'>

/** 注册成功时的赠送结果，决定弹窗展示优惠券还是流量包 */
type ProviderRegisterResult = NonNullable<UserRegisterProxyProviderUserV2CreateData['data']>

/** 第三方合作商跳转：无 token 直跳、已有 apiKey、或注册后携带 token 跳转 */
export function useProviderJump() {
  const [showToast, onlyErrorToast] = useResponseToast()
  const [showModal] = useDialog()

  /**
   * 注册成功后先按赠送结果展示奖励。
   * 跳转放在关闭回调里同步执行，避免 await 之后被浏览器拦截新窗口。
   */
  function openRewardThenJump(url: string, gift: ProviderRegisterResult) {
    return new Promise<void>((resolve) => {
      let jumped = false
      const jump = () => {
        if (jumped) {
          return
        }
        jumped = true
        window.open(url, '_blank')
        resolve()
      }

      showModal({
        showHeader: false,
        modal: true,
        blockScroll: true,
        style: { width: '480px' },
        pt: {
          content: '!p-0',
        },
        beforeClose: () => {
          jump()
        },
        slots: {
          container: ({ hideModal }) => h(ProxyTrafficUnlockedModal, {
            giftType: gift.giftType,
            giftInfo: gift.giftInfo,
            onClose: () => {
              void hideModal()
            },
            onClaim: () => {
              void hideModal()
            },
          }),
        },
      })
    })
  }

  /** 是否为跳转型合作商（非站内购买流程） */
  function isProviderJump(item?: ProviderJumpItem | null): item is ProviderJumpItem {
    return !!(item?.isJump || item?.jumpInfo?.jumpUrl)
  }

  /**
   * 执行第三方合作商跳转。
   * @param targetUrl 覆盖厂商首页，动态代理类型卡片用自己的购买页
   * @returns 是否已按跳转流程处理（含失败 toast），调用方应跳过后续购买逻辑
   */
  async function jumpToProvider(item: ProviderJumpItem, targetUrl?: string): Promise<boolean> {
    if (!isProviderJump(item)) {
      return false
    }

    const { jumpInfo } = item
    // 购买页地址优先，登录 token 仍取自厂商 jumpInfo
    const jumpUrl = targetUrl || jumpInfo?.jumpUrl
    if (!jumpUrl) {
      return false
    }

    // 不需要 token 的第三方合作商
    if (!jumpInfo?.isToken) {
      window.open(jumpUrl, '_blank')
      return true
    }

    if (jumpInfo.apiKey) {
      API.userReportRolaJumpClick.userReportRolaJumpClickCreate()
      const url = new URL(jumpUrl)
      url.searchParams.set('token', jumpInfo.apiKey)
      window.open(url.toString(), '_blank')
      return true
    }

    const result = await API.proxy.userRegisterProxyProviderUserV2Create({ proxyProviderId: item.id! })

    const registerData = result.data
    if (result.code === 0 && registerData?.apiKey) {
      const url = new URL(jumpUrl)
      url.searchParams.set('token', registerData.apiKey)
      Reflect.set(jumpInfo, 'apiKey', registerData.apiKey)
      await openRewardThenJump(url.toString(), registerData)
      return true
    }

    if (result.code === 0) {
      onlyErrorToast(result.code, result.msg)
      return true
    }

    if (result.code === 466) {
      window.open(jumpUrl, '_blank')
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
