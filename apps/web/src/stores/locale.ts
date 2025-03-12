import { ref } from 'vue'
import { API } from '/@/api'
import { clearDictCache } from '/@/utils'

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const defaultLanguage = navigator.language === 'zh-CN' ? navigator.language : navigator.language.split('-')[0]
  const currentLocale = ref(defaultLanguage)

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
