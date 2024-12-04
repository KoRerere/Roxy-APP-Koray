import mixpanel from 'mixpanel-browser'
import { usePrimeVue } from 'primevue/config'
import { ref } from 'vue'
import { API } from '/@/api'
import { loadLocaleMessages } from '/@/locales'
import { clearDictCache } from '/@/utils'

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const currentLocale = ref(navigator.language || 'en')

  const setSimpleLocale = async (locale) => {
    if (currentLocale.value === locale) {
      return
    }
    // loadLocaleMessages(locale)
    // primevue.config.locale = locale
    const { code } = await API.base.userSetUserConfigCreate({ language: locale })
    if (code === 0) {
      electronAPI.send('app:saveSoftConfig', { language: locale })
    }
    clearDictCache()
    currentLocale.value = locale
    location.reload()
  }

  const initLocale = async () => {
    const { data } = await API.base.userGetUserConfigList()
    if (data) {
      currentLocale.value = data.language
    }
  }

  return {
    currentLocale,
    initLocale,
    setSimpleLocale,
  }
}, {
  persist: true,
})
