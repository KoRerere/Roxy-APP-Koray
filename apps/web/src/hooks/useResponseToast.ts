import { useToast } from 'primevue/usetoast'

export function useResponseToast() {
  const toast = useToast()

  function showToast(code: number, message: string, life: number = 3000) {
    if (code === 0) {
      toast.add({ severity: 'success', summary: '成功', detail: message, life })
    }
    else {
      toast.add({ severity: 'error', summary: '失败', detail: message, life })
    }
  }

  function onlyErrorToast(code: number, message: string, life: number = 3000) {
    if (code !== 0) {
      toast.add({ severity: 'error', summary: '失败', detail: message, life })
    }
  }

  return [showToast, onlyErrorToast]
}
