import ActivityRechangeModal from '/@/views/campaign/freedom/activity-rechange-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useCampaignStore } from '/@/stores/campaign'
import SlotMachine from './SlotMachine/index.vue'

export function useFreedomActivity() {
  const [showModal] = useDialog()
  const campaignStore = useCampaignStore()

  const LOCAL_KEY = 'activityModalOpenStatusByMayFreedom'

  function setActivityModalOpenStatus() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(true))
  }

  function showSlotMachine(callback?: () => void) {
    console.log('打开老虎机')
    console.log(campaignStore.seasonalActivity)
    console.log(campaignStore.currentActivity)
    if (!campaignStore.seasonalActivity.midAutumnFestival) {
      return callback?.()
    }

    showModal({
      modal: true,
      blockScroll: true,
      style: {
        width: '480px',
      },
      slots: {
        container: ({ hideModal }) => h(SlotMachine, {
          hideModal: () => {
            hideModal()
            callback?.()
          },
        }),
      },
    })
  }

  function showFreedomActivityModal(isNext?: boolean, callback?: () => void) {
    console.log('打开身份获取弹窗')
    console.log(campaignStore.seasonalActivity)
    console.log(campaignStore.currentActivity)
    if (!campaignStore.seasonalActivity.midAutumnFestival) {
      return
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      slots: {
        container: ({ handleCancel }) => h(ActivityRechangeModal, {
          onClose: () => {
            callback?.()
            handleCancel()
            if (isNext) {
              showSlotMachine()
            }
          },
          isNext,
        }),
      },
      handleCancel: () => {
        localStorage.removeItem(LOCAL_KEY)
        Reflect.set(campaignStore.currentActivity, 'isFreedom', true)
      },
    })
  }

  return {
    setActivityModalOpenStatus,
    showFreedomActivityModal,
    showSlotMachine,
  }
}
