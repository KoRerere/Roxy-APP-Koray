import BalanceSuccessModal from './components/balance-success.vue'
import PlanSuccessModal from './components/plan-success.vue'
import ProcessingModal from './components/processing-modal.vue'
import UsdtPayModal from './components/payway-usdt-modal.vue'
import WechatPayModal from './components/payway-wechat-modal.vue'
import AlipayPayModal from './components/payway-alipay-modal.vue'
import WalletRechargeModal from '/@/views/pay/wallet/components/wallet-recharge-modal.vue'
import StripePay from '/@/views/pay/wallet/components/stripe-pay.vue'
import RxCheckbox from '/@/components/rx-checkbox/index.vue'
import { useDialog } from 'primevue/usedialog'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useConfirm } from 'primevue/useconfirm'
import { usePopupMenu } from '/@/hooks/usePopupMenu'

import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { useSimpleLocale } from '/@/stores/locale'
import { AutoRechargeStatus, isCardPayWay, OrderType, PaymentStatus, PayWay } from '/@/enums/pay'
import { RxSvgIcon } from '/@/components/rx-icon'
import type { SvgNames } from '/@/components/rx-icon'
import { genPollingChecker } from '/@/utils/basic'
import { openAliyunCaptcha } from '/@/utils/aliyun-captcha'
import type { UserGetBindCardListListData, UserRechargeSettlementCreateData } from '@roxy/backend-api'

import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { useMidAutumnActivity } from '/@/views/campaign/mid-autumn-festival/hook.ts'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { I18nT } from 'vue-i18n'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent.tsx'
import { isMainWindow } from '/@/utils/common'
import { useFirstConsumeReferralPopup } from '/@/views/referral-program/useFirstConsumeReferralPopup'

type Data = UserRechargeSettlementCreateData['data']
/** 钱包充值会带上返回回调，扫码弹窗据此显示返回并重新打开充值弹窗 */
type PayModalData = Data & {
  onBack?: () => void
}
interface ChargeParams {
  next?: (data: PayModalData) => void
  [key: string]: any
}

/** 扫码支付点返回时中断等待，不视为支付失败 */
export const PAY_PROCESSING_BACK = Symbol('pay-processing-back')

const modalMap = {
  [PayWay.Alipay]: (data: Record<string, any>) => data.show_type === 'qrcode' ? markRaw(AlipayPayModal) : markRaw(ProcessingModal),
  [PayWay.Wechat]: () => markRaw(WechatPayModal),
  [PayWay.USDT]: () => markRaw(UsdtPayModal),
  [PayWay.USDC]: () => markRaw(UsdtPayModal),
}

