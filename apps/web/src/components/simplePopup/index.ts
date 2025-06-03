import oldPopup from './old.vue'
import popup from './index.vue';
import { useDialog } from '/@/hooks/useDialog'
interface SimpleDialogData {
  inputs: any[]
  title?: string
  content?: string
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
  afterRender?: () => void
}

export function useSimpleDialog() {
  const [showModal] = useDialog()

  function showSimpleDialog(props: SimpleDialogData) {
    const { onConfirm, onCancel, ...rest } = props

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ handleCancel }) => h(popup, {
          ...rest,
          onConfirm: async (formData: any) => {
            await onConfirm?.(formData)
            handleCancel()
          },
          onCancel: () => {
            onCancel?.()
            handleCancel()
          },
        })
      },
    })
  }

  return { showSimpleDialog }
}

export default oldPopup
