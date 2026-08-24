import { useDialog } from '/@/hooks/useDialog'
import PurchaseAgentPoints from './PurchaseAgentPoints.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import type { PointsData } from './interface.ts'
import { OrderType, PayWay } from '/@/enums/pay'
import type { RoxyGiftsType } from '/@/enums/pay'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePay } from '/@/views/pay/wallet/hook.tsx'

export function useBuyPoints() {
  const [showModal] = useDialog()
  const [_, onlyErrorToast] = useResponseToast()
  const { purchaseSuccessIntoPoints, openProcessing } = usePay()

  async function handleConfirm(pointsData: PointsData, onFinished?: (success: boolean) => void) {
    console.log('pointsData', pointsData)
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(WalletPayModal, {
          amount: pointsData.actualAmount,
          originalAmount: pointsData.originalAmount,
          discountAmount: pointsData.originalAmount - pointsData.actualAmount,
          onClose: hideModal,
          onCancel: () => onFinished?.(false),
          onConfirm: async ({ payType, ...params }: { payType: PayWay, giftType: RoxyGiftsType, purchaseMember: { staff: number, workspace: number } }) => {
            const { code, data, msg } = await API.points.userBuyPointsSettlementCreate({
              rechargeAmount: pointsData.points,
              orderType: OrderType.PointsRecharge,
              payType,
              ...params,
            })
            onlyErrorToast(code, msg)
            if (code === 0) {
              if (payType === PayWay.Balance) {
                await purchaseSuccessIntoPoints()
                onFinished?.(true)
              }
              else {
                openProcessing({ ...data, payType }, OrderType.PointsRecharge)
                  .then(() => onFinished?.(true))
                  .catch(() => onFinished?.(false))
              }
            }
            else {
              onFinished?.(false)
            }
          },
        }),
      },
    })
  }

  function buyPoints() {
    const { promise, resolve } = Promise.withResolvers<boolean>()
    let settled = false
    const finish = (success: boolean) => {
      if (settled)
        return
      settled = true
      resolve(success)
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: { root: '!w-[680px]' },
      handleCancel: () => finish(false),
      slots: {
        container: ({ handleCancel }) => (
          <PurchaseAgentPoints
            hideModal={handleCancel}
            onClose={() => finish(false)}
            onConfirm={(pointsData: PointsData) => handleConfirm(pointsData, finish)}
          >
          </PurchaseAgentPoints>
        ),
      },
    })

    return promise
  }

  return {
    buyPoints,
  }
}
