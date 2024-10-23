import { API } from '/@/api'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { isLikeFunction } from '/@/utils'
import { projectFormSchemas } from '/@/views/projects/schemas'

interface TagActionsOptions {
  toast?: boolean
}

const defaultOptions: TagActionsOptions = {
  toast: true,
}

export function useProjectActions(options: TagActionsOptions = defaultOptions) {
  const [dialog] = useFormDialog()
  const [showToast] = useResponseToast()

  async function addDialog(props?: any) {
    const { confirmNext, ...data } = props || {}

    await dialog.showModal({
      header: data.project_id ? $t('Edit project') : $t('Create project'),
      class: 'w-[500px]',
      schemas: projectFormSchemas,
      formProps: {
        layout: 'vertical',
      },
      handleOk: async (params: any) => {
        const res = data.project_id
          ? await API.limit.userMdfProjectInfoCreate({ id: data.project_id, ...params })
          : await API.limit.userAddProjectInfoCreate(params)
        // tableRef.value?.refresh()

        if (res.code === 0) {
          isLikeFunction(confirmNext) && await confirmNext({ params, res })
        }

        if (options.toast || res.code !== 0) {
          showToast(res.code, res.msg)
        }
      },
    })

    dialog.formRef.value?.setFieldsValue({
      id: data.project_id,
      ...data,
    })
  }

  return [addDialog]
}