export function usePay() {
  const router = useRouter()
  const dialog = useDialog()
  const [showModal] = RxUseDialog()
  const [showToast, onlyErrorToast] = useResponseToast()
  const { userPayInfo } = storeToRefs(useUserStore())
  const { check } = usePermission()
  const { currentLocale } = storeToRefs(useSimpleLocale())
  const { getUserPayInfo } = useUserStore()
  const { openRoxyAIAgent } = useOpenRoxyAIAgent()

  const { showFreedomActivityModal, showSlotMachine } = useFreedomActivity()
  const { showLuckyDrawAfterPay } = useMidAutumnActivity()
  const { maybeShowFirstConsumeReferralPopup } = useFirstConsumeReferralPopup()

  function openProcessing(
    data: Record<string, any>,
    type: OrderType | 'silent',
    options: {
      cancelRedirect?: boolean
      /** 从钱包充值进入扫码支付时，返回并重新打开充值弹窗 */
      onBack?: () => void
    } = {},
  ) {
    const { cancelRedirect = true, onBack: onBackOption } = options
    // 钱包充值会把返回回调挂在结算数据上；订阅、账单重试等入口没有该字段
    const { onBack: onBackFromData, ...payData } = data
    const onBack = onBackOption ?? (typeof onBackFromData === 'function' ? onBackFromData : undefined)
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    if (isCardPayWay(payData.payType) || payData.payType === PayWay.Balance) {
      onConfirm()
      return promise
    }

    const ModalComponent = modalMap[payData.payType as keyof typeof modalMap]?.(payData) || markRaw(ProcessingModal)
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      pt: {
        content: '!pa-0',
      },
      slots: {
        container: ({ hideModal }) => (
          <ModalComponent
            data={payData}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onClose={hideModal}
            onBack={onBack
              ? () => {
                  hideModal()
                  reject(PAY_PROCESSING_BACK)
                  // 多数充值入口的 next 没有 await 支付结果，扫码出现前充值弹窗已经关掉，必须重新打开
                  onBack()
                }
              : undefined}
          >
          </ModalComponent>
        ),
      },
    })

    async function onConfirm() {
      switch (type) {
        case OrderType.Subscribe:
        case OrderType.Renew:
          planSuccessFreedomActivity().then(resolve)
          break
        case OrderType.Recharge:
          balanceSuccessForFreedomActivity().then(resolve)
          break
        case OrderType.Purchase:
          purchaseSuccess()
          resolve()
          break
        case OrderType.PointsRecharge:
          purchaseSuccessIntoPoints().then(resolve)
          break
        case 'silent':
          resolve()
          break
        default:
          resolve()
          break
      }
    }

    function onCancel() {
      if (cancelRedirect) {
        router.push({ name: 'wallet', query: { name: 'billing' } })
      }
      reject()
    }

    return promise
  }

  /**
   * 充值
   */
  async function planSuccessFreedomActivity() {
    if (userPayInfo.value?.isFreedom) {
      return showFreedomActivityModal()
    }
    else {
      return planSuccess()
    }
  }

  /**
   * 充值+购买
   */
  async function planSuccessFreedomActivity2() {
    if (userPayInfo.value?.isFreedom) {
      return showFreedomActivityModal(true)
    }
    else {
      return planSuccess()
    }
  }

  /**
   * 钱包直接购买（那就直接弹出老虎机）
   */
  async function planSuccessForSlotMachine() {
    const { promise, resolve } = Promise.withResolvers<void>()
    showSlotMachine(resolve)
    return promise
  }

  async function planSuccess(notSlotMachine?: boolean) {
    // 窗口订阅/续费成功后刷新新人买赠资格；无资格则跳过
    void useNewUserBenefitStore().refreshBenefitIfEligible()

    if (!check('Cost_Center_all')) {
      return
    }

    await getUserPayInfo()
    const { promise, resolve } = Promise.withResolvers<void>()
    dialog.open(PlanSuccessModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          root: '!bg-transparent !border-none !shadow-none',
          content: '!pa-20',
          mask: '!backdrop-blur-md',
        },
      },
      data: {
        // 兑换码不送抽奖次数，成功页不展示入口、确认后也不弹老虎机
        showLottery: !notSlotMachine,
      },
      emits: {
        onConfirm: () => {
          if (!notSlotMachine) {
            showSlotMachine(resolve)
          }
        },
      },
    })
    return promise
  }

  async function balanceSuccessForFreedomActivity() {
    if (userPayInfo.value?.isFreedom) {
      const { promise, resolve } = Promise.withResolvers<void>()
      showFreedomActivityModal(false, resolve)
      return promise
    }
    else {
      return balanceSuccess()
    }
  }

  async function balanceSuccess() {
    if (!check('Cost_Center_all')) {
      return
    }
    const { promise, resolve } = Promise.withResolvers<void>()
    dialog.open(BalanceSuccessModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          root: '!bg-transparent !border-none !shadow-none',
          content: '!pa-20',
          mask: '!backdrop-blur-md',
        },
      },
      emits: {
        onConfirm: () => {
          resolve()
        },
      },
    })
    return promise
  }

  async function purchaseSuccess() {
    if (!check('Cost_Center_all')) {
      return
    }
    await getUserPayInfo()
    const { maxMemberCount, maxWorkspaceCount } = userPayInfo.value!
    showToast(0, $t('您的当前资源: {member} 成员, {workspace} 团队', {
      member: maxMemberCount,
      workspace: maxWorkspaceCount,
    }), { life: 5000 })
    maybeShowFirstConsumeReferralPopup()
  }

  /**
   * 购买积分成功后的提示
   */
  async function purchaseSuccessIntoPoints() {
    if (!check('Cost_Center_all')) {
      return
    }
    await getUserPayInfo()
    const { points } = userPayInfo.value!
    const detail = isMainWindow
      ? (
          <I18nT keypath={$t('您当前的积分：{points}，{open}', { open: '{open}', points })}>
            {{ open: () => <a class="cursor-pointer" onClick={() => openRoxyAIAgent()}>{$t('去使用')}</a> }}
          </I18nT>
        )
      : $t('您当前的积分：{points}', { points })

    showToast(0, detail)
    maybeShowFirstConsumeReferralPopup(() => {
      // 查看详情只改路由，抽奖次数已经到账，关闭推广弹窗后仍要弹出抽奖盘
      showLuckyDrawAfterPay()
    })
  }

  async function walletRecharge(chargeParams: ChargeParams) {
    const { next: settlementNext, ...rest } = chargeParams

    const checker = genCheckerOrderStatus()
    const backToRecharge = () => {
      walletRecharge(chargeParams)
    }

    const onRecharge = async (params: any) => {
      const { _PRE_ORDER, payType, rechargeAmount, cardId, chainType } = params
      // _PRE_ORDER 为 genRechargeSettlement 的返回值，用于后续的支付。
      // 仅卡片充值且不绑卡的情况下才会提前生成充值单。
      const { code, data, msg } = _PRE_ORDER || await genRechargeSettlement({
        payType,
        rechargeAmount,
        cardId,
        chainType,
      })

      msg && onlyErrorToast(code, msg)
      if (code !== 0) {
        return
      }

      try {
        if (isCardPayWay(payType)) {
          const isOK = await checker.check(data.orderNo)
          if (!isOK) {
            return
          }
        }

        await settlementNext?.({
          ...data,
          onBack: backToRecharge,
        })
      }
      catch (error) {
        if (error === PAY_PROCESSING_BACK) {
          return 'back'
        }
        onlyErrorToast(code, (error as Error).message)
      }
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(WalletRechargeModal, {
          onClose: () => {
            hideModal()
            checker.stop()
          },
          onConfirm: onRecharge,
          ...rest,
        }),
      },
    })
  }

  function genCheckerOrderStatus() {
    return genPollingChecker({
      intervalMs: 3000,
      async checkOnce(orderNo: string) {
        const { code, data, msg } = await API.pay.userQueryOrderStatusList({ orderNo })
        onlyErrorToast(code, msg)

        if (code !== 0 || [PaymentStatus.Fail, PaymentStatus.Closed].includes(data as PaymentStatus)) {
          throw new Error(msg)
        }

        return data === PaymentStatus.Success
      },
    })
  }

  async function genRechargeSettlement(params: any) {
    const { code, data, msg } = await API.pay.userPayCaptchaTriggerList()
    if (code !== 0) {
      return { code, data: null, msg }
    }

    if (data.captcha) {
      const captchaVerifyParam = await openAliyunCaptcha({
        SceneId: data.sceneId,
        EncryptedSceneId: data.EncryptedSceneId,
        language: currentLocale.value === 'zh-CN' ? 'cn' : 'en',
      })

      if (!captchaVerifyParam) {
        return { code, data: null, msg: '' }
      }
      Reflect.set(params, 'captchaVerifyParam', captchaVerifyParam)
    }

    return await API.pay.userRechargeSettlementCreate(params)
  }

  return {
    genCheckerOrderStatus,
    genRechargeSettlement,
    openProcessing,
    planSuccess,
    balanceSuccess,
    purchaseSuccess,
    purchaseSuccessIntoPoints,
    walletRecharge,
    planSuccessForSlotMachine,
    planSuccessFreedomActivity,
    planSuccessFreedomActivity2,
    maybeShowFirstConsumeReferralPopup,
  }
}

