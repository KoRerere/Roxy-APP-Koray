import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
;
import { API } from "/@/api";
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from "/@/stores/user";
import type { UserUpdateOnboardingTaskStatusCreatePayload } from "@roxy/backend-api";

export function useOnboardingTaskStatus() {
  const [showModal] = useDialog()
  const { userPayInfo } = storeToRefs(useUserStore())

  const onboardingTaskStatus = computed(() => userPayInfo.value.onboardingTaskStatus)

  async function updateOnboardingTaskStatus(data: UserUpdateOnboardingTaskStatusCreatePayload) {
    const { code } = await API.base.userUpdateOnboardingTaskStatusCreate(data)
    if (code !== 0) return
  }

  function closeGuideTipsAndUpdateTaskStatus(taskKey: keyof UserUpdateOnboardingTaskStatusCreatePayload) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      handleCancel: () => updateOnboardingTaskStatus({ [taskKey]: true }),
      slots: {
        container: ({ hideModal }) => h(GuideModal, {
          title: $t('教程提示'),
          desc: $t('当您对 RoxyBrowser 的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
          video: "/video/tour-hide-guide.mp4",
          onClose: hideModal,
          onConfirm: hideModal,
        })
      }
    })
  }

  return {
    onboardingTaskStatus,
    updateOnboardingTaskStatus,
    closeGuideTipsAndUpdateTaskStatus,
  }
}
