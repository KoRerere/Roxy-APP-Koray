import type RyTable from '/@/components/ry-table'
import type { UserMdfTeamInfoV2CreateData } from '@roxy/backend-api'
import type { Ref } from 'vue'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import RxButton from '/@/components/ry-button'
import { Role } from '/@/enums'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { inviteUsersFormSchemas } from '/@/views/projects/schemas'

interface PropsType {
  tableRef?: Ref<InstanceType<typeof RyTable>>
  user_id?: number
  email?: string
  role?: Role
  projectIds?: number[]
}

export function useInviteUserFormDialog() {
  const [dialog] = useFormDialog()
  const isInviteMore = ref(false)
  const toast = useToast()

  const showDialog = async ({ tableRef, ...data }: PropsType) => {
    const originl = data

    await dialog.showModal({
      header: 'Invite users',
      class: 'w-[500px]',
      formProps: {
        layout: 'vertical',
        initialValues: {
          email: data.email,
          role: data.role || Role.VIEWER,
          projectIds: data.projectIds || [],
        },
      },
      schemas: inviteUsersFormSchemas,
      dialogSlots: {
        footer: () => (
          <div class="w-full flex justify-between gap-2">
            <RxButton label="Cancel" severity="secondary" type="button" onClick={dialog.handleCancel} />
            <div class="flex gap-2">
              {
                !originl.user_id && (
                  <div class="flex items-center">
                    <Checkbox v-model={isInviteMore.value} input-id="ingredient1" binary />
                    <label for="ingredient1" class="ml-2"> Invite more </label>
                  </div>
                )
              }
              <RxButton label={originl.user_id ? 'Save' : 'Send invitation'} severity="primary" onClick={dialog.handleOk} />
            </div>
          </div>
        ),
      },
      async handleOk(formModel) {
        const { code, data, msg } = originl.user_id
          ? await API.team.userMdfTeamInfoV2Create({ ...formModel, userId: originl.user_id } as UserMdfTeamInfoV2CreateData)
          : await API.limit.userInviteCreate(formModel)
        tableRef?.value?.refresh()
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
    if (data?.email) {
      dialog.formRef.value?.updateSchema({
        field: 'email',
        componentProps: {
          disabled: true,
        },
      })
    }
  }

  return [showDialog]
}
