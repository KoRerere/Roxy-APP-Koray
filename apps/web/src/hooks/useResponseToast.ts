import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'

export function useResponseToast() {
  const toast = useToast()
  const summary = {
    success: $t('success'),
    fail: $t('fail'),
  }

  function showToast(code: number, message: string, life: number = 3000) {
    if (code === 0) {
      toast.add({ severity: 'success', summary: summary.success, detail: message, life })
    }
    else {
      toast.add({ severity: 'error', summary: summary.fail, detail: message, life })
    }
  }

  function onlyErrorToast(code: number, message: string, life: number = 3000) {
    if (code !== 0) {
      toast.add({ severity: 'error', summary: summary.fail, detail: message, life })
    }
  }

  return [showToast, onlyErrorToast]
}
