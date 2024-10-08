import { usePrimeVue } from 'primevue/config'
import { ref } from 'vue'
import { loadLocaleMessages } from '/@/locales'

export const useSimpleLocale = defineStore('locale', () => {
  const primevue = usePrimeVue()
  const currentLocale = ref('zh-CN')

  const setSimpleLocale = (locale) => {
    loadLocaleMessages(locale)
    primevue.config.locale = locale
    currentLocale.value = locale
  }

  return {
    currentLocale,
    setSimpleLocale,
  }
}, {
  persist: true,
})
