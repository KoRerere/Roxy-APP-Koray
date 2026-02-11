import { ref } from 'vue'
import { API } from '/@/api'
import { clearDictCache, getDictMap } from '/@/utils/'
import { defaultLanguage } from '/@/locales'

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const currentLocale = ref(defaultLanguage)

  const siteLocale = computed(() => {
    return currentLocale.value?.split('-')[0]
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
      globalThis.electronAPI.send('app:saveSoftConfig', { language: locale })
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

  async function openTelegram() {
    const $dict_map = await getDictMap()
    const tgLink = $dict_map.tgLink!.find(item => item.label === currentLocale.value) || $dict_map.tgLink![0]
    window.open(tgLink!.value, '_blank')
  }

  return {
    siteLocale,
    currentLocale,
    openTelegram,
    setSimpleLocale,
    getOfficialWebsite,
    getOfficialFaqWebsite,
  }
}, {
  persist: {
    pick: ['currentLocale'],
  },
})
