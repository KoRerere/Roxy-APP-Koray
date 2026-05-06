import BalanceSuccessModal from './components/balance-success.vue'
import PlanSuccessModal from './components/plan-success.vue'
import ProcessingModal from './components/processing-modal.vue'
import UsdtPayModal from './components/payway-usdt-modal.vue'
import WechatPayModal from './components/payway-wechat-modal.vue'
import AlipayPayModal from './components/payway-alipay-modal.vue'
import WalletRechargeModal from '/@/views/pay/wallet/components/wallet-recharge-modal.vue'
import { useDialog } from 'primevue/usedialog'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'

import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { useSimpleLocale } from '/@/stores/locale'
import { OrderType, PaymentStatus, PayWay } from '/@/enums/pay'
import { genPollingChecker } from '/@/utils/basic'
import { openAliyunCaptcha } from '/@/utils/aliyun-captcha'
import type { UserRechargeSettlementCreateData } from '@roxy/backend-api'

import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'

type Data = UserRechargeSettlementCreateData['data']
interface ChargeParams {
  next?: (data: Data) => void
  [key: string]: any
}

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

  const { showFreedomActivityModal, showSlotMachine } = useFreedomActivity()

  function openProcessing(data: Record<string, any>, type: OrderType | 'silent') {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    if (data.payType === PayWay.Card || data.payType === PayWay.Balance) {
      onConfirm()
      return promise
    }

    const ModalComponent = modalMap[data.payType as keyof typeof modalMap]?.(data) || markRaw(ProcessingModal)
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
            data={data}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onClose={hideModal}
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
        case 'silent':
          resolve()
          break
        default:
          resolve()
          break
      }
    }

    function onCancel() {
      router.push({ name: 'wallet', query: { name: 'billing' } })
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
    if (!check('Cost_Center_all'))
      return

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
    if (!check('Cost_Center_all'))
      return
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
    if (!check('Cost_Center_all'))
      return
    await getUserPayInfo()
    const { maxMemberCount, maxWorkspaceCount } = userPayInfo.value!
    showToast(0, $t('您的当前资源: {member} 成员, {workspace} 空间', {
      member: maxMemberCount,
      workspace: maxWorkspaceCount,
    }), { life: 5000 })
  }

  async function walletRecharge(chargeParams: ChargeParams) {
    const { next: settlementNext, ...rest } = chargeParams

    const checker = genCheckerOrderStatus()

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
      if (code !== 0)
        return

      try {
        if (payType === PayWay.Card) {
          const isOK = await checker.check(data.orderNo)
          if (!isOK)
            return
        }

        await settlementNext?.(data)
      }
      catch (error) {
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

        if (code !== 0 || [PaymentStatus.Fail, PaymentStatus.Closed].includes(data as PaymentStatus))
          throw new Error(msg)

        return data === PaymentStatus.Success
      },
    })
  }

  async function genRechargeSettlement(params: any) {
    const { code, data, msg } = await API.pay.userPayCaptchaTriggerList()
    if (code !== 0)
      return { code, data: null, msg }

    if (data.captcha) {
      const captchaVerifyParam = await openAliyunCaptcha({
        SceneId: data.sceneId,
        EncryptedSceneId: data.EncryptedSceneId,
        language: currentLocale.value === 'zh-CN' ? 'cn' : 'en',
      })

      if (!captchaVerifyParam)
        return { code, data: null, msg: '' }
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
    walletRecharge,
    planSuccessForSlotMachine,
    planSuccessFreedomActivity,
    planSuccessFreedomActivity2,
  }
}
