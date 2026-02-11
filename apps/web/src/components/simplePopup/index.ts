import popup from './index.vue'
import { useDialog } from '/@/hooks/useDialog'

interface SimpleDialogData {
  inputs: any[]
  title?: string
  content?: string
  cancelText?: string
  confirmText?: string
  afterRender?: any
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
  onHide?: () => void
}

export function useSimpleDialog() {
  const [showModal] = useDialog()

  function showSimpleDialog({ onHide, ...props }: SimpleDialogData) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(popup, {
          ...props,
          onClose: hideModal,
        }),
      },
      handleCancel: onHide,
    })
  }

  return { showSimpleDialog }
}
