import { ref } from 'vue'
import { API } from '/@/api'
import { clearDictCache } from '/@/utils/'

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const defaultLanguage = navigator.language === 'zh-CN' ? navigator.language : navigator.language.split('-')[0]
  const currentLocale = ref(defaultLanguage)

  const siteLocale = computed(() => {
    return currentLocale.value.split('-')[0]
  })

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

  function getOfficialWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const locale = siteLocale.value === 'zh' ? 'zh' : 'en'
    return `${import.meta.env.VITE_OFFICIAL_WEBSITE}/${locale}/${pathname}`
  }

  function getOfficialFaqWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const locale = siteLocale.value === 'zh' ? '/zh' : ''
    return `${import.meta.env.VITE_OFFICIAL_FAQ_WEBSITE}${locale}${pathname}`
  }

  return {
    siteLocale,
    currentLocale,
    setSimpleLocale,
    getOfficialWebsite,
    getOfficialFaqWebsite
  }
}, {
  persist: {
    storage: sessionStorage,
    pick: ['currentLocale'],
  },
})
