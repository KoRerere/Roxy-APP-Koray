import { API } from '/@/api'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'

export function useCommonUtil() {
  const [showFormDialog] = useFormDialog()
  const [showToast, onlyErrorToast] = useResponseToast()
  const simpleLocale = useSimpleLocale()
  const userStore = useUserStore()
  const { fetchUserInfo, updateUserConfig } = userStore

  const dialogRef = inject<ComputedRef<DynamicDialogInstance>>('dialogRef')

  async function updateUserName(item: Items) {
    if (item.oldValue === item.value)
      return

    const { code, msg } = await API.base.userChangeUsernameCreate({
      userName: item.value,
    })
    onlyErrorToast(code, msg)
    if (code === 0) {
      fetchUserInfo()
      item.oldValue = item.value
    }
  }

  async function saveUserConfig(item: Items, _items: SettingsModule | null = null) {
    if (!item.vaildator || item.vaildator(item)) {
      const value = item.formatValue?.(item) ?? item.value
      const { code, msg } = await API.base.userSetUserConfigCreate({
        [item.name as any]: value,
      })
      onlyErrorToast(code, msg)
      if (code === 0) {
        globalThis.electronAPI.send('app:saveSoftConfig', { [item.name as any]: isProxy(value) ? toRaw(value) : value })
        console.log('saveUserConfig', item.name, value)
        updateUserConfig()
      }
    }
  }

  async function detectLocalNetwork(item: Items) {
    try {
      item.value = await globalThis.electronAPI.send('proxy:detectNetwork', 'local')
    }
    catch (error) {
      item.value = null
      onlyErrorToast(-1, error as string)
    }
  }

  async function detectSystemNetwork(item: Items) {
    try {
      item.value = await globalThis.electronAPI.send('proxy:detectNetwork', 'system')
    }
    catch (error) {
      item.value = null
      onlyErrorToast(-1, error as string)
    }
  }

  return {
    dialogRef,
    showFormDialog,
    showToast,
    userStore,
    simpleLocale,
    updateUserName,
    saveUserConfig,
    detectLocalNetwork,
    detectSystemNetwork,
    onlyErrorToast,
  }
}
