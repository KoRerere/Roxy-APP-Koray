import type { UserAddLabelInfoCreatePayload } from '@roxy/backend-api'
import { useDialog } from 'primevue/usedialog'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { isLikeFunction } from '/@/utils'
import editPopup from '/@/views/browser/list/tags/edit.vue'

interface TagActionsOptions {
  toast?: boolean
}

const defaultOptions: TagActionsOptions = {
  toast: true,
}

export function useTagsActions(options: TagActionsOptions = defaultOptions) {
  const dialog = useDialog()

  const [showToast] = useResponseToast()

  function editDialog(props?: any) {
    const { confirmNext, ...data } = props || {}

    dialog.open(editPopup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data: {
        props: data,
        onConfirm: async (params: UserAddLabelInfoCreatePayload) => {
          const res = data?.id
            ? await API.window.userMdfLabelInfoCreate({ ...params, id: data.id })
            : await API.window.userAddLabelInfoCreate(params)

          if (res.code === 0) {
            isLikeFunction(confirmNext) && await confirmNext({ params, res })
          }

          if (options.toast || res.code !== 0) {
            showToast(res.code, res.msg)
          }
        },
        onCancel: () => { },
      },
    })
  }

  return [editDialog]
}