/** 用户已绑定银行卡列表项 */
export type WalletBindCard = UserGetBindCardListListData['data']['rows'][number]

/** 卡组织到展示图标的映射 */
const cardTypeMap = {
  amex: 'cards/american-express',
  bc: 'cards/bc',
  dinacard: 'cards/dinacard',
  diners: 'cards/diners-club',
  discover: 'cards/discover',
  jcb: 'cards/jcb',
  mastercard: 'cards/mastercard',
  unionpay: 'cards/union-pay',
  visa: 'cards/visa',
} as const satisfies Record<string, SvgNames>

/**
 * 组合支付开关、绑卡与默认卡管理，供钱包页与自动续费弹窗复用
 */
export function useBankCards() {
  const confirm = useConfirm()
  const { userCards, userPayInfo } = storeToRefs(useUserStore())
  const { getUserCards, getUserPayInfo } = useUserStore()
  const { showMenu } = usePopupMenu()
  const [showModal] = RxUseDialog()
  const [showToast, onlyErrorToast] = useResponseToast()

  const autoRecharge = ref(userPayInfo.value.autoRecharge?.toString?.())

  watch(() => userPayInfo.value.autoRecharge, (value) => {
    autoRecharge.value = value.toString()
  })

  onBeforeMount(() => {
    getUserCards()
  })

  /**
   * 根据卡组织返回对应图标名
   */
  function matchCard(type: string): SvgNames {
    return cardTypeMap[type as keyof typeof cardTypeMap] as SvgNames
  }

  /**
   * 将组合支付开关同步到后端；失败时回滚本地开关
   */
  async function enableAutoRecharge() {
    const { code, msg } = await API.pay.userSetAutoRechargeStatusCreate({ status: Number(autoRecharge.value) })
    onlyErrorToast(code, msg)
    if (code !== 0) {
      autoRecharge.value = userPayInfo.value.autoRecharge.toString()
      return
    }
    getUserPayInfo()
  }

  /**
   * 打开 Stripe 绑卡弹窗；开通组合支付时强制设为默认卡
   */
  function bindCard(defaultCard: boolean = false) {
    const { promise, resolve, reject } = Promise.withResolvers<boolean>()

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => {
          const isDefault = ref(false)

          return (
            <div class="w-120 flex flex-col gap-4 pa-6 pt-4">
              <div class="h-9 flex justify-between items-center">
                <div>{$t('新增卡片')}</div>
                <div
                  class="cursor-pointer"
                  onClick={
                    () => {
                      hideModal()
                      reject(false)
                    }
                  }
                >
                  <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
                </div>
              </div>
              <StripePay
                class="w-full !min-w-auto"
                bind={true}
                onConfirm={async (card) => {
                  const { code, msg } = await API.pay.userBindCardCreate({ paymentMethodId: card.payment_method, cardDefault: defaultCard || isDefault.value })
                  onlyErrorToast(code, msg)
                  hideModal()
                  if (code !== 0) {
                    reject(false)
                    return
                  }
                  getUserCards(true)
                  resolve(true)
                }}
              >
                {{
                  after: () => {
                    return !defaultCard && (
                      <div class="flex items-center gap-2.5">
                        <RxCheckbox v-model={isDefault.value} input-id="wrap" binary />
                        <label for="wrap" class="tt-primary text-3.5 leading-5 select-none">{$t('设置为默认卡片')}</label>
                      </div>
                    )
                  },
                }}
              </StripePay>
            </div>
          )
        },
      },
    })

    return promise
  }

  /**
   * 切换组合支付：关闭需二次确认，无卡时先引导绑卡
   */
  async function checkAutoRecharge() {
    if (AutoRechargeStatus.Open === userPayInfo.value.autoRecharge) {
      confirm.require({
        header: $t('关闭组合支付'),
        message: $t('关闭后，当剩余钱包余额不足以自动续费时，相关服务将会中断。'),
        rejectProps: {
          label: $t('取消'),
          severity: 'secondary',
          outlined: true,
        },
        acceptProps: {
          label: $t('确认'),
          severity: 'danger',
        },
        accept: () => {
          enableAutoRecharge()
        },
        reject: () => {
          autoRecharge.value = userPayInfo.value.autoRecharge.toString()
        },
        onHide: () => {
          autoRecharge.value = userPayInfo.value.autoRecharge.toString()
        },
      })
      return
    }

    if (!userCards.value?.length) {
      bindCard(true)
        .then(enableAutoRecharge)
        .catch(() => {
          autoRecharge.value = userPayInfo.value.autoRecharge.toString()
        })
      return
    }

    enableAutoRecharge()
  }

  /**
   * 将指定卡设为默认卡
   */
  async function setMainCard(cardId: any) {
    const { code, msg } = await API.pay.userSetMainCardCreate({ cardId })
    showToast(code, msg)
    if (code !== 0) {
      return
    }
    getUserCards(true)
  }

  /**
   * 解绑卡片前二次确认
   */
  function deleteCard(cardId: any) {
    confirm.require({
      header: $t('删除卡片'),
      message: $t('删除后，您将无法使用该卡片进行支付。'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('确认'),
        severity: 'danger',
      },
      accept: async () => {
        const { code, msg } = await API.pay.userUnbindCardCreate({ cardId })
        showToast(code, msg)
        if (code !== 0) {
          return
        }
        getUserCards(true)
      },
    })
  }

  /**
   * 卡片操作菜单：设默认 / 删除
   */
  function onMenuCommand(event: MouseEvent, card: WalletBindCard) {
    showMenu(event, {
      model: [
        {
          label: $t('设置为默认卡片'),
          icon: 'base/rx_ic_credit_card',
          disabled: !!card.cardDefault,
          command: () => {
            setMainCard(card.cardId)
          },
        },
        {
          separator: true,
        },
        {
          label: $t('删除'),
          icon: 'base/rx_ic_bin_1',
          command: () => {
            deleteCard(card.cardId)
          },
        },
      ],
    })
  }

  return {
    userCards,
    autoRecharge,
    matchCard,
    checkAutoRecharge,
    bindCard,
    onMenuCommand,
    setMainCard,
  }
}
