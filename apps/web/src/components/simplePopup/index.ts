import { useDialog } from 'primevue/usedialog'

import popup from './index.vue'

interface SimpleDialogData {
  props: {
    title?: string
    content?: string
    inputs?: any[]
  }
  onConfirm?: (formData: any) => void
  onCancel?: () => void
}

export function useSimpleDialog() {
  const dialog = useDialog()

  function dialogOpen(data: SimpleDialogData) {
    dialog.open(popup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data,
    })
  }

  return [dialogOpen]
}

export default popup
