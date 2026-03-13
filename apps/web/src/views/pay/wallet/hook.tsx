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
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import { OrderType, PaymentStatus, PayWay } from '/@/enums/pay'
import { sleep } from '/@/utils/basic'
import { openAliyunCaptcha } from '/@/utils/aliyun-captcha'
import type { UserRechargeSettlementCreateData } from '@roxy/backend-api'

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
  const { isOwner } = storeToRefs(useRoleStore())
  const { currentLocale } = storeToRefs(useSimpleLocale())

  const { getUserPayInfo } = useUserStore()

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
          planSuccess().then(resolve)
          break
        case OrderType.Recharge:
          balanceSuccess().then(resolve)
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

  async function planSuccess() {
    if (!isOwner.value)
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
          resolve()
        },
      },
    })
    return promise
  }

  async function balanceSuccess() {
    if (!isOwner.value)
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
    if (!isOwner.value)
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
    let stopped = false
    let currentTaskId = 0

    function stop() {
      stopped = true
      currentTaskId++
    }

    async function checkOnce(orderNo: string) {
      const { code, data, msg } = await API.pay.userQueryOrderStatusList({ orderNo })
      onlyErrorToast(code, msg)

      if (code !== 0 || [PaymentStatus.Fail, PaymentStatus.Closed].includes(data as PaymentStatus))
        throw new Error(msg)

      return data === PaymentStatus.Success
    }

    /** 轮询检查订单状态 */
    async function check(orderNo: string) {
      stopped = false
      const taskId = ++currentTaskId

      while (!stopped && taskId === currentTaskId) {
        const isOk = await checkOnce(orderNo)

        if (isOk) {
          stop()
          return isOk
        }

        await sleep(3000)

        // 如果任务被新任务覆盖
        if (taskId !== currentTaskId)
          return
      }
    }

    return {
      checkOnce,
      check,
      stop,
    }
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

  return { genCheckerOrderStatus, genRechargeSettlement, openProcessing, planSuccess, balanceSuccess, purchaseSuccess, walletRecharge }
}
