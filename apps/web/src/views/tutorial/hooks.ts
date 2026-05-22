import GuideModal from '/@/views/tutorial/components/guide-modal.vue'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import type { UserUpdateOnboardingTaskStatusCreatePayload } from '@roxy/backend-api'

export function useOnboardingTaskStatus() {
  const [showModal] = useDialog()
  const userStore = useUserStore()

  const onboardingTaskStatus = computed(() => userStore.userInfo.onboardingTaskStatus)

  async function updateOnboardingTaskStatus(data: UserUpdateOnboardingTaskStatusCreatePayload) {
    const { code } = await API.base.userUpdateOnboardingTaskStatusCreate(data)
    if (code !== 0) {
      return
    }

    Reflect.set(userStore.userInfo, 'onboardingTaskStatus', { ...userStore.userInfo.onboardingTaskStatus, ...data })
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
          desc: $t('当您对 Roxy浏览器的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
          video: 'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/guide_video/gif/tour-hide-guide.mp4',
          onClose: hideModal,
          onConfirm: hideModal,
        }),
      },
    })
  }

  return {
    onboardingTaskStatus,
    updateOnboardingTaskStatus,
    closeGuideTipsAndUpdateTaskStatus,
  }
}
