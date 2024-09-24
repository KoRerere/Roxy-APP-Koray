import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import RxButton from '/@/components/ry-button'
import { Role } from '/@/enums'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { inviteUsersFormSchemas } from '/@/views/projects/schemas'

export function useInviteUserFormDialog() {
  const [dialog] = useFormDialog()
  const isInviteMore = ref(false)
  const toast = useToast()

  const showDialog = async ({ projectIds = [], tableRef }) => {
    await dialog.showModal({
      header: 'Invite users',
      class: 'w-[500px]',
      formProps: {
        layout: 'vertical',
        initialValues: {
          email: '',
          role: Role.VIEWER,
          projectIds,
        },
      },
      schemas: inviteUsersFormSchemas,
      dialogSlots: {
        footer: () => (
          <div class="w-full flex justify-between gap-2">
            <RxButton label="Cancel" severity="secondary" type="button" onClick={dialog.handleCancel} />
            <div class="flex gap-2">
              <div class="flex items-center">
                <Checkbox v-model={isInviteMore.value} inputId="ingredient1" binary />
                <label for="ingredient1" class="ml-2"> Invite more </label>
              </div>
              <RxButton label="Send invitation" severity="primary" onClick={dialog.handleOk} />
            </div>
          </div>
        ),
      },
      async handleOk(formModel) {
        const { code, data, msg } = await API.limit.userInviteCreate(formModel)
        tableRef.value?.refresh()
        if (code === 0) {
          toast.add({ severity: 'success', summary: '成功', detail: '发送邀请成功', life: 3000 })
        }
        else {
          toast.add({ severity: 'error', summary: '失败', detail: msg || '发送邀请失败', life: 3000 })
        }
        if (isInviteMore.value) {
          dialog.formRef.value?.resetFields()
          return Promise.reject(new Error('continue'))
        }
      },
    })
  }

  return [showDialog]
}
