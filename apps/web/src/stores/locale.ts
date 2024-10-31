import mixpanel from 'mixpanel-browser'
import { usePrimeVue } from 'primevue/config'
import { ref } from 'vue'
import { loadLocaleMessages } from '/@/locales'

export const useSimpleLocale = defineStore('locale', () => {
  const primevue = usePrimeVue()
  const currentLocale = ref(navigator.language || 'en')

  const setSimpleLocale = (locale) => {
    loadLocaleMessages(locale)
    primevue.config.locale = locale
    currentLocale.value = locale
    setTimeout(() => {
      location.reload()
    })
  }

  return {
    currentLocale,
    setSimpleLocale,
  }
}, {
  persist: true,
})
