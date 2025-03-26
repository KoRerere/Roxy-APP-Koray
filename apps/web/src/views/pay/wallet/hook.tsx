import { useDialog } from "primevue/usedialog";
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from "/@/locales";
import { useUserStore } from "/@/stores/user";
import BalanceSuccessModal from "./components/balance-success.vue";
import PlanSuccessModal from "./components/plan-success.vue";
import ProcessingModal from "./components/processing-modal.vue";
import UsdtPayModal from "./components/usdt-modal.vue";
import { OrderType, PayWay } from "/@/enums/pay";

export function usePay() {
  const router = useRouter();
  const dialog = useDialog();
  const [dialogInstance] = RxUseDialog()
  const [showToast] = useResponseToast();
  const { userPayInfo } = storeToRefs(useUserStore());
  const { getUserPayInfo } = useUserStore();

  function openProcessing(
    data: Record<string, any>,
    type: OrderType | "silent",
  ) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    dialogInstance.showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      pt: {
        content: '!pa-0'
      },
      slots: {
        container: () => data.payType === PayWay.USDT
          ? <UsdtPayModal
            data={data}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onClose={() => dialogInstance.hideModal()}
          />
          : <ProcessingModal
            data={data}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onClose={() => dialogInstance.hideModal()}
          />,
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
      }
    }

    function onCancel() {
      router.push({ name: "wallet" });
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

  return { openProcessing, planSuccess, balanceSuccess, purchaseSuccess };
}
