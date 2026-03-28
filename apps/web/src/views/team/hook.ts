import BatchInviteModal from '/@/views/projects/components/batch-invite-modal.vue'
import { useUserStore } from '/@/stores/user'
import { useDialog } from '/@/hooks/useDialog'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { BUSINESS_CODE } from '/@/constants/business-code'
import type { Role } from '/@/enums'
import { API } from '/@/api'

export function useTeam() {
  const { userPayInfo } = storeToRefs(useUserStore())
  const { handleBusinessCode } = useHandleBusinessCode()
  const [showModal] = useDialog()

  const allProjects = ref()

  async function getAllProjects() {
    if (allProjects.value)
      return allProjects.value
    const { code, data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
    if (code === 0) {
      allProjects.value = data.rows
    }
    return allProjects.value
  }

  async function inviteMembers(params?: { inviteRole?: Role, onBeforeClose?: (refresh?: boolean) => void }) {
    const { maxMemberCount, useMemberCount } = userPayInfo.value
    if (useMemberCount >= maxMemberCount) {
      handleBusinessCode(BUSINESS_CODE.MEMBER_MAX_LIMIT)
      return
    }

    const projects: any[] = await getAllProjects().then(res => res.map((item: any) => ({ ...item, label: item.projectName, value: item.project_id })))
    const projectValues = [projects.find(item => item.projectDefault && !item.isTransfer)?.value || projects[0].value]

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0',
      },
      slots: {
        container: ({ hideModal }) => h(BatchInviteModal, {
          projects,
          projectValues,
          multiple: true,
          onClose: hideModal,
          ...params,
        }),
      },
    })
  }

  return { inviteMembers }
}
