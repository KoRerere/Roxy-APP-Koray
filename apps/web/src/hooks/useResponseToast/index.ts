import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'

import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'

export function useResponseToast() {
  const toast = useToast()
  // const { handleBusinessCode } = useHandleBusinessCode()

  const summary = {
    success: $t('操作成功'),
    error: $t('操作失败'),
  }

  function showToast(code: number, message: string, options?: ToastMessageOptions) {
    if (code === 0) {
      toast.add({ severity: 'success', summary: summary.success, detail: message, ...Object.assign(({ life: 3000 } as ToastMessageOptions), options) })
    }
    else {
      // handleBusinessCode(code, () => {
      toast.add({ severity: 'error', summary: summary.error, detail: message, ...Object.assign(({ life: 3000 } as ToastMessageOptions), options) })
      // })
    }
  }

  function onlyErrorToast(code: number, message: string, options?: ToastMessageOptions) {
    if (code !== 0) {
      toast.add({ severity: 'error', summary: summary.error, detail: message, ...Object.assign(({ life: 5000 } as ToastMessageOptions), options) })
    }
  }

  return [showToast, onlyErrorToast] as const
}
