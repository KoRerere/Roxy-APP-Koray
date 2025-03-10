import { ref } from 'vue'
import { API } from '/@/api'
import { appInitQuery, clearDictCache } from '/@/utils'

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const currentLocale = ref(appInitQuery.language)

  const setSimpleLocale = async (locale: string) => {
    if (currentLocale.value === locale) {
      return
    }
    electronAPI.send('app:saveSoftConfig', { language: locale })
    // loadLocaleMessages(locale)
    // primevue.config.locale = locale
    await API.base.userSetUserConfigCreate({ language: locale })
    clearDictCache()
    currentLocale.value = locale
    location.reload()
  }

  return {
    currentLocale,
    setSimpleLocale,
  }
}, {
  persist: true,
})
