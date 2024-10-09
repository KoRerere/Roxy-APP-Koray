import type { UserAddLabelInfoCreatePayload } from '@roxy/backend-api'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { isLikeFunction } from '/@/utils'
import editPopup from '/@/views/browser/list/tags/edit.vue'

export function useTagsActions() {
  const toast = useToast()
  const dialog = useDialog()

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
          const { code, msg } = data?.id
            ? await API.window.userMdfLabelInfoCreate({ ...params, id: data.id })
            : await API.window.userAddLabelInfoCreate(params)

          if (code === 0) {
            isLikeFunction(confirmNext) && confirmNext()
          }

          toast.add({ severity: code === 0 ? 'success' : 'error', summary: code === 0 ? 'success' : 'error', detail: msg, life: 5000 })
        },
        onCancel: () => { },
      },
    })
  }

  return [editDialog]
}
