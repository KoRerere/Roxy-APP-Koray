import RxCheckbox from '/@/components/rx-checkbox/index.vue'
import { useToast } from 'primevue/usetoast'
import type { Ref } from 'vue'
import { API } from '/@/api'
import RxButton from '/@/components/rx-button'
import type RyTable from '/@/components/ry-table'
import { Role } from '/@/enums'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { $t } from '/@/locales'
import { getInviteUsersFormSchemas } from '/@/views/projects/schemas'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'

interface PropsType {
  tableRef?: Ref<InstanceType<typeof RyTable>>
  userId?: number
  email?: string
  phone?: string
  role?: Role
  projectIds?: number[]
  disableds?: string[]
  handleOk?: (formModel: any) => any | Promise<any>
}

export function useInviteUserFormDialog() {
  const [showFormDialog] = useFormDialog()
  const isInviteMore = ref(false)
  const toast = useToast()
  const { handleBusinessCode } = useHandleBusinessCode()

  const showDialog = async ({ tableRef, disableds, handleOk, ...data }: PropsType) => {
    const originl = data

    const dialogInstance = await showFormDialog({
      header: $t('编辑用户'),
      class: 'w-[500px]',
      formProps: {
        layout: 'vertical',
        initialValues: {
          email: data.email || data.phone,
          role: data.role || Role.VIEWER,
          projectIds: data.projectIds || [],
        },
      },
      schemas: getInviteUsersFormSchemas(data.projectIds),
      dialogSlots: {
        footer: () => (
          <div class="w-full flex justify-between gap-2">
            <RxButton label={$t('取消')} text severity="secondary" type="button" onClick={() => dialogInstance.handleCancel()} />
            <div class="flex gap-2">
              {!originl.userId && (
                <div class="flex items-center">
                  <RxCheckbox v-model={isInviteMore.value} input-id="ingredient1" binary />
                  <label for="ingredient1" class="ml-2">
                    {$t('发送 & 邀请更多')}
                  </label>
                </div>
              )}
              <RxButton
                label={originl.userId ? $t('保存') : $t('发送邀请')}
                severity="primary"
                onClick={() => dialogInstance.handleOk()}
              />
            </div>
          </div>
        ),
      },
      async handleOk(formModel) {
        const { code, msg } = originl.userId
          ? await API.team.userMdfTeamInfoV2Create({ ...formModel, userId: originl.userId } as any)
          : await API.limit.userInviteCreate(formModel as any)
        if (code === 0) {
          tableRef?.value?.refresh()
          if (!originl.userId) {
            toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('发送邀请成功'), life: 3000 })
          }
          handleOk?.(formModel)
        }
        else {
          handleBusinessCode(code, () => {
            toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg || $t('发送邀请失败'), life: 3000 })
          })
        }
        if (isInviteMore.value) {
          dialogInstance.formRef.value?.resetFields()
          return Promise.reject(new Error('continue'))
        }
      },
    })

    disableds?.forEach((item) => {
      dialogInstance.formRef.value?.updateSchema({
        field: item,
        componentProps: {
          disabled: true,
        },
      })
    })
  }

  return [showDialog] as const
}
