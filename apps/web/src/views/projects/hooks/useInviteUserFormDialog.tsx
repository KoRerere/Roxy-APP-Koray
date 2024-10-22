import type { UserMdfTeamInfoV2CreateData } from '@roxy/backend-api'
import type { Ref } from 'vue'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import type RyTable from '/@/components/ry-table'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import { Role } from '/@/enums'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { $t } from '/@/locales'
import { inviteUsersFormSchemas } from '/@/views/projects/schemas'

interface PropsType {
  tableRef?: Ref<InstanceType<typeof RyTable>>
  user_id?: number
  email?: string
  role?: Role
  projectIds?: number[]
  disableds?: string[]
}

export function useInviteUserFormDialog() {
  const [dialog] = useFormDialog()
  const isInviteMore = ref(false)
  const toast = useToast()

  const showDialog = async ({ tableRef, disableds, ...data }: PropsType) => {
    const originl = data

    await dialog.showModal({
      header: originl.user_id ? $t('Edit user') : $t('Invite user'),
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
                    <label for="ingredient1" class="ml-2">
                      {' '}
                      {$t('Invite more')}
                      {' '}
                    </label>
                  </div>
                )
              }
              <RxButton label={originl.user_id ? $t('Save') : $t('Send invitation')} severity="primary" onClick={dialog.handleOk} />
            </div>
          </div>
        ),
      },
      async handleOk(formModel) {
        const { code, msg } = originl.user_id
          ? await API.team.userMdfTeamInfoV2Create({ ...formModel, userId: originl.user_id } as UserMdfTeamInfoV2CreateData)
          : await API.limit.userInviteCreate(formModel)
        tableRef?.value?.refresh()
        if (code === 0) {
          toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 3000 })
        }
        else {
          toast.add({ severity: 'error', summary: $t('Error'), detail: msg || $t('Failed to send invitation'), life: 3000 })
        }
        if (isInviteMore.value) {
          dialog.formRef.value?.resetFields()
          return Promise.reject(new Error('continue'))
        }
      },
    })

    disableds?.forEach((item) => {
      dialog.formRef.value?.updateSchema({
        field: item,
        componentProps: {
          disabled: true,
        },
      })
    })
  }

  return [showDialog]
}
