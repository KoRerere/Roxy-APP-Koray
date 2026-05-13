import { ref } from 'vue'
import { API } from '/@/api'
import { clearDictCache, getDictMap } from '/@/utils/'
import { defaultLanguage } from '/@/locales'

/** 根据语言码选择 .env 中的 Web App 域名（zh-* → ZH，其余 → EN） */
export function getLocaleAppOrigin(locale: string): string {
  const primary = locale.split('-')[0]?.toLowerCase() ?? ''
  const raw = primary === 'zh'
    ? import.meta.env.VITE_LOCALE_APP_ORIGIN_ZH
    : import.meta.env.VITE_LOCALE_APP_ORIGIN_EN
  return raw.replace(/\/$/, '')
}

/** Web 版：是否与路由中的登录页 path 一致（避免 store 引用 router 产生循环依赖） */
function isWebLoginPathname(): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const loginPath = base ? `${base}/login` : '/login'
  return path === loginPath
}

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const currentLocale = ref(defaultLanguage)

  const siteLocale = computed(() => {
    return currentLocale.value?.split('-')[0]
  })

  const isZh = computed(() => siteLocale.value === 'zh')

  const setSimpleLocale = async (locale: string) => {
    if (currentLocale.value === locale) {
      return
    }
    // loadLocaleMessages(locale)
    // primevue.config.locale = locale
    await API.base.userSetUserConfigCreate({ language: locale }).finally(() => {
      clearDictCache()
      currentLocale.value = locale
      globalThis.electronAPI.send('app:saveSoftConfig', { language: locale } as never)

      if (globalThis.isElectron) {
        location.reload()
        return
      }

      if (isWebLoginPathname()) {
        const targetBase = getLocaleAppOrigin(locale)
        const targetOrigin = new URL(`${targetBase}/`).origin
        if (targetOrigin !== window.location.origin) {
          const dest = new URL(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
            `${targetBase}/`,
          )
          dest.searchParams.set('official-site-lang', locale)
          location.replace(dest.href)
          return
        }
      }

      location.reload()
    })
  }

  /** 当前语言下 Web 版站点根 URL（见 VITE_LOCALE_APP_ORIGIN_*） */
  function getLocaleAppBaseUrl(pathname = '') {
    const origin = getLocaleAppOrigin(currentLocale.value)
    if (!pathname)
      return origin
    return `${origin}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  }

  function getOfficialWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const locale = isZh.value ? '/zh' : ''
    return `${import.meta.env.VITE_OFFICIAL_WEBSITE}${locale}${pathname}`
  }

  function getOfficialFaqWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const locale = isZh.value ? '/zh' : ''
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
    isZh,
    openTelegram,
    setSimpleLocale,
    getOfficialWebsite,
    getOfficialFaqWebsite,
    getLocaleAppBaseUrl,
  }
}, {
  persist: {
    pick: ['currentLocale'],
  },
})
