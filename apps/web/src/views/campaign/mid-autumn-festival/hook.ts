import currency from 'currency.js'
import LuckyDraw from './lucky-draw/index.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useCampaignStore } from '/@/stores/campaign'
import { useRoleStore } from '/@/stores/role'

/** 中秋充值满送档位 */
type RechargeBenefit = {
  amount: number
  discount: number
}

/**
 * 按档位生成充值加赠文案。
 * 末档强调史诗级加赠，倒数第二档强调狂送，其余沿用普通多得文案。
 */
export function formatRechargeBenefitText(item: RechargeBenefit, index: number, array: readonly RechargeBenefit[]) {
  const amount = currency(item.amount, { precision: 0 }).format()
  const value = currency(item.amount, { precision: 0 }).multiply(item.discount).divide(100).format()
  const params = { amount, value, discount: item.discount }
  const lastIndex = array.length - 1

  if (index === lastIndex) {
    return $t('充 {amount} 送 {value}（史诗级 {discount}% 加赠）', params)
  }
  if (index === lastIndex - 1) {
    return $t('充 {amount} 送 {value}（狂送 {discount}%）', params)
  }
  return $t('充 {amount} 送 {value}（多得 {discount}%）', params)
}

/** 中秋活动：抽奖盘与相关弹窗入口 */
export function useMidAutumnActivity() {
  const [showModal] = useDialog()
  const campaignStore = useCampaignStore()
  const { isOwner } = storeToRefs(useRoleStore())

  /** 活动期内打开九宫格抽奖盘；非中秋则立刻走 callback */
  function showLuckyDraw(callback?: () => void) {
    if (!campaignStore.seasonalActivity.midAutumnFestival) {
      return callback?.()
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: '!bg-transparent !border-none !shadow-none',
      },
      slots: {
        container: ({ hideModal }) => h(LuckyDraw, {
          hideModal: async () => {
            const closed = await hideModal()
            if (closed) {
              callback?.()
            }
            return closed
          },
          // 出结果时只收起转盘，整段抽奖流程仍由结果弹窗接管
          closeForResult: hideModal,
          reopenLuckyDraw: () => showLuckyDraw(callback),
        }),
      },
    })
  }

  /**
   * 支付弹窗会在当前调用栈结束后才关掉，延后弹出避免抽奖盘被挡住。
   */
  function showLuckyDrawAfterPay(callback?: () => void) {
    if (!isOwner.value) {
      return callback?.()
    }
    setTimeout(() => {
      showLuckyDraw(callback)
    }, 0)
  }

  return {
    showLuckyDraw,
    showLuckyDrawAfterPay,
  }
}
