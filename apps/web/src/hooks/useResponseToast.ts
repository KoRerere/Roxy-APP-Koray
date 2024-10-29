import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'

export function useResponseToast() {
  const toast = useToast()
  const summary = {
    success: $t('success'),
    error: $t('error'),
  }

  function showToast(code: number, message: string, options?: ToastMessageOptions) {
    if (code === 0) {
      toast.add({ severity: 'success', summary: summary.success, detail: message, ...Object.assign(({ life: 3000 } as ToastMessageOptions), options) })
    }
    else {
      toast.add({ severity: 'error', summary: summary.error, detail: message, ...Object.assign(({ life: 3000 } as ToastMessageOptions), options) })
    }
  }

  function onlyErrorToast(code: number, message: string, options?: ToastMessageOptions) {
    if (code !== 0) {
      toast.add({ severity: 'error', summary: summary.error, detail: message, ...Object.assign(({ life: 2500 } as ToastMessageOptions), options) })
    }
  }

  return [showToast, onlyErrorToast]
}
