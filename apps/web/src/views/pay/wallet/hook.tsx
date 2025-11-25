import { useDialog } from "primevue/usedialog";
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from "/@/locales";
import { useUserStore } from "/@/stores/user";
import BalanceSuccessModal from "./components/balance-success.vue";
import PlanSuccessModal from "./components/plan-success.vue";
import ProcessingModal from "./components/processing-modal.vue";
import UsdtPayModal from "./components/payway-usdt-modal.vue";
import WechatPayModal from "./components/payway-wechat-modal.vue";
import AlipayPayModal from "./components/payway-alipay-modal.vue";
import WalletRechargeModal from '/@/views/pay/wallet/components/wallet-recharge-modal.vue'
import { OrderType, PaymentStatus, PayWay } from "/@/enums/pay";
import { API } from "/@/api";
import { sleep } from "/@/utils/basic";
import type { UserRechargeSettlementCreateData } from "@roxy/backend-api";

type Data = UserRechargeSettlementCreateData["data"]
type ChargeParams = {
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
  const router = useRouter();
  const dialog = useDialog();
  const [showModal] = RxUseDialog()
  const [showToast, onlyErrorToast] = useResponseToast();
  const { userPayInfo } = storeToRefs(useUserStore());
  const { getUserPayInfo } = useUserStore();
  const isUnmounted = ref(false)

  onBeforeUnmount(() => {
    isUnmounted.value = true
  })

  async function checkOrderStatus(orderNo: string) {
    if (isUnmounted.value) return
    const { code, data, msg } = await API.pay.userQueryOrderStatusList({ orderNo })
    onlyErrorToast(code, msg);
    if (code !== 0) throw new Error(msg)
    if (data === PaymentStatus.Success) {
      return Promise.resolve();
    } else {
      await sleep(3000)
      return await checkOrderStatus(orderNo);
    }
  }

  function openProcessing(data: Record<string, any>, type: OrderType | "silent") {
    const { promise, resolve, reject } = Promise.withResolvers<void>();

    if (data.payType === PayWay.Card) {
      onConfirm()
      return promise
    }

    const ModalComponent = modalMap[data.payType as keyof typeof modalMap](data) || markRaw(ProcessingModal)
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      pt: {
        content: '!pa-0'
      },
      slots: {
        container: ({ hideModal }) => <ModalComponent
          data={data}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onClose={hideModal}
        ></ModalComponent>
      },
    })

    async function onConfirm() {
      switch (type) {
        case OrderType.Subscribe:
        case OrderType.Renew:
          planSuccess().then(resolve);
          break;
        case OrderType.Recharge:
          balanceSuccess().then(resolve);
          break;
        case OrderType.Purchase:
          purchaseSuccess()
          resolve();
          break;
        case "silent":
          resolve();
          break;
        default:
          resolve();
          break;
      }
    }

    function onCancel() {
      router.push({ name: 'wallet', query: { name: 'billing' } })
      reject();
    }

    return promise;
  }

  async function planSuccess() {
    await getUserPayInfo()
    const { promise, resolve } = Promise.withResolvers<void>();
    dialog.open(PlanSuccessModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          root: "!bg-transparent !border-none !shadow-none",
          content: "!pa-20",
          mask: "!backdrop-blur-md",
        },
      },
      emits: {
        onConfirm: () => {
          resolve();
        },
      },
    });
    return promise;
  }

  async function balanceSuccess() {
    const { promise, resolve } = Promise.withResolvers<void>();
    dialog.open(BalanceSuccessModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          root: "!bg-transparent !border-none !shadow-none",
          content: "!pa-20",
          mask: "!backdrop-blur-md",
        },
      },
      emits: {
        onConfirm: () => {
          resolve();
        },
      },
    });
    return promise;
  }

  async function purchaseSuccess() {
    await getUserPayInfo()
    const { maxMemberCount, maxWorkspaceCount } = userPayInfo.value!;
    showToast(0, $t("您的当前资源: {member} 成员, {workspace} 空间", {
      member: maxMemberCount,
      workspace: maxWorkspaceCount,
    }), { life: 5000 });
  }

  async function walletRecharge(chargeParams: ChargeParams) {
    const { next: settlementNext, ...rest } = chargeParams

    const onRecharge = async (params: any) => {
      const { _PRE_ORDER, payType, rechargeAmount, cardId, chainType } = params
      // _PRE_ORDER 为 userRechargeSettlementCreate 的返回值，用于后续的支付。
      // 仅卡片充值且不绑卡的情况下才会提前生成充值单。
      const { code, data, msg } = _PRE_ORDER || await API.pay.userRechargeSettlementCreate({
        payType,
        rechargeAmount,
        cardId,
        chainType,
      })

      onlyErrorToast(code, msg)
      if (code !== 0) return

      try {
        if (payType === PayWay.Card) {
          await checkOrderStatus(data.orderNo)
        }

        settlementNext?.(data)

      } catch (error) {
        onlyErrorToast(code, (error as Error).message)
      }
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(WalletRechargeModal, {
          onClose: hideModal,
          onConfirm: onRecharge,
          ...rest,
        })
      },
    })
  }

  return { checkOrderStatus, openProcessing, planSuccess, balanceSuccess, purchaseSuccess, walletRecharge };
}
