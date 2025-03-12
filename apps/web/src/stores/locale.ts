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
    // loadLocaleMessages(locale)
    // primevue.config.locale = locale
    await API.base.userSetUserConfigCreate({ language: locale }).finally(() => {
      clearDictCache()
      currentLocale.value = locale
      electronAPI.send('app:saveSoftConfig', { language: locale })
      location.reload()
    })
  }

  return {
    currentLocale,
    setSimpleLocale,
  }
}, {
  persist: {
    storage: sessionStorage,
    pick: ['currentLocale'],
  },
})
