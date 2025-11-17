import type { UserAddLabelInfoCreatePayload } from '@roxy/backend-api'
import { useDialog } from 'primevue/usedialog'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { isLikeFunction } from '/@/utils'
import editPopup from '/@/views/browser/list/tags/edit.vue'

interface TagActionsOptions {
  toast?: boolean
}

export function useTagsActions() {
  const dialog = useDialog()

  const [_, onlyErrorToast] = useResponseToast()

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

          onlyErrorToast(res.code, res.msg)
          if (res.code === 0) {
            isLikeFunction(confirmNext) && await confirmNext({ params, res })
          }
        },
        onCancel: () => { },
      },
    })
  }

  return [editDialog] as const
}
