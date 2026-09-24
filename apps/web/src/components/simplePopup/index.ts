import popup from './index.vue'
import { useDialog } from '/@/hooks/useDialog'
import type { Input } from '/@/views/lab/components/form/type'

export interface SimpleDialogFooterSlotProps {
  close: () => void
  loading: boolean
  cancelText: string
  confirmText: string
  /** 与保存按钮共用的 form id，自定义提交按钮需指向它才能走校验 */
  formId: string
}

interface SimpleDialogData {
  inputs: Input[]
  title?: string
  content?: string
  cancelText?: string
  confirmText?: string
  afterRender?: any
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
  onHide?: () => void
  /** 透传到弹窗 SFC；不传则走默认取消/保存 footer */
  slots?: {
    footer?: (props: SimpleDialogFooterSlotProps) => unknown
  }
}

export function useSimpleDialog() {
  const [showModal] = useDialog()

  function showSimpleDialog({ onHide, slots, ...props }: SimpleDialogData) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ handleCancel }) => h(popup, {
          ...props,
          onClose: handleCancel,
        }, slots),
      },
      handleCancel: onHide,
    })
  }

  return { showSimpleDialog }
}
