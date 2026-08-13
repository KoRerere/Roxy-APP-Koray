import { API } from '/@/api'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { isLikeFunction } from '/@/utils'
import { createProjectFormSchemas } from '/@/views/projects/schemas'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'

interface TagActionsOptions {
  toast?: boolean
}

const defaultOptions: TagActionsOptions = {
  toast: true,
}

export function useProjectActions(options: TagActionsOptions = defaultOptions) {
  const [showFormDialog] = useFormDialog()
  const [showToast] = useResponseToast()
  const { handleBusinessCode } = useHandleBusinessCode()
  const projectLabels = useProjectEntityLabels()

  async function addDialog(props?: any) {
    const { confirmNext, ...data } = props || {}
    const labels = projectLabels.value

    const formDialogInstance = await showFormDialog({
      header: data.project_id ? labels.editTitle : labels.createTitle,
      class: 'w-[500px]',
      schemas: createProjectFormSchemas(labels),
      formProps: {
        layout: 'vertical',
      },
      handleOk: async (params: any) => {
        const res = data.project_id
          ? await API.limit.userMdfProjectInfoCreate({ id: data.project_id, ...params })
          : await API.limit.userAddProjectInfoCreate(params)

        if (res.code === 0) {
          isLikeFunction(confirmNext) && (await confirmNext({ params, res }))
        }

        handleBusinessCode(res.code, () => {
          if (options.toast || res.code !== 0) {
            showToast(res.code, res.msg)
            // TODO
          }
        })
      },
    })

    formDialogInstance.formRef.value?.setFieldsValue({
      id: data.project_id,
      ...data,
    })
  }

  return [addDialog] as const
}
